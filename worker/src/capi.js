// ============================================================
// META CONVERSIONS API (CAPI) — Server-Side Event Tracking
// Envia eventos diretamente para o Meta via graph.facebook.com
// para garantir atribuição confiável das conversões
// ============================================================

import { createHash } from 'node:crypto';

const GRAPH_API_VERSION = 'v21.0';

/**
 * Hash SHA-256 para dados do usuário (exigido pelo Meta CAPI)
 */
function sha256(value) {
    if (!value || typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Normaliza telefone para formato E.164 (Brasil)
 */
function normalizePhone(phone) {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) return '55' + digits;
    if (digits.length === 13 && digits.startsWith('55')) return digits;
    return '55' + digits;
}

/**
 * Envia evento Purchase para a Meta Conversions API
 * 
 * @param {Object} env - Cloudflare Worker env (contém secrets)
 * @param {Object} options
 * @param {string} options.eventName - Nome do evento (ex: 'Purchase')
 * @param {string} options.eventId - ID do evento para deduplicação com pixel browser
 * @param {Object} options.customer - Dados do cliente { name, email, phone }
 * @param {number} options.value - Valor da compra
 * @param {string} options.currency - Moeda (default: 'BRL')
 * @param {string[]} options.contentIds - IDs dos produtos
 * @param {string} options.fbc - Cookie _fbc do Meta
 * @param {string} options.fbp - Cookie _fbp do Meta
 * @param {string} options.userAgent - User-Agent do cliente
 * @param {string} options.clientIp - IP do cliente
 * @param {string} options.sourceUrl - URL da página de origem
 */
export async function sendCAPIEvent(env, options) {
    const PIXEL_ID = env.META_PIXEL_ID || '1346740157465853';
    const ACCESS_TOKEN = env.META_ACCESS_TOKEN;

    if (!ACCESS_TOKEN) {
        console.warn('[CAPI] META_ACCESS_TOKEN não configurado. Evento não enviado.');
        return false;
    }

    const {
        eventName = 'Purchase',
        eventId,
        customer = {},
        value = 0,
        currency = 'BRL',
        contentIds = [],
        fbc,
        fbp,
        userAgent,
        clientIp,
        sourceUrl = 'https://osegredodasgalinhas.pages.dev/'
    } = options;

    // Dados do usuário com hash SHA-256 (obrigatório pelo Meta)
    const userData = {};

    if (customer.email) {
        userData.em = [sha256(customer.email)];
    }
    if (customer.phone) {
        const normalizedPhone = normalizePhone(customer.phone);
        if (normalizedPhone) {
            userData.ph = [sha256(normalizedPhone)];
        }
    }
    if (customer.name) {
        const nameParts = customer.name.trim().split(' ');
        if (nameParts[0]) userData.fn = [sha256(nameParts[0])];
        if (nameParts.length > 1) userData.ln = [sha256(nameParts[nameParts.length - 1])];
    }

    // Parâmetros de atribuição
    if (fbc) userData.fbc = fbc;
    if (fbp) userData.fbp = fbp;
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;

    // País padrão Brasil
    userData.country = [sha256('br')];

    const eventData = {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: sourceUrl,
        action_source: 'website',
        user_data: userData,
        custom_data: {
            value: value,
            currency: currency,
            content_ids: contentIds,
            content_type: 'product'
        }
    };

    // Event ID para deduplicação com pixel do browser
    if (eventId) {
        eventData.event_id = eventId;
    }

    const payload = {
        data: [eventData]
    };

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.events_received) {
            console.log(`✅ [CAPI] Evento '${eventName}' enviado com sucesso. Events received: ${result.events_received}`);
            return true;
        } else {
            console.error(`❌ [CAPI] Falha ao enviar '${eventName}':`, JSON.stringify(result));
            return false;
        }
    } catch (error) {
        console.error(`❌ [CAPI] Erro de rede ao enviar '${eventName}':`, error.message);
        return false;
    }
}
