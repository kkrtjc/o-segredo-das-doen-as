// ============================================================
// ADMIN — Config, History, Analytics, Leads, Abandons
// Equivalente a todas as rotas /api/* do server.js
// ============================================================

import { Hono } from 'hono';
import { today } from './utils.js';

export const adminRoutes = new Hono();

// ─── HELPERS KV ─────────────────────────────────────────────

export async function getDB(env) {
    const raw = await env.CONFIG.get('db');
    if (!raw) return { products: {}, orderBumps: {}, settings: { enableOrderBump: true } };
    return JSON.parse(raw);
}
export async function saveDB(env, data) {
    await env.CONFIG.put('db', JSON.stringify(data));
}

export async function getHistory(env) {
    const raw = await env.HISTORY.get('list');
    return raw ? JSON.parse(raw) : [];
}
export async function saveHistory(env, data) {
    await env.HISTORY.put('list', JSON.stringify(data));
}

export async function getLeads(env) {
    const raw = await env.LEADS.get('list');
    return raw ? JSON.parse(raw) : [];
}
export async function saveLeads(env, data) {
    await env.LEADS.put('list', JSON.stringify(data));
}

export async function getAbandons(env) {
    const raw = await env.ABANDONS.get('list');
    return raw ? JSON.parse(raw) : [];
}
export async function saveAbandons(env, data) {
    await env.ABANDONS.put('list', JSON.stringify(data));
}

export async function getAnalytics(env) {
    const raw = await env.ANALYTICS.get('data');
    const base = {
        totals: { clicks: 0, checkoutOpens: 0, uniqueVisits: 0, ctaClicks: 0, mobileSessions: 0, desktopSessions: 0, pageViews: 0, emailClicks: 0, checkoutAbandons: 0, uiErrors: 0 },
        daily: {}
    };
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return { ...base, ...parsed, totals: { ...base.totals, ...(parsed.totals || {}) } };
}
export async function saveAnalytics(env, data) {
    await env.ANALYTICS.put('data', JSON.stringify({ totals: data.totals, daily: data.daily }));
}

// ─── LOG SALE ────────────────────────────────────────────────
export async function logSale(env, customer, items, paymentId, method) {
    const history = await getHistory(env);
    if (history.some(h => String(h.paymentId) === String(paymentId))) return false;
    history.push({
        id: paymentId, paymentId,
        date: new Date().toISOString(),
        name: customer.name, email: customer.email, phone: customer.phone,
        items: items.map(i => i.title),
        total: items.reduce((acc, i) => acc + Number(i.price), 0),
        method, status: 'approved'
    });
    await saveHistory(env, history);
    return true;
}

// ─── CONFIG ──────────────────────────────────────────────────
adminRoutes.get('/config', async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(await getDB(c.env));
});

adminRoutes.post('/config/update', async (c) => {
    const { password, data } = await c.req.json();
    if (password !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
    if (!data?.products) return c.json({ error: 'Dados inválidos' }, 400);
    await saveDB(c.env, data);
    return c.json({ success: true });
});

adminRoutes.post('/config/reset', async (c) => {
    const { password } = await c.req.json();
    if (password !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
    const defaultDB = {
        products: {
            'ebook-doencas': {
                title: 'PROTOCOLO ELITE: A Cura das Aves', price: 89.90, originalPrice: 149.90,
                description: 'Protocolo Elite Doenças', isFeatured: true, badge: 'OFERTA PRINCIPAL',
                features: ['11 Doenças Documentadas', 'Tabelas de Sintomas', 'Protocolos de Tratamento', 'Bônus: Tabela de Ração (no PIX)'],
                cover: 'capadasdoencas.webp', orderBumps: ['combo-elite-bump']
            },
            'ebook-manejo': {
                title: 'Manejo de Pintinhos (Upsell)', price: 49.9, originalPrice: 99, enabled: true,
                description: 'Manual de Criação', cover: 'capadospintinhos.webp', orderBumps: []
            },
            'combo-elite': {
                title: 'COMBO CRIADOR ELITE', price: 139.80, originalPrice: 249.70,
                description: 'O Guia Completo', badge: 'MAIS VENDIDO', cover: 'combo', orderBumps: []
            }
        },
        orderBumps: {
            'combo-elite-bump': { id: 'combo-elite-bump', title: 'Combo Criador Elite', price: 49.90, description: 'O protocolo completo — doenças, pintinhos e tabela de ração em um único pacote.', image: 'capadospintinhos.webp' }
        }
    };
    await saveDB(c.env, defaultDB);
    return c.json({ success: true });
});

// ─── PRODUCTS ────────────────────────────────────────────────
adminRoutes.get('/products/:id', async (c) => {
    c.header('Cache-Control', 'no-store');
    const db = await getDB(c.env);
    const product = db.products[c.req.param('id')];
    if (!product) return c.json({ error: 'Produto não encontrado' }, 404);
    const bumps = (product.orderBumps || []).map(id => {
        const b = db.orderBumps[id] || db.products[id];
        return b ? { ...b, id } : null;
    }).filter(Boolean);
    return c.json({ ...product, fullBumps: bumps });
});

// ─── HISTORY ─────────────────────────────────────────────────
adminRoutes.get('/history', async (c) => {
    const pw = c.req.header('x-admin-password') || c.req.query('password');
    if (pw !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
    return c.json(await getHistory(c.env));
});

adminRoutes.post('/history/clear', async (c) => {
    const { password } = await c.req.json();
    if (password !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
    await saveHistory(c.env, []);
    return c.json({ success: true });
});

adminRoutes.post('/history/resend-email', async (c) => {
    const { paymentId, password } = await c.req.json();
    if (password !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
    const history = await getHistory(c.env);
    const sale = history.find(h => h.paymentId === paymentId);
    if (!sale) return c.json({ error: 'Venda não encontrada' }, 404);
    const { sendEmail } = await import('./email.js');
    const customer = { name: sale.name, email: sale.email, phone: sale.phone };
    const items = (sale.items || []).map(title => ({ title }));
    const ok = await sendEmail(c.env, customer, items, paymentId);
    return c.json(ok ? { success: true } : { error: 'Falha ao enviar e-mail' }, ok ? 200 : 500);
});

// ─── ANALYTICS ───────────────────────────────────────────────
adminRoutes.get('/analytics', async (c) => {
    const analytics = await getAnalytics(c.env);
    const history = await getHistory(c.env);
    const approved = history.filter(h => h.total > 0);
    return c.json({
        ...analytics,
        totalRevenue: approved.reduce((a, s) => a + Number(s.total), 0),
        approvedCount: approved.length,
        historyCount: history.length,
    });
});

// ─── LEADS ───────────────────────────────────────────────────
adminRoutes.get('/leads', async (c) => {
    const pw = c.req.header('x-admin-password') || c.req.query('password');
    if (pw !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
    return c.json(await getLeads(c.env));
});

adminRoutes.post('/leads', async (c) => {
    const { name, phone, source } = await c.req.json();
    if (!phone) return c.json({ error: 'WhatsApp é obrigatório' }, 400);
    const leads = await getLeads(c.env);
    if (leads.find(l => l.phone === phone)) return c.json({ success: true, message: 'Lead já cadastrado' });
    leads.push({ id: Date.now().toString(), date: new Date().toISOString(), name: name || 'Sem Nome', phone, source: source || 'unknown' });
    await saveLeads(c.env, leads);
    return c.json({ success: true });
});

// ─── ABANDONS ────────────────────────────────────────────────
adminRoutes.get('/abandons', async (c) => {
    const pw = c.req.header('x-admin-password') || c.req.query('password');
    if (pw !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
    return c.json(await getAbandons(c.env));
});

adminRoutes.post('/abandon', async (c) => {
    const { name, email, phone, product, pixGenerated, pixId } = await c.req.json();
    if (!phone && !email) return c.json({ error: 'Contato não fornecido' }, 400);
    const abandons = await getAbandons(c.env);
    const todayStr = today();
    const existing = abandons.find(a => (a.phone === phone || (a.email && a.email === email)) && a.date.startsWith(todayStr));
    if (existing) {
        if (name && !existing.name) existing.name = name;
        if (pixGenerated && !existing.pixGenerated) { existing.pixGenerated = true; existing.pixId = pixId; }
        await saveAbandons(c.env, abandons);
        return c.json({ success: true });
    }
    abandons.push({ id: Date.now().toString(), date: new Date().toISOString(), name: name || '', email: email || '', phone: phone || '', product: product || 'unknown', pixGenerated: pixGenerated || false, pixId: pixId || null, paid: false });
    await saveAbandons(c.env, abandons);
    return c.json({ success: true });
});

adminRoutes.post('/abandon/convert', async (c) => {
    const { pixId } = await c.req.json();
    if (!pixId) return c.json({ error: 'pixId obrigatório' }, 400);
    const abandons = await getAbandons(c.env);
    const idx = abandons.findIndex(a => a.pixId === String(pixId));
    if (idx > -1) { abandons[idx].paid = true; abandons[idx].paidAt = new Date().toISOString(); }
    await saveAbandons(c.env, abandons);
    return c.json({ success: true });
});
