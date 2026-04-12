// ============================================================
// CHECKOUT — PIX + Cartão via Mercado Pago REST API
// Equivalente às rotas /api/checkout/pix, /api/checkout/card
// e /api/payment/:id do server.js original
// ============================================================

import { Hono } from 'hono';
import { sendEmail } from './email.js';
import { logSale, getAbandons, saveAbandons } from './admin.js';
import { generateDownloadToken } from './utils.js';

export const checkoutRoutes = new Hono();

const MP_API = 'https://api.mercadopago.com/v1/payments';

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
    const { items, customer, facebookEventId, fbc, fbp, userAgent } = await c.req.json();
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
        external_reference: `ORDER-${Date.now()}`,
        notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
        statement_descriptor: 'GALOS MURA BRASIL',
        payer: {
            email: customer.email || 'contatogalosmura@gmail.com',
            first_name: customer.name.split(' ')[0],
            last_name: customer.name.split(' ').slice(1).join(' ') || 'User',
            identification: { type: 'CPF', number: cleanCPF },
        },
        metadata: {
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            facebook_event_id: facebookEventId,
            fbc: fbc,
            fbp: fbp,
            user_agent: userAgent
        },
    };

    const res = await fetch(MP_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MP_TOKEN}`,
            'X-Idempotency-Key': `pix-${Date.now()}-${cleanCPF}`,
        },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || !data.point_of_interaction?.transaction_data?.qr_code) {
        return c.json({ error: getFriendlyError(data) }, 500);
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
    const { items, customer, facebookEventId, fbc, fbp, userAgent } = await c.req.json();
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
        external_reference: `ORDER-${Date.now()}`,
        notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
        statement_descriptor: 'GALOS MURA BRASIL',
        payer: {
            email: customer.email || 'contatogalosmura@gmail.com',
            first_name: customer.name.split(' ')[0],
            last_name: customer.name.split(' ').slice(1).join(' ') || 'Cliente',
            identification: { type: 'CPF', number: cleanCPF },
            // MOCK ADDRESS - Simplicidade máxima
            address: {
                zip_code: '01001000',
                street_name: 'Pça. da Sé',
                street_number: '1',
                neighborhood: 'Sé',
                city: 'São Paulo',
                federal_unit: 'SP'
            }
        },
        metadata: {
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            facebook_event_id: facebookEventId,
            fbc: fbc,
            fbp: fbp,
            user_agent: userAgent
        },
    };

    const res = await fetch(MP_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MP_TOKEN}`,
            'X-Idempotency-Key': `boleto-${Date.now()}-${cleanCPF}`,
        },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
        return c.json({ error: getFriendlyError(data) }, 500);
    }

    // Boleto details typically come in data.transaction_details.external_resource_url and data.barcode
    return c.json({
        id: data.id,
        status: data.status,
        external_resource_url: data.transaction_details?.external_resource_url || data.point_of_interaction?.transaction_data?.ticket_url,
        barcode: data.barcode?.content,
    });
});

// PNG mascarado (Worker repassa Node se NODE_BOLETO_PREVIEW_ORIGIN estiver definido)
checkoutRoutes.get('/boleto/safe-preview', async (c) => {
    const origin = (c.env.NODE_BOLETO_PREVIEW_ORIGIN || '').replace(/\/$/, '');
    if (!origin) {
        return c.json({ error: 'Defina NODE_BOLETO_PREVIEW_ORIGIN ou use assets/boleto-ilustrativo.png no site estático.' }, 503);
    }
    const r = await fetch(`${origin}/api/checkout/boleto/safe-preview`, {
        headers: { Accept: 'image/png' },
    });
    if (!r.ok) return c.json({ error: 'upstream' }, 502);
    const ab = await r.arrayBuffer();
    return new Response(ab, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'private, max-age=60',
        },
    });
});

// ─── CARTÃO ─────────────────────────────────────────────────
checkoutRoutes.post('/card', async (c) => {
    const MP_TOKEN = c.env.MP_ACCESS_TOKEN;
    const BASE_URL = c.env.BASE_URL || 'https://mura-api.joaopaulosantoscamargo.workers.dev';
    const { items, customer, token, installments, payment_method_id, issuer_id, deviceId, facebookEventId, fbc, fbp, userAgent } = await c.req.json();

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
        external_reference: `ORDER-${Date.now()}`,
        notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
        statement_descriptor: 'GALOSMURA',
        payer: {
            email: customer.email || 'contatogalosmura@gmail.com',
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
            facebook_event_id: facebookEventId,
            fbc: fbc,
            fbp: fbp,
            user_agent: userAgent
        },
    };

    const res = await fetch(MP_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MP_TOKEN}`,
            'X-Idempotency-Key': `card-${Date.now()}-${cleanCPF}`,
        },
        body: JSON.stringify(body),
    });

    const result = await res.json();

    if (result.status === 'approved') {
        const isNewSale = await logSale(c.env, customer, items, result.id, 'cartão');
        if (isNewSale) {
            await sendEmail(c.env, customer, items, result.id, facebookEventId); 
        }
        const dlToken = await generateDownloadToken(customer.email, items, result.id, c.env);
        return c.json({ status: 'approved', id: result.id, redirectToken: dlToken });
    } else if (result.status === 'in_process' || result.status === 'pending') {
        return c.json({ status: result.status, status_detail: result.status_detail, id: result.id });
    } else {
        return c.json({ status: result.status, status_detail: result.status_detail }, 400);
    }
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
        const customer = {
            name: metadata.customer_name || `${result.payer?.first_name || ''} ${result.payer?.last_name || ''}`.trim() || 'Cliente',
            email: metadata.customer_email || result.payer?.email || 'galosmurabrasill@gmail.com',
            phone: metadata.customer_phone || 'Sem Telefone',
        };
        const itemTitles = (result.description || 'Produto').split(', ');
        const items = itemTitles.map(title => ({ title, price: result.transaction_amount / itemTitles.length }));
        const isNewSale = await logSale(c.env, customer, items, result.id, result.payment_method_id === 'pix' ? 'pix' : 'cartão');
        
        if (isNewSale) {
            await sendEmail(c.env, customer, items, result.id, metadata.facebook_event_id);
        }
        
        const token = await generateDownloadToken(customer.email, items, result.id, c.env);
        return c.json({ id: result.id, status: result.status, redirectToken: token });
    }

    return c.json({ id: result.id, status: result.status, status_detail: result.status_detail });
});


