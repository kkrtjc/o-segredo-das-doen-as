// ============================================================
// TRACKING — Analytics de eventos
// Equivalente a POST /api/track do server.js
// ============================================================

import { Hono } from 'hono';
import { getAnalytics, saveAnalytics } from './admin.js';
import { today } from './utils.js';

export const trackingRoutes = new Hono();

trackingRoutes.post('/track', async (c) => {
    const { type, isMobile, ctaId } = await c.req.json();
    const analytics = await getAnalytics(c.env);
    const todayStr = today();

    if (!analytics.daily[todayStr]) {
        analytics.daily[todayStr] = {
            clicks: 0, checkoutOpens: 0, uniqueVisits: 0, ctaClicks: 0,
            mobileSessions: 0, desktopSessions: 0, pageViews: 0,
            emailClicks: 0, checkoutAbandons: 0, uiErrors: 0, ctaBreakdown: {}
        };
    }

    const t = analytics.totals;
    const d = analytics.daily[todayStr];
    const inc = (key) => { t[key] = (t[key] || 0) + 1; d[key] = (d[key] || 0) + 1; };

    if (type === 'click') inc('clicks');
    else if (type === 'unique_visit') inc('uniqueVisits');
    else if (type === 'cta_click') {
        inc('ctaClicks');
        if (ctaId) { d.ctaBreakdown = d.ctaBreakdown || {}; d.ctaBreakdown[ctaId] = (d.ctaBreakdown[ctaId] || 0) + 1; }
    }
    else if (type === 'checkout_open') inc('checkoutOpens');
    else if (type === 'checkout_abandon') inc('checkoutAbandons');
    else if (type === 'ui_error' || type === 'checkout_error') inc('uiErrors');
    else if (type === 'session_start') {
        inc('pageViews');
        if (isMobile) inc('mobileSessions'); else inc('desktopSessions');
    }

    await saveAnalytics(c.env, analytics);
    return c.json({ success: true });
});
