// ============================================================
// WEBHOOKS — Mercado Pago
// Equivalente a POST /api/webhooks/mercadopago do server.js
// ============================================================

import { Hono } from 'hono';
import { logSale, getAbandons, saveAbandons } from './admin.js';
import { sendEmail } from './email.js';

export const webhookRoutes = new Hono();

webhookRoutes.post('/mercadopago', async (c) => {
    const MP_TOKEN = c.env.MP_ACCESS_TOKEN;
    let body = {};
    try { body = await c.req.json(); } catch (_) {}

    const topic = c.req.query('topic') || c.req.query('type') || body.topic || body.type || body.action;
    const paymentId = c.req.query('id') || body.data?.id || body.id;

    if (!paymentId) return c.text('OK', 200);

    if (topic && topic.includes('payment')) {
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
                    return c.text('OK', 200);
                }
                
                // Aplica o lock imediatamente
                await c.env.HISTORY.put(lockKey, 'locked', { expirationTtl: 7200 });

                const isNewSale = await logSale(c.env, customer, items, paymentId, payment.payment_method_id === 'pix' ? 'pix' : 'cartão');

                // Marcar abandono como pago
                const abandons = await getAbandons(c.env);
                const idx = abandons.findIndex(a => a.pixId === String(paymentId));
                if (idx > -1 && !abandons[idx].paid) {
                    abandons[idx].paid = true;
                    abandons[idx].paidAt = new Date().toISOString();
                    await saveAbandons(c.env, abandons);
                }

                // Envia e-mail e dados CAPI se for novo
                if (isNewSale) {
                    await sendEmail(c.env, customer, items, paymentId, 
                        metadata.facebook_event_id, 
                        metadata.fbc, 
                        metadata.fbp, 
                        metadata.user_agent);
                }
            }
        } catch (e) {
            console.error('[WEBHOOK ERROR]', e.message);
        }
    }

    return c.text('OK', 200);
});
