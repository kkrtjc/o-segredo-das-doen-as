// ============================================================
// CHECKOUT — PIX + Cartão via Mercado Pago REST API
// Equivalente às rotas /api/checkout/pix, /api/checkout/card
// e /api/payment/:id do server.js original
// ============================================================

import { Hono } from 'hono';
import { logSale } from './admin.js';
import { sendEmail } from './email.js';
import { generateDownloadToken } from './utils.js';
import { FALLBACK_EMAIL } from './constants.js';

export const checkoutRoutes = new Hono();

const MP_API = 'https://api.mercadopago.com/v1/payments';

// Gera uma senha aleatória segura de 8 caracteres para novos clientes
function generatePassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    arr.forEach(b => { pwd += chars[b % chars.length]; });
    return pwd;
}

// Salva a senha na KV e retorna ela
async function saveAndGetPassword(env, cleanCPF) {
    const key = 'pw_' + cleanCPF;
    // Só gera nova senha se não existir ainda (preserva senha de clientes antigos)
    let existing = await env.HISTORY.get(key);
    if (!existing) {
        existing = generatePassword();
        await env.HISTORY.put(key, existing);
    }
    return existing;
}

// Mapeia erros técnicos do MP para mensagens amigáveis
function getFriendlyError(error) {
    const causeMap = {
        2067: 'CPF inválido ou mal formatado.',
        324: 'O CPF informado não é válido.',
        205: 'Número do cartão inválido.',
        208: 'Mês de vencimento inválido.',
        209: 'Ano de vencimento inválido.',
        302: 'Código de segurança (CVV) inválido.',
        301: 'Data de expiração do cartão inválida.',
    };
    if (error?.cause?.[0]) {
        const c = error.cause[0];
        return causeMap[c.code] || causeMap[c.id] || c.description || 'Dados inválidos. Verifique e tente novamente.';
    }
    return error?.message || 'Ocorreu um erro inesperado.';
}

// ─── PIX ────────────────────────────────────────────────────
checkoutRoutes.post('/pix', async (c) => {
    const { items, customer, facebookEventId, fbc, fbp, externalId, userAgent, site, idempotencyKey } = await c.req.json();
    const MP_TOKEN = c.env.MP_ACCESS_TOKEN;
    const BASE_URL = c.env.BASE_URL || 'https://mura-api.joaopaulosantoscamargo.workers.dev';

    const totalAmount = Number(items.reduce((acc, i) => acc + Number(i.price), 0).toFixed(2));
    if (totalAmount <= 0) return c.json({ error: 'Valor inválido.' }, 400);

    const cleanCPF = (customer.cpf || '').replace(/\D/g, '');
    if (cleanCPF.length !== 11) return c.json({ error: 'CPF deve ter 11 dígitos.' }, 400);

    const body = {
        transaction_amount: totalAmount,
        description: items.map(i => i.title).join(', '),
        payment_method_id: 'pix',
        external_reference: `${cleanCPF}-PIX-${Date.now()}`,
        notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
        statement_descriptor: 'GALOS MURA BRASIL',
        payer: {
            email: customer.email || FALLBACK_EMAIL,
            first_name: customer.name.split(' ')[0],
            last_name: customer.name.split(' ').slice(1).join(' ') || 'Cliente',
            identification: { type: 'CPF', number: cleanCPF },
        },
        metadata: {
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            customer_cpf: cleanCPF,
            facebook_event_id: facebookEventId,
            fbc: fbc,
            fbp: fbp,
            user_agent: userAgent,
            site: site || 'app',
            external_id: externalId
        },
    };

    const res = await fetch(MP_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MP_TOKEN}`,
            // Chave de idempotência dinâmica: permite que se o valor mudar ou se o cliente reabrir/gerar novo PIX, gere um novo PIX no Mercado Pago com o valor correto
            'X-Idempotency-Key': c.req.header('X-Idempotency-Key') || idempotencyKey || `pix-${cleanCPF}-${totalAmount.toFixed(2)}-${Date.now()}`,
        },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || !data.point_of_interaction?.transaction_data?.qr_code) {
        return c.json({ error: getFriendlyError(data) }, 500);
    }

    // Registra o lead/PIX imediatamente na lista de abandonos (ou atualiza o existente para evitar duplicatas)
    try {
        const { getAbandons, saveAbandons } = await import('./admin.js');
        const abandons = await getAbandons(c.env);
        const cleanPhone = (customer.phone || '').replace(/\D/g, '').slice(-8);
        const cleanEmail = (customer.email || '').trim().toLowerCase();

        const existingIdx = abandons.findIndex(a => {
            const aCpf = (a.cpf || '').replace(/\D/g, '');
            const aEmail = (a.email || '').trim().toLowerCase();
            const aPhone = (a.phone || '').replace(/\D/g, '').slice(-8);
            return (cleanCPF && aCpf && cleanCPF === aCpf) ||
                   (cleanEmail && aEmail && cleanEmail === aEmail) ||
                   (cleanPhone && aPhone && cleanPhone === aPhone);
        });

        const pixEntry = {
            id: `pix-${data.id}`,
            date: new Date().toISOString(),
            name: customer.name || (existingIdx >= 0 ? abandons[existingIdx].name : ''),
            email: customer.email || (existingIdx >= 0 ? abandons[existingIdx].email : ''),
            phone: customer.phone || (existingIdx >= 0 ? abandons[existingIdx].phone : ''),
            cpf: cleanCPF || (existingIdx >= 0 ? abandons[existingIdx].cpf : ''),
            product: items.map(i => i.title).join(', '),
            total: totalAmount,
            type: 'pix_pending',
            reason: 'PIX Gerado (Aguardando Pagamento)',
            pixGenerated: true,
            pixId: data.id,
            paid: false,
            site: site || 'app'
        };

        if (existingIdx >= 0) {
            abandons[existingIdx] = { ...abandons[existingIdx], ...pixEntry };
        } else {
            abandons.unshift(pixEntry);
        }
        await saveAbandons(c.env, abandons.slice(0, 500));
    } catch (e) {
        console.error('Erro ao registrar abandono PIX', e);
    }

    return c.json({
        qr_code: data.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
        id: data.id,
        status: data.status,
    });
});

// ─── BOLETO ────────────────────────────────────────────────
checkoutRoutes.post('/boleto', async (c) => {
    const { items, customer, facebookEventId, fbc, fbp, externalId, userAgent, site } = await c.req.json();
    const MP_TOKEN = c.env.MP_ACCESS_TOKEN;
    const BASE_URL = c.env.BASE_URL || 'https://mura-api.joaopaulosantoscamargo.workers.dev';

    const totalAmount = Number(items.reduce((acc, i) => acc + Number(i.price), 0).toFixed(2));
    if (totalAmount <= 0) return c.json({ error: 'Valor inválido.' }, 400);

    const cleanCPF = (customer.cpf || '').replace(/\D/g, '');
    if (cleanCPF.length !== 11) return c.json({ error: 'CPF deve ter 11 dígitos.' }, 400);

    // Vencimento de 72 horas
    const expirationDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
    // Ajusta para o formato exigido pelo Mercado Pago (ISO com timezone)
    const offset = expirationDate.getTimezoneOffset();
    const dateOffset = new Date(expirationDate.getTime() - (offset*60*1000));
    const formattedExpiration = dateOffset.toISOString().split('.')[0] + '-03:00'; // Assume time in UTC so offset back to BRT roughly or just standard ISO String. Actually, simple expirationDate.toISOString() usually works globally in MP (because it's UTC).
    // Let's just use standard UTC format:
    const expirationStr = expirationDate.toISOString();

    const body = {
        transaction_amount: totalAmount,
        description: items.map(i => i.title).join(', '),
        payment_method_id: 'bolbradesco',
        date_of_expiration: expirationStr,
        external_reference: `${cleanCPF}-BOLETO-${Date.now()}`,
        notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
        statement_descriptor: 'GALOS MURA BRASIL',
        payer: {
            email: customer.email || FALLBACK_EMAIL,
            first_name: customer.name.split(' ')[0],
            last_name: customer.name.split(' ').slice(1).join(' ') || 'Cliente',
            identification: { type: 'CPF', number: cleanCPF },
            // Endereço exigido pelo BACEN / FEBRABAN para registro de boleto
            address: {
                zip_code: (customer.zip_code || customer.cep || '01310100').replace(/\D/g, '').padStart(8, '0').slice(0, 8),
                street_name: customer.street_name || 'Av Paulista',
                street_number: customer.street_number ? String(customer.street_number) : '1000',
                neighborhood: customer.neighborhood || 'Bela Vista',
                city: customer.city || 'São Paulo',
                federal_unit: customer.state || 'SP'
            }
        },
        metadata: {
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            customer_cpf: cleanCPF,
            facebook_event_id: facebookEventId,
            fbc: fbc,
            fbp: fbp,
            user_agent: userAgent,
            site: site || 'app',
            external_id: externalId
        },
    };

    const res = await fetch(MP_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MP_TOKEN}`,
            // Estável por janela de 30min — evita dupla cobrança por clique duplo
            'X-Idempotency-Key': `boleto-${cleanCPF}-${Math.floor(Date.now() / 1800000)}`,
        },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
        console.error('[BOLETO MP ERROR]', JSON.stringify(data));
        return c.json({ error: getFriendlyError(data) }, 500);
    }

    // Registra o lead/Boleto imediatamente na lista de abandonos para recuperação
    try {
        const { getAbandons, saveAbandons } = await import('./admin.js');
        const abandons = await getAbandons(c.env);
        const now = new Date().toISOString();
        const existingIdx = abandons.findIndex(a => 
            (cleanCPF && a.cpf === cleanCPF) || 
            (customer.email && a.email === customer.email) ||
            (customer.phone && a.phone === customer.phone)
        );

        const newEntry = {
            id: 'boleto_' + data.id,
            name: customer.name || 'Cliente Boleto',
            email: customer.email || '',
            phone: customer.phone || '',
            cpf: cleanCPF,
            total: totalAmount,
            products: items.map(i => i.title).join(', '),
            date: now,
            reason: 'Boleto Gerado (Aguardando)',
            status: 'pending_boleto',
            paymentId: data.id,
            paymentMethod: 'boleto'
        };

        if (existingIdx >= 0) {
            abandons[existingIdx] = { ...abandons[existingIdx], ...newEntry };
        } else {
            abandons.unshift(newEntry);
        }
        if (abandons.length > 500) abandons.pop();
        await saveAbandons(c.env, abandons);
    } catch (e) {
        console.warn('[ABANDON] Erro ao registrar lead Boleto:', e.message);
    }

    // Boleto details typically come in data.transaction_details.external_resource_url and data.barcode
    return c.json({
        id: data.id,
        status: data.status,
        external_resource_url: data.transaction_details?.external_resource_url || data.point_of_interaction?.transaction_data?.ticket_url,
        barcode: data.barcode?.content,
    });
});

// Nota: A rota /boleto/safe-preview foi removida.
// A imagem ilustrativa do boleto é servida diretamente pelo site estático (Cloudflare Pages).

// ─── CARTÃO ─────────────────────────────────────────────────
checkoutRoutes.post('/card', async (c) => {
    const MP_TOKEN = c.env.MP_ACCESS_TOKEN;
    const BASE_URL = c.env.BASE_URL || 'https://mura-api.joaopaulosantoscamargo.workers.dev';
    const { items, customer, token, installments, payment_method_id, issuer_id, deviceId, facebookEventId, fbc, fbp, externalId, userAgent, site, idempotencyKey } = await c.req.json();
    const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();

    const totalAmount = Number(items.reduce((acc, i) => acc + Number(i.price), 0).toFixed(2));
    if (totalAmount <= 0) return c.json({ error: 'Valor inválido.' }, 400);

    const cleanCPF = (customer.cpf || '').replace(/\D/g, '');
    if (cleanCPF.length !== 11) return c.json({ error: 'CPF deve ter 11 dígitos.' }, 400);

    const cleanPhone = (customer.phone || '').replace(/\D/g, '');

    const body = {
        transaction_amount: totalAmount,
        token,
        description: items.map(i => i.title).join(', ').slice(0, 256),
        installments: Number(installments) || 1,
        payment_method_id,
        issuer_id: issuer_id || null,
        binary_mode: false,
        capture: true,
        external_reference: `${cleanCPF}-CARD-${Date.now()}`,
        notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
        statement_descriptor: 'GALOSMURA',
        payer: {
            email: customer.email || FALLBACK_EMAIL,
            first_name: customer.name.split(' ')[0],
            last_name: customer.name.split(' ').slice(1).join(' ') || 'Cliente',
            identification: { type: 'CPF', number: cleanCPF },
            phone: {
                area_code: cleanPhone.slice(0, 2) || '11',
                number: cleanPhone.slice(2) || '999999999',
            },
        },
        additional_info: {
            items: items.map((item, idx) => ({
                id: item.id || `item-${idx}`,
                title: item.title.slice(0, 256),
                description: (item.description || item.title).slice(0, 256),
                category_id: 'others',
                quantity: 1,
                unit_price: Number(item.price),
            })),
            payer: {
                first_name: customer.name.split(' ')[0],
                last_name: customer.name.split(' ').slice(1).join(' ') || 'Cliente',
                device_id: deviceId || undefined,
            },
        },
        metadata: {
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            customer_cep: customer.cep,
            customer_cpf: cleanCPF,
            facebook_event_id: facebookEventId,
            fbc: fbc,
            fbp: fbp,
            user_agent: userAgent,
            site: site || 'app',
            external_id: externalId
        },
    };

    const res = await fetch(MP_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MP_TOKEN}`,
            'X-Idempotency-Key': c.req.header('X-Idempotency-Key') || idempotencyKey || `card-${cleanCPF}-${token}-${totalAmount.toFixed(2)}`,
        },
        body: JSON.stringify(body),
    });

    const result = await res.json();

    if (result.status === 'approved') {
        // Lock anti-duplicidade (mesmo usado no webhook)
        const lockKey = `lock_${result.id}`;
        const isLocked = await c.env.HISTORY.get(lockKey);
        
        // Gera/recupera senha do cliente
        const senha = await saveAndGetPassword(c.env, cleanCPF);

        if (!isLocked) {
            // Aplica o lock imediatamente
            await c.env.HISTORY.put(lockKey, 'locked', { expirationTtl: 7200 });
            
            const isNewSale = await logSale(c.env, customer, items, result.id, 'cartão', site || 'app');
            if (isNewSale) {
                await sendEmail(c.env, customer, items, result.id, facebookEventId, fbc, fbp, userAgent, clientIp, site || 'app', externalId, senha); 
            }
        }
        
        const dlToken = await generateDownloadToken(customer.email, items, result.id, c.env);
        return c.json({ status: 'approved', id: result.id, redirectToken: dlToken, senha });
    } else if (result.status === 'in_process' || result.status === 'pending') {
        // Registra cartão em análise/pendente
        try {
            const { getAbandons, saveAbandons } = await import('./admin.js');
            const abandons = await getAbandons(c.env);
            abandons.unshift({
                id: `card-pending-${Date.now()}`,
                date: new Date().toISOString(),
                name: customer.name || '',
                email: customer.email || '',
                phone: customer.phone || '',
                cpf: cleanCPF,
                product: items.map(i => i.title).join(', '),
                total: totalAmount,
                type: 'card_pending',
                reason: result.status_detail || 'Pagamento em análise',
                paid: false,
                site: site || 'app'
            });
            await saveAbandons(c.env, abandons.slice(0, 500));
        } catch (e) {
            console.error('Erro ao registrar abandono cartão pendente', e);
        }
        return c.json({ status: result.status, status_detail: result.status_detail, id: result.id });
    } else {
        // CARTÃO RECUSADO! Salva imediatamente em ABANDONS com todos os dados do cliente
        try {
            const { getAbandons, saveAbandons } = await import('./admin.js');
            const abandons = await getAbandons(c.env);
            abandons.unshift({
                id: `card-fail-${Date.now()}`,
                date: new Date().toISOString(),
                name: customer.name || '',
                email: customer.email || '',
                phone: customer.phone || '',
                cpf: cleanCPF,
                product: items.map(i => i.title).join(', '),
                total: totalAmount,
                type: 'card_declined',
                reason: result.status_detail || result.status || 'Cartão Recusado',
                paid: false,
                site: site || 'app'
            });
            await saveAbandons(c.env, abandons.slice(0, 500));
        } catch (e) {
            console.error('Erro ao registrar abandono cartão recusado', e);
        }

        const errorMsg = getFriendlyError(result);
        return c.json({ 
            status: result.status || 'rejected', 
            status_detail: result.status_detail || errorMsg, 
            error: errorMsg,
            message: result.message || errorMsg
        }, 400);
    }
});

// ─── ASSINATURA RECORRENTE AUTOMÁTICA NO CARTÃO (PREAPPROVAL) ──
checkoutRoutes.post('/subscription', async (c) => {
    const MP_TOKEN = c.env.MP_ACCESS_TOKEN;
    const { items, customer, token, plan, site } = await c.req.json();

    const price = Number(items?.[0]?.price || 39.90);
    const title = items?.[0]?.title || 'Mura Manager - Assinatura Mensal';
    const cleanCPF = (customer.cpf || '').replace(/\D/g, '');
    const cleanEmail = (customer.email || '').trim().toLowerCase();

    if (!cleanEmail || cleanCPF.length !== 11 || !token) {
        return c.json({ error: 'Dados cadastrais incompletos para criação da assinatura recorrente.' }, 400);
    }

    const body = {
        payer_email: cleanEmail,
        back_url: 'https://mura-manager.pages.dev',
        reason: title.slice(0, 256),
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: price,
            currency_id: 'BRL'
        },
        card_token_id: token,
        status: 'authorized',
        external_reference: `${cleanCPF}-SUB-${Date.now()}`
    };

    const res = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MP_TOKEN}`
        },
        body: JSON.stringify(body)
    });

    const result = await res.json();

    if (result.status === 'authorized') {
        try {
            const customerObj = {
                name: customer.name || 'Cliente',
                email: cleanEmail,
                phone: customer.phone || '',
                cpf: cleanCPF
            };
            await logSale(c.env, customerObj, [{ title, price }], result.id, 'assinatura_cartão', site || 'mura_app');
        } catch (e) {
            console.error('Erro ao registrar venda de assinatura:', e);
        }

        return c.json({
            status: 'approved',
            subscription_id: result.id,
            id: result.id,
            reason: result.reason,
            auto_recurring: result.auto_recurring
        });
    }

    const errorMsg = getFriendlyError(result);
    return c.json({
        status: result.status || 'rejected',
        status_detail: result.message || errorMsg,
        error: errorMsg || 'Não foi possível autorizar a assinatura recorrente com este cartão. Verifique o limite ou utilize outro cartão.'
    }, 400);
});

// ─── STATUS DO PAGAMENTO (Polling) ──────────────────────────
checkoutRoutes.get('/payment/:id', async (c) => {
    const MP_TOKEN = c.env.MP_ACCESS_TOKEN;
    const res = await fetch(`${MP_API}/${c.req.param('id')}`, {
        headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    const result = await res.json();

    if (result.status === 'approved') {
        const metadata = result.metadata || {};
        const cleanCPF = (metadata.customer_cpf || result.payer?.identification?.number || '').replace(/\D/g, '');
        const customer = {
            name: metadata.customer_name || `${result.payer?.first_name || ''} ${result.payer?.last_name || ''}`.trim() || 'Cliente',
            email: metadata.customer_email || result.payer?.email || 'galosmurabrasill@gmail.com',
            phone: metadata.customer_phone || 'Sem Telefone',
            cpf: cleanCPF || 'Sem CPF',
        };
        const itemTitles = (result.description || 'Produto').split(', ');
        const items = itemTitles.map(title => ({ title, price: result.transaction_amount / itemTitles.length }));
        const isNewSale = await logSale(c.env, customer, items, result.id, result.payment_method_id === 'pix' ? 'pix' : 'cartão', metadata.site || 'app');
        
        // Gera/recupera senha do cliente
        const senha = cleanCPF ? await saveAndGetPassword(c.env, cleanCPF) : null;

            if (isNewSale) {
                const clientIpStatus = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
                await sendEmail(c.env, customer, items, result.id, 
                    metadata.facebook_event_id, 
                    metadata.fbc, 
                    metadata.fbp, 
                    metadata.user_agent,
                    clientIpStatus,
                    metadata.site || 'app',
                    metadata.external_id,
                    senha
                ); 
            }
        
        const token = await generateDownloadToken(customer.email, items, result.id, c.env);
        return c.json({ id: result.id, status: result.status, redirectToken: token, senha });
    }

    return c.json({ id: result.id, status: result.status, status_detail: result.status_detail });
});


