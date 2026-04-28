// ============================================================
// ROTA: POST /api/capi-event
// Recebe eventos do browser (com dados do usuário disponíveis
// naquele momento) e repassa para o Meta CAPI server-side.
// Isso garante que o Meta sabe QUEM fez cada ação no funil,
// não só QUE alguém fez.
// ============================================================

import { Hono } from 'hono';
import { sendCAPIEvent } from './capi.js';

export const capiRoutes = new Hono();

/**
 * POST /api/capi-event
 *
 * Body esperado:
 * {
 *   eventName:   string,           // 'PageView' | 'ViewContent' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase'
 *   eventId:     string,           // UUID gerado no browser — mesmo usado no fbq()
 *   sourceUrl:   string,           // URL completa da página onde o evento ocorreu
 *   customer: {                    // Dados disponíveis naquele momento (podem estar parciais)
 *     email?:  string,
 *     phone?:  string,
 *     name?:   string,
 *     cpf?:    string,
 *     city?:   string,
 *     state?:  string,
 *     zip?:    string,
 *   },
 *   fbc?:        string,           // Cookie _fbc do Meta
 *   fbp?:        string,           // Cookie _fbp do Meta
 *   externalId?: string,           // Session ID para match cross-device
 *   value?:      number,
 *   currency?:   string,
 *   contentIds?: string[],
 *   contentName?: string,
 *   contentType?: string,
 * }
 */
capiRoutes.post('/capi-event', async (c) => {
    try {
        const body = await c.req.json();

        const {
            eventName,
            eventId,
            sourceUrl,
            customer = {},
            fbc,
            fbp,
            externalId,
            value,
            currency,
            contentIds,
            contentName,
            contentType,
        } = body;

        if (!eventName) {
            return c.json({ error: 'eventName é obrigatório' }, 400);
        }

        // Captura IP e User-Agent reais do request (não do body)
        // Isso é mais confiável que o que o browser envia
        const clientIp =
            c.req.header('CF-Connecting-IP') ||
            c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
            c.req.header('X-Real-IP') ||
            undefined;

        const userAgent = c.req.header('User-Agent') || undefined;

        // Log de debug (mostra quais campos chegaram — sem dados sensíveis)
        const fields = Object.keys(customer).filter(k => customer[k]);
        console.log(`[CAPI ROUTE] ${eventName} | fields: ${fields.join(', ')} | IP: ${clientIp ? 'ok' : 'n/a'} | UA: ${userAgent ? 'ok' : 'n/a'}`);

        // Dispara o evento — fire-and-forget para não bloquear o browser
        c.executionCtx.waitUntil(
            sendCAPIEvent(c.env, {
                eventName,
                eventId,
                customer,
                meta: { fbc, fbp, clientIp, userAgent, externalId },
                value,
                currency,
                contentIds,
                contentName,
                contentType,
                sourceUrl,
                testCode: body.testCode, // Extraído do corpo do request
            })
        );

        // Responde imediatamente ao browser (não espera o CAPI)
        return c.json({ ok: true, event: eventName });

    } catch (err) {
        console.error('[CAPI ROUTE] Erro:', err.message);
        return c.json({ ok: false, error: err.message }, 500);
    }
});
