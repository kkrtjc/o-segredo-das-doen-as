// ============================================================
// META CONVERSIONS API (CAPI) — Server-Side Event Tracking
// Todos os eventos do funil: PageView, ViewContent,
// InitiateCheckout, AddPaymentInfo, Purchase
// Envia direto do servidor para o Meta — sem depender do browser
// ============================================================

import { createHash } from 'node:crypto';

const GRAPH_API_VERSION = 'v21.0';

// ─── UTILITÁRIOS ─────────────────────────────────────────────

/** SHA-256 normalizado (lower + trim) — padrão Meta */
function sha256(value) {
    if (!value || typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    return createHash('sha256').update(normalized).digest('hex');
}

/** Remove pontuação — só dígitos */
function cleanDigits(value) {
    if (!value) return undefined;
    const d = value.replace(/\D/g, '');
    return d.length > 0 ? d : undefined;
}

/** Telefone → E.164 Brasil */
function normalizePhone(phone) {
    const digits = cleanDigits(phone);
    if (!digits) return undefined;
    if (digits.length >= 12 && digits.startsWith('55')) return digits;
    return '55' + digits;
}

/** Estado → sigla 2 letras lowercase */
function normalizeState(st) {
    if (!st) return undefined;
    return st.trim().toLowerCase().slice(0, 2);
}

/** Cidade → lowercase sem acento */
function normalizeCity(city) {
    if (!city) return undefined;
    return city.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── BUILDER DE USER_DATA ────────────────────────────────────

/**
 * Monta o objeto user_data com hash SHA-256 de todos os campos.
 * Quanto mais campos enviados, maior o Event Match Quality (EMQ).
 *
 * @param {Object} customer - { name, email, phone, cpf, city, state, zip }
 * @param {Object} meta     - { fbc, fbp, clientIp, userAgent, externalId }
 */
function buildUserData(customer = {}, meta = {}) {
    const ud = {};

    // E-mail — campo mais importante para match
    if (customer.email) {
        const h = sha256(customer.email);
        if (h) ud.em = [h];
    }

    // Telefone
    if (customer.phone) {
        const h = sha256(normalizePhone(customer.phone));
        if (h) ud.ph = [h];
    }

    // Nome (primeiro e último separados)
    if (customer.name) {
        const parts = customer.name.trim().split(/\s+/);
        if (parts[0]) { const h = sha256(parts[0]); if (h) ud.fn = [h]; }
        if (parts.length > 1) { const h = sha256(parts[parts.length - 1]); if (h) ud.ln = [h]; }
    }

    // CPF — campo 'db' (document/tax ID) — identificador mais preciso no Brasil
    if (customer.cpf) {
        const cleanCPF = cleanDigits(customer.cpf);
        if (cleanCPF && cleanCPF.length === 11) {
            const h = sha256(cleanCPF);
            if (h) ud.db = [h];
        }
    }

    // Cidade
    if (customer.city) {
        const h = sha256(normalizeCity(customer.city));
        if (h) ud.ct = [h];
    }

    // Estado (sigla 2 letras)
    if (customer.state) {
        const h = sha256(normalizeState(customer.state));
        if (h) ud.st = [h];
    }

    // CEP
    if (customer.zip) {
        const cleanZip = cleanDigits(customer.zip);
        if (cleanZip) { const h = sha256(cleanZip); if (h) ud.zp = [h]; }
    }

    // País — Brasil sempre
    ud.country = [sha256('br')];

    // Parâmetros de atribuição (NÃO hasheados — Meta exige em texto puro)
    if (meta.fbc) ud.fbc = meta.fbc;
    if (meta.fbp) ud.fbp = meta.fbp;
    if (meta.clientIp) ud.client_ip_address = meta.clientIp;
    if (meta.userAgent) ud.client_user_agent = meta.userAgent;

    // External ID para match cross-device
    if (meta.externalId) {
        const h = sha256(meta.externalId);
        if (h) ud.external_id = [h];
    }

    return ud;
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────

/**
 * Envia qualquer evento para a Meta Conversions API server-side.
 *
 * @param {Object} env
 * @param {Object} options
 * @param {string}   options.eventName     - 'PageView' | 'ViewContent' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase'
 * @param {string}   [options.eventId]     - ID único para deduplicação com pixel do browser
 * @param {Object}   [options.customer]    - { name, email, phone, cpf, city, state, zip }
 * @param {Object}   [options.meta]        - { fbc, fbp, clientIp, userAgent, externalId }
 * @param {number}   [options.value]       - Valor em BRL
 * @param {string}   [options.currency]    - Default: 'BRL'
 * @param {string[]} [options.contentIds]  - IDs dos produtos
 * @param {string}   [options.contentName] - Nome do produto/conteúdo
 * @param {string}   [options.contentType] - Default: 'product'
 * @param {string}   [options.sourceUrl]   - URL da página de origem
 */
export async function sendCAPIEvent(env, options) {
    const PIXEL_ID = env.META_PIXEL_ID || '1346740157465853';
    const ACCESS_TOKEN = env.META_ACCESS_TOKEN;
    // SITE_URL é variável de ambiente — muda conforme o domínio sem tocar no código
    const DEFAULT_URL = env.SITE_URL || 'https://osegredodasgalinhas.pages.dev/';

    if (!ACCESS_TOKEN) {
        console.warn('[CAPI] META_ACCESS_TOKEN não configurado. Evento não enviado.');
        return false;
    }

    const {
        eventName = 'Purchase',
        eventId,
        customer = {},
        meta = {},
        value = 0,
        currency = 'BRL',
        contentIds = [],
        contentName,
        contentType = 'product',
        sourceUrl = DEFAULT_URL,
    } = options;

    const userData = buildUserData(customer, meta);

    const eventData = {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: sourceUrl,
        action_source: 'website',
        user_data: userData,
    };

    // custom_data — só inclui se houver dados relevantes
    const customData = {};
    if (value > 0) { customData.value = value; customData.currency = currency; }
    if (contentIds.length > 0) { customData.content_ids = contentIds; customData.content_type = contentType; }
    if (contentName) customData.content_name = contentName;
    if (Object.keys(customData).length > 0) eventData.custom_data = customData;

    if (eventId) eventData.event_id = eventId;

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [eventData] }),
        });

        const result = await response.json();

        if (response.ok && result.events_received) {
            const fields = Object.keys(userData).join(', ');
            console.log(`✅ [CAPI] '${eventName}' OK. Fields: ${fields}`);
            return true;
        } else {
            console.error(`❌ [CAPI] Falha '${eventName}':`, JSON.stringify(result));
            return false;
        }
    } catch (error) {
        console.error(`❌ [CAPI] Erro '${eventName}':`, error.message);
        return false;
    }
}
