// ============================================================
// WEBHOOKS — Mercado Pago
// Equivalente a POST /api/webhooks/mercadopago do server.js
// ============================================================

import { Hono } from 'hono';
import { logSale, getAbandons, saveAbandons } from './admin.js';
import { sendEmail } from './email.js';
import crypto from 'node:crypto';

export const webhookRoutes = new Hono();

webhookRoutes.post('/mercadopago', async (c) => {
    const MP_TOKEN = c.env.MP_ACCESS_TOKEN;
    const WEBHOOK_SECRET = c.env.MP_WEBHOOK_SECRET;
    
    let body = {};
    try { body = await c.req.json(); } catch (_) {}

    const topic = c.req.query('topic') || c.req.query('type') || body.topic || body.type || body.action;
    const paymentId = c.req.query('data.id') || c.req.query('id') || body.data?.id || body.id;

    if (!paymentId) return c.text('OK', 200);

    // Validação de assinatura do webhook do Mercado Pago (Segurança)
    if (WEBHOOK_SECRET) {
        const xSignature = c.req.header('x-signature') || '';
        const xRequestId = c.req.header('x-request-id') || '';
        
        const parts = xSignature.split(',');
        const tsPart = parts.find(p => p.trim().startsWith('ts='));
        const v1Part = parts.find(p => p.trim().startsWith('v1='));
        
        if (!tsPart || !v1Part) {
            console.error('[WEBHOOK ERROR] Cabeçalho x-signature inválido ou ausente');
            return c.text('Assinatura ausente ou inválida', 400);
        }
        
        const ts = tsPart.split('=')[1];
        const v1 = v1Part.split('=')[1];
        
        const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
        const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
        hmac.update(manifest);
        const expectedSignature = hmac.digest('hex');
        
        if (expectedSignature !== v1) {
            console.error(`[WEBHOOK ERROR] Assinatura inválida para o pagamento ${paymentId}`);
            return c.text('Assinatura inválida', 403);
        }
        console.log(`[WEBHOOK] Assinatura validada com sucesso para o pagamento ${paymentId}`);
    } else {
        console.warn('[WEBHOOK WARNING] MP_WEBHOOK_SECRET não está configurado. Validação de assinatura ignorada.');
    }

    if (topic && topic.includes('payment')) {
        // Processa em background para liberar o Mercado Pago em < 50ms e evitar timeouts/retries duplicados
        c.executionCtx.waitUntil((async () => {
            try {
                const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                    headers: { Authorization: `Bearer ${MP_TOKEN}` },
                });
                const payment = await res.json();

                if (payment.status === 'approved') {
                    const metadata = payment.metadata || {};
                    const customer = {
                        name: metadata.customer_name || `${payment.payer?.first_name || ''} ${payment.payer?.last_name || ''}`.trim() || 'Cliente',
                        email: metadata.customer_email || payment.payer?.email || 'galosmurabrasill@gmail.com',
                        phone: metadata.customer_phone || 'Sem Telefone',
                        cpf: metadata.customer_cpf || payment.payer?.identification?.number || 'Sem CPF',
                    };
                    const itemTitles = (payment.description || 'Produto').split(', ');
                    const items = itemTitles.map(title => ({
                        title,
                        price: payment.transaction_amount / itemTitles.length,
                    }));

                    // Lock anti-duplicidade na KV HISTORY (dura 2 horas)
                    const lockKey = `lock_${paymentId}`;
                    const isLocked = await c.env.HISTORY.get(lockKey);
                    
                    if (isLocked) {
                        console.log(`[WEBHOOK] Disparo duplicado ignorado pelo lock: ${paymentId}`);
                        return;
                    }
                    
                    // Aplica o lock imediatamente
                    await c.env.HISTORY.put(lockKey, 'locked', { expirationTtl: 7200 });

                    const isNewSale = await logSale(c.env, customer, items, paymentId, payment.payment_method_id === 'pix' ? 'pix' : 'cartão', metadata.site || 'app');

                    // Marcar abandono como pago
                    const abandons = await getAbandons(c.env);
                    const idx = abandons.findIndex(a => String(a.pixId) === String(paymentId));
                    if (idx > -1 && !abandons[idx].paid) {
                        abandons[idx].paid = true;
                        abandons[idx].paidAt = new Date().toISOString();
                        await saveAbandons(c.env, abandons);
                    }

                    // Envia e-mail e dados CAPI se for novo
                    if (isNewSale) {
                        const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
                        const { sendEmail } = await import('./email.js');
                        await sendEmail(c.env, customer, items, paymentId, 
                            metadata.facebook_event_id, 
                            metadata.fbc, 
                            metadata.fbp, 
                            metadata.user_agent,
                            clientIp,
                            metadata.site || 'app',
                            metadata.external_id); // Passa o session_id original para match no Meta
                    }
                }
            } catch (e) {
                console.error('[WEBHOOK ERROR]', e.message);
            }
        })());
    }

    return c.text('OK', 200);
});
