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

export async function getClientActivities(env) {
    const raw = await env.HISTORY.get('client_activities');
    return raw ? JSON.parse(raw) : {};
}
export async function saveClientActivities(env, data) {
    await env.HISTORY.put('client_activities', JSON.stringify(data));
}


// ─── LOG SALE ────────────────────────────────────────────────
export async function logSale(env, customer, items, paymentId, method, site = 'app') {
    const history = await getHistory(env);
    if (history.some(h => String(h.paymentId) === String(paymentId))) return false;

    const bEmail = (customer.email || '').trim().toLowerCase();
    const bPhone = (customer.phone || '').replace(/\D/g, '');
    const bPhoneShort = bPhone.slice(-8);
    const bCpf = (customer.cpf || '').replace(/\D/g, '');

    let hasExistingAccount = false;
    let customerPassword = null;

    // Sincroniza imediatamente com free_users se o comprador for um usuário registrado no app
    try {
        const rawFree = await env.HISTORY.get('free_users');
        if (rawFree) {
            const freeUsers = JSON.parse(rawFree);
            const idx = freeUsers.findIndex(u => 
                (bEmail && u.email && u.email.toLowerCase() === bEmail) ||
                (bPhoneShort && u.phone && u.phone.replace(/\D/g, '').slice(-8) === bPhoneShort) ||
                (bCpf && u.cpf && u.cpf.replace(/\D/g, '') === bCpf)
            );
            if (idx !== -1) {
                hasExistingAccount = true;
                if (freeUsers[idx].password) {
                    customerPassword = freeUsers[idx].password.trim();
                }
                const prodSet = new Set(freeUsers[idx].products || []);
                const titleStr = items.map(i => (typeof i === 'string' ? i : i.title || '').toLowerCase()).join(' ');
                if (titleStr.includes('doença') || titleStr.includes('doenca') || titleStr.includes('cura das aves') || titleStr.includes('elite') || titleStr.includes('protocolo') || titleStr.includes('combo')) {
                    prodSet.add('ebook-doencas');
                }
                if (titleStr.includes('tabela') || titleStr.includes('ração') || titleStr.includes('racao') || titleStr.includes('bump') || titleStr.includes('combo-plataforma') || titleStr.includes('combo completo') || titleStr.includes('acesso completo')) {
                    prodSet.add('tabela-racao');
                }
                if (titleStr.includes('manejo') || titleStr.includes('pintinho') || titleStr.includes('combo-elite')) {
                    prodSet.add('ebook-manejo');
                }
                if (bCpf && !freeUsers[idx].cpf) freeUsers[idx].cpf = bCpf;
                freeUsers[idx].products = Array.from(prodSet);
                await env.HISTORY.put('free_users', JSON.stringify(freeUsers));
            }
        }
    } catch (e) {
        console.error('[LOGSALE FREE_USERS SYNC ERROR]', e);
    }

    // Se encontrou usuário existente, vincula a senha original ao CPF no KV
    if (customerPassword && bCpf) {
        try {
            await env.HISTORY.put('pw_' + bCpf, customerPassword);
        } catch (e) {
            console.error('[LOGSALE PW SYNC ERROR]', e);
        }
    } else if (bCpf) {
        // Se novo cliente, verifica se já havia senha salva no KV, senão define os 4 dígitos do CPF
        try {
            const stored = await env.HISTORY.get('pw_' + bCpf);
            if (stored) {
                customerPassword = stored;
            } else {
                customerPassword = bCpf.length >= 4 ? bCpf.slice(0, 4) : '1234';
                await env.HISTORY.put('pw_' + bCpf, customerPassword);
            }
        } catch (_) {
            customerPassword = bCpf.length >= 4 ? bCpf.slice(0, 4) : '1234';
        }
    }

    history.push({
        id: paymentId, paymentId,
        date: new Date().toISOString(),
        customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            cpf: customer.cpf
        },
        items: items.map(i => (typeof i === 'string' ? i : i.title)),
        total: items.reduce((acc, i) => acc + Number(i.price || 0), 0),
        method, status: 'approved',
        site: site,
        password: customerPassword,
        hasExistingAccount: hasExistingAccount
    });
    await saveHistory(env, history);

    // Remove qualquer trava de teste temporário expirado ao efetuar uma nova compra no site
    const buyerCleanCpf = (customer.cpf || '').replace(/\D/g, '');
    if (buyerCleanCpf) {
        try { await env.HISTORY.delete('exp_' + buyerCleanCpf); } catch (_) {}
    }

    // 🔴 LIMPEZA AUTOMÁTICA DE ABANDONOS:
    // Qualquer registro deste cliente (por pixId, paymentId, CPF, e-mail ou telefone)
    // é marcado como PAGO para que NUNCA apareça na lista de abandonos!
    try {
        const abandons = await getAbandons(env);
        const cleanCpf = (customer.cpf || '').replace(/\D/g, '');
        const cleanEmail = (customer.email || '').trim().toLowerCase();
        const cleanPhone = (customer.phone || '').replace(/\D/g, '').slice(-8);
        const pIdStr = String(paymentId);
        
        let changed = false;
        abandons.forEach(a => {
            const aCpf = (a.cpf || '').replace(/\D/g, '');
            const aEmail = (a.email || '').trim().toLowerCase();
            const aPhone = (a.phone || '').replace(/\D/g, '').slice(-8);
            const aPix = a.pixId ? String(a.pixId) : null;
            const aPayId = a.paymentId ? String(a.paymentId) : null;

            const isMatch = (aPix && aPix === pIdStr) ||
                            (aPayId && aPayId === pIdStr) ||
                            (cleanCpf && cleanCpf.length >= 9 && aCpf.length >= 9 && (cleanCpf.includes(aCpf) || aCpf.includes(cleanCpf))) ||
                            (cleanEmail && aEmail && cleanEmail === aEmail) ||
                            (cleanPhone && cleanPhone.length >= 8 && aPhone.length >= 8 && cleanPhone === aPhone);

            if (isMatch && !a.paid) {
                a.paid = true;
                a.paidAt = new Date().toISOString();
                changed = true;
            }
        });

        if (changed) {
            await saveAbandons(env, abandons);
        }
    } catch (err) {
        console.error('[ABANDON CLEANUP ERROR IN LOGSALE]', err);
    }

    return true;
}

// ─── CONFIG ──────────────────────────────────────────────────
adminRoutes.get('/config', async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(await getDB(c.env));
});

// ─── PRICES (PUBLIC) ─────────────────────────────────────────
// Retorna apenas os preços de todos os produtos — usado pelo app e pelos sites
adminRoutes.get('/prices', async (c) => {
    c.header('Cache-Control', 'no-store');
    const db = await getDB(c.env);
    const prices = {};
    for (const [id, product] of Object.entries(db.products || {})) {
        prices[id] = {
            price: product.price ?? 0,
            originalPrice: product.originalPrice ?? product.price ?? 0,
            title: product.title,
        };
    }
    return c.json(prices);
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
                title: 'O Segredo das Doenças Avícolas', price: 49.90, originalPrice: 147.00,
                description: 'Identifique e trate mais de 10 doenças nas galinhas', isFeatured: true, badge: 'OFERTA PRINCIPAL',
                features: ['Doenças Avícolas', 'Tabela de vacinação', 'Tabela de vermifugação', 'Protocolo de prevenção'],
                cover: 'capadasdoencas.webp', orderBumps: ['bump-6361', 'bump-ovos']
            },
            'ebook-pintinhos': {
                title: 'Manual de Manejo de Pintinhos', price: 27.90, originalPrice: 67.00, enabled: true,
                description: 'Aprenda a melhor forma de tratar e manejar seus pintinhos', cover: 'capadospintinhos.webp', orderBumps: ['bump-6361', 'bump-ovos']
            },
            'ebook-manejo': {
                title: 'Manual de Manejo de Pintinhos', price: 27.90, originalPrice: 67.00, enabled: true,
                description: 'Aprenda a melhor forma de tratar e manejar seus pintinhos', cover: 'capadospintinhos.webp', orderBumps: []
            },
            'combo-plataforma': {
                title: 'Combo Completo Plataforma', price: 49.90, originalPrice: 147.00,
                description: 'Acesso completo à plataforma de e-books avícolas', badge: 'MELHOR OFERTA', cover: 'combo', orderBumps: ['bump-6361', 'bump-ovos']
            },
            'combo-elite': {
                title: 'Combo Completo Plataforma', price: 49.90, originalPrice: 147.00,
                description: 'Acesso completo à plataforma de e-books avícolas', badge: 'MELHOR OFERTA', cover: 'combo', orderBumps: ['bump-6361', 'bump-ovos']
            }
        },
        orderBumps: {
            'bump-6361': { id: 'bump-6361', title: 'Tabela de Ração Prática', price: 14.90, description: 'Aprenda a formular sua própria ração balanceada.', image: 'tabela_racao_bump.webp' },
            'bump-ovos': { id: 'bump-ovos', title: 'Potencialize a Produção de Ovos', price: 14.90, description: 'Protocolo de Alta Postura.', image: 'potencialize_ovos_bump.webp' }
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
    c.header('Cache-Control', 'no-store');
    const pw = c.req.header('x-admin-password') || c.req.query('password');
    if (pw !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
    const list = await getHistory(c.env);

    let freeUsersMap = new Map();
    try {
        const rawFree = await c.env.HISTORY.get('free_users');
        if (rawFree) {
            const freeUsers = JSON.parse(rawFree);
            freeUsers.forEach(u => {
                if (u.email) freeUsersMap.set(u.email.toLowerCase().trim(), u);
                if (u.phone) freeUsersMap.set(u.phone.replace(/\D/g, '').slice(-8), u);
                if (u.cpf) freeUsersMap.set(u.cpf.replace(/\D/g, ''), u);
            });
        }
    } catch (_) {}

    const enriched = await Promise.all(list.map(async (item) => {
        const cpf = (item.cpf || item.customer?.cpf || '').replace(/\D/g, '');
        const email = (item.email || item.customer?.email || '').trim().toLowerCase();
        const phone = (item.phone || item.customer?.phone || '').replace(/\D/g, '').slice(-8);

        const freeUser = freeUsersMap.get(email) || freeUsersMap.get(phone) || (cpf ? freeUsersMap.get(cpf) : null);
        const storedPw = (cpf && cpf.length >= 4) ? await c.env.HISTORY.get('pw_' + cpf) : null;
        const password = item.password || freeUser?.password || storedPw || (cpf.length >= 4 ? cpf.slice(0, 4) : '1234');
        const hasExistingAccount = !!(item.hasExistingAccount || freeUser || (storedPw && cpf.length >= 4 && storedPw !== cpf.slice(0, 4)));

        return { ...item, password, hasExistingAccount };
    }));
    return c.json(enriched);
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
    c.header('Cache-Control', 'no-store');
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
    
    const abandons = await getAbandons(c.env);
    const history = await getHistory(c.env);

    // Conjunto de identificadores de clientes que já compraram (para filtro absoluto)
    const paidCpfs = new Set();
    const paidEmails = new Set();
    const paidPhones = new Set();
    const paidIds = new Set();

    history.forEach(h => {
        if (h.paymentId) paidIds.add(String(h.paymentId));
        if (h.id) paidIds.add(String(h.id));
        const cpf = (h.cpf || h.customer?.cpf || '').replace(/\D/g, '');
        if (cpf.length >= 9) paidCpfs.add(cpf.slice(0, 9));
        const email = (h.email || h.customer?.email || '').trim().toLowerCase();
        if (email) paidEmails.add(email);
        const phone = (h.phone || h.customer?.phone || '').replace(/\D/g, '').slice(-8);
        if (phone.length >= 8) paidPhones.add(phone);
    });

    // Retorna APENAS quem realmente NÃO pagou
    const filtered = abandons.filter(a => {
        if (a.paid) return false;
        if (a.pixId && paidIds.has(String(a.pixId))) return false;
        if (a.paymentId && paidIds.has(String(a.paymentId))) return false;
        const aCpf = (a.cpf || '').replace(/\D/g, '');
        if (aCpf.length >= 9 && paidCpfs.has(aCpf.slice(0, 9))) return false;
        const aEmail = (a.email || '').trim().toLowerCase();
        if (aEmail && paidEmails.has(aEmail)) return false;
        const aPhone = (a.phone || '').replace(/\D/g, '').slice(-8);
        if (aPhone.length >= 8 && paidPhones.has(aPhone)) return false;
        return true;
    });

    return c.json(filtered);
});

adminRoutes.post('/abandon', async (c) => {
    const { name, email, phone, cpf, product, total, pixGenerated, pixId, site, type, reason } = await c.req.json();
    if (!phone && !email && !cpf) return c.json({ error: 'Contato não fornecido' }, 400);

    const cleanCpf = (cpf || '').replace(/\D/g, '');
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-8);

    // Se este cliente já concluiu uma compra no passado, NÃO registra como abandono!
    const history = await getHistory(c.env);
    const alreadyPaid = history.some(h => {
        const hCpf = (h.cpf || h.customer?.cpf || '').replace(/\D/g, '');
        const hEmail = (h.email || h.customer?.email || '').trim().toLowerCase();
        const hPhone = (h.phone || h.customer?.phone || '').replace(/\D/g, '').slice(-8);
        if (cleanCpf && cleanCpf.length >= 9 && hCpf.length >= 9 && (cleanCpf.includes(hCpf) || hCpf.includes(cleanCpf))) return true;
        if (cleanEmail && hEmail && cleanEmail === hEmail) return true;
        if (cleanPhone && cleanPhone.length >= 8 && hPhone.length >= 8 && cleanPhone === hPhone) return true;
        return false;
    });

    if (alreadyPaid) {
        return c.json({ success: true, message: 'Cliente já possui compra aprovada' });
    }

    const abandons = await getAbandons(c.env);
    const todayStr = today();
    const existing = abandons.find(a => {
        const aCpf = (a.cpf || '').replace(/\D/g, '');
        const aEmail = (a.email || '').trim().toLowerCase();
        const aPhone = (a.phone || '').replace(/\D/g, '').slice(-8);
        const matchCpf = cleanCpf && cleanCpf.length >= 9 && aCpf.length >= 9 && cleanCpf === aCpf;
        const matchEmail = cleanEmail && aEmail && cleanEmail === aEmail;
        const matchPhone = cleanPhone && cleanPhone.length >= 8 && aPhone.length >= 8 && cleanPhone === aPhone;
        return (matchCpf || matchEmail || matchPhone) && a.date.startsWith(todayStr);
    });

    if (existing) {
        // Se já foi marcado como pago hoje, não reverte para abandono
        if (existing.paid) {
            return c.json({ success: true });
        }
        if (name && (!existing.name || existing.name === 'Cliente')) existing.name = name;
        if (cpf && !existing.cpf) existing.cpf = cpf;
        if (phone && !existing.phone) existing.phone = phone;
        if (email && !existing.email) existing.email = email;
        if (total) existing.total = total;
        if (product) existing.product = product;
        if (type) existing.type = type;
        if (reason) existing.reason = reason;
        if (pixGenerated) { existing.pixGenerated = true; existing.pixId = pixId; }
        await saveAbandons(c.env, abandons);
        return c.json({ success: true });
    }

    abandons.unshift({ 
        id: Date.now().toString(), 
        date: new Date().toISOString(), 
        name: name || '', 
        email: email || '', 
        phone: phone || '', 
        cpf: cpf || '',
        product: product || 'unknown', 
        total: total || 0,
        pixGenerated: pixGenerated || false, 
        pixId: pixId || null, 
        type: type || (pixGenerated ? 'pix_pending' : 'checkout_abandon'),
        reason: reason || '',
        paid: false, 
        site: site || 'app' 
    });
    await saveAbandons(c.env, abandons.slice(0, 500));
    return c.json({ success: true });
});

adminRoutes.post('/abandon/convert', async (c) => {
    const { pixId, paymentId, cpf, email, phone } = await c.req.json();
    const abandons = await getAbandons(c.env);
    const pIdStr = pixId ? String(pixId) : (paymentId ? String(paymentId) : null);
    const cleanCpf = (cpf || '').replace(/\D/g, '');
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-8);

    let changed = false;
    abandons.forEach(a => {
        const aCpf = (a.cpf || '').replace(/\D/g, '');
        const aEmail = (a.email || '').trim().toLowerCase();
        const aPhone = (a.phone || '').replace(/\D/g, '').slice(-8);
        const aPix = a.pixId ? String(a.pixId) : null;
        const aPayId = a.paymentId ? String(a.paymentId) : null;

        const isMatch = (pIdStr && (aPix === pIdStr || aPayId === pIdStr)) ||
                        (cleanCpf && cleanCpf.length >= 9 && aCpf.length >= 9 && (cleanCpf.includes(aCpf) || aCpf.includes(cleanCpf))) ||
                        (cleanEmail && aEmail && cleanEmail === aEmail) ||
                        (cleanPhone && cleanPhone.length >= 8 && aPhone.length >= 8 && cleanPhone === aPhone);

        if (isMatch) {
            a.paid = true;
            a.paidAt = new Date().toISOString();
            changed = true;
        }
    });

    if (changed) {
        await saveAbandons(c.env, abandons);
    }
    return c.json({ success: true });
});

// ─── VERIFY ACCESS (APP LOGIN) ────────────────────────────────
adminRoutes.post('/verify-access', async (c) => {
    try {
        const { identifier, password } = await c.req.json();
        if (!identifier) return c.json({ error: 'Identificador ausente' }, 400);
        
        let cleanId = identifier.trim().toLowerCase();
        if (cleanId.includes('@')) {
            const parts = cleanId.split('@');
            if (parts.length > 0) {
                const prefix = parts[0];
                if (/^[\d.-]+$/.test(prefix)) {
                    parts[0] = prefix.replace(/\D/g, '');
                }
            }
            cleanId = parts.join('@');
        }
        const cleanNum = cleanId.replace(/\D/g, '');
        
        // Master admin override (João Paulo)
        if (cleanId === '14477751630' || cleanId === '144.777.516-30' || cleanNum === '14477751630') {
            const adminPW = c.env.ADMIN_PASSWORD || 'mura2026';
            if (password && password !== adminPW) {
                return c.json({ found: true, error: 'Senha incorreta.' }, 401);
            }
            return c.json({
                found: true,
                name: 'Administrador (João Paulo)',
                email: 'suporte@protocoloelite.com.br',
                phone: '33999999999',
                cpf: '144.777.516-30',
                products: ['ebook-manejo', 'tabela-racao', 'ebook-doencas', 'potencialize-ovos']
            });
        }

        let foundName = null;
        let foundEmail = null;
        let foundPhone = null;
        let foundCpf = null;
        let productsSet = new Set();

        // ─── VERIFICA USUÁRIOS GRATUITOS (conta criada via /register) ───
        let freeUserMatched = null;
        try {
            const rawFreeUsers = await c.env.HISTORY.get('free_users');
            if (rawFreeUsers) {
                const freeUsers = JSON.parse(rawFreeUsers);
                const freeUser = freeUsers.find(u =>
                    (cleanId && u.email && u.email.toLowerCase() === cleanId) ||
                    (cleanNum && cleanNum.length >= 8 && u.phone && u.phone.replace(/\D/g, '').includes(cleanNum)) ||
                    (cleanNum && cleanNum.length >= 11 && u.cpf && u.cpf.replace(/\D/g, '') === cleanNum)
                );
                if (freeUser) {
                    freeUserMatched = freeUser;
                    foundName = freeUser.name;
                    foundEmail = freeUser.email;
                    foundPhone = freeUser.phone;
                    if (freeUser.cpf) foundCpf = freeUser.cpf;
                    (freeUser.products || []).forEach(p => productsSet.add(p));
                }
            }
        } catch (freeErr) {
            console.error('Erro ao verificar usuários gratuitos:', freeErr);
        }

        const history = await getHistory(c.env);
        let foundExpiresAt = null;
        let foundDuration = null;
        let hasActiveSale = false;
        let hasLifetimeSale = false;
        let foundSalePassword = null;
        const now = Date.now();
        
        for (const sale of history) {
            const isApproved = sale.status === 'approved' || !sale.status;
            if (isApproved) {
                const saleEmail = (sale.customer?.email || sale.email || '').toLowerCase();
                const saleCpf = (sale.customer?.cpf || sale.cpf || '').replace(/\D/g, '');
                const salePhone = (sale.customer?.phone || sale.phone || '').replace(/\D/g, '');
                const saleName = sale.customer?.name || sale.name || '';
                
                let isMatch = false;
                if (cleanId.includes('@')) {
                    if (saleEmail === cleanId) isMatch = true;
                } else {
                    if (cleanNum.length === 11 && saleCpf === cleanNum) isMatch = true;
                    if ((cleanNum.length === 10 || cleanNum.length === 11) && salePhone.includes(cleanNum)) isMatch = true;
                }

                // Cruzamento também com dados do usuário gratuito cadastrado
                if (freeUserMatched) {
                    if (freeUserMatched.email && saleEmail && saleEmail === freeUserMatched.email.toLowerCase()) isMatch = true;
                    if (freeUserMatched.phone && salePhone && (salePhone === freeUserMatched.phone || salePhone.includes(freeUserMatched.phone) || freeUserMatched.phone.includes(salePhone))) isMatch = true;
                    if (freeUserMatched.cpf && saleCpf && saleCpf === freeUserMatched.cpf.replace(/\D/g, '')) isMatch = true;
                }
                
                if (isMatch) {
                    if (!foundName && saleName) foundName = saleName;
                    if (!foundEmail && saleEmail) foundEmail = saleEmail;
                    if (!foundPhone && salePhone) foundPhone = salePhone;
                    if (!foundCpf && saleCpf) foundCpf = saleCpf;
                    if (sale.password && !foundSalePassword) foundSalePassword = sale.password;
                    
                    // Verifica se esta venda/acesso manual já expirou
                    const isExpired = sale.expiresAt && (new Date(sale.expiresAt).getTime() <= now);
                    if (isExpired) {
                        continue; // Não adiciona produtos de acessos expirados
                    }

                    hasActiveSale = true;
                    if (sale.expiresAt) {
                        foundExpiresAt = sale.expiresAt;
                        foundDuration = sale.duration || 'custom';
                    } else {
                        hasLifetimeSale = true;
                    }

                    // Mapeia os títulos dos itens para os IDs de produtos do app (suporta strings e objetos)
                    const titleStr = (sale.items || []).map(i => {
                        if (typeof i === 'string') return i.toLowerCase();
                        if (i && typeof i === 'object') return `${i.id || ''} ${i.title || ''}`.toLowerCase();
                        return '';
                    }).join(' ');
                    
                    // 1. Guia das Doenças
                    if (titleStr.includes('doença') || titleStr.includes('doenca') || titleStr.includes('cura das aves') || titleStr.includes('elite') || titleStr.includes('protocolo') || titleStr.includes('combo')) {
                        productsSet.add('ebook-doencas');
                    }
                    // 2. Tabela de Ração (apenas se comprou o bump de ração OU o combo completo)
                    if (titleStr.includes('tabela') || titleStr.includes('ração') || titleStr.includes('racao') || titleStr.includes('bump') || titleStr.includes('combo-plataforma') || titleStr.includes('combo completo') || titleStr.includes('acesso completo')) {
                        productsSet.add('tabela-racao');
                    }
                    // 3. Manejo de Pintinhos (apenas se comprou o manual de pintinhos OU combo elite)
                    if (titleStr.includes('manejo') || titleStr.includes('pintinho') || titleStr.includes('combo-elite')) {
                        productsSet.add('ebook-manejo');
                    }
                    // 4. Potencialize a Produção de Ovos
                    if (titleStr.includes('potencialize') || titleStr.includes('produção de ovo') || titleStr.includes('producao de ovo') || titleStr.includes('alta postura') || titleStr.includes('bump-ovos') || titleStr.includes('potencialize-ovos')) {
                        productsSet.add('potencialize-ovos');
                    }
                }
            }
        }
        
        // Se encontrou a pessoa E TEM venda ativa mas não identificou o produto (compras antigas), libera os dois produtos base
        if (foundName && hasActiveSale && productsSet.size === 0) {
            productsSet.add('ebook-doencas');
            productsSet.add('tabela-racao');
        }

        // Sincroniza produtos descobertos no free_users para que fique persistente
        if (freeUserMatched && productsSet.size > 0) {
            try {
                const rawFree = await c.env.HISTORY.get('free_users');
                if (rawFree) {
                    const freeUsers = JSON.parse(rawFree);
                    const idx = freeUsers.findIndex(u => u.email === freeUserMatched.email);
                    if (idx !== -1) {
                        const existingProds = new Set(freeUsers[idx].products || []);
                        let hasNew = false;
                        productsSet.forEach(p => {
                            if (!existingProds.has(p)) {
                                existingProds.add(p);
                                hasNew = true;
                            }
                        });
                        if (foundCpf && !freeUsers[idx].cpf) {
                            freeUsers[idx].cpf = foundCpf;
                            hasNew = true;
                        }
                        if (hasNew) {
                            freeUsers[idx].products = Array.from(existingProds);
                            await c.env.HISTORY.put('free_users', JSON.stringify(freeUsers));
                        }
                    }
                }
            } catch (mergeErr) {
                console.error('[FREE USER MERGE ERROR]', mergeErr);
            }
        }

        // Checa se há expiração vinculada diretamente ao CPF no KV
        if (foundCpf && !hasLifetimeSale) {
            const expKey = await c.env.HISTORY.get('exp_' + foundCpf.replace(/\D/g, ''));
            if (expKey) {
                if (new Date(expKey).getTime() <= now) {
                    productsSet.clear();
                } else if (!foundExpiresAt) {
                    foundExpiresAt = expKey;
                }
            }
        } else if (foundCpf && hasLifetimeSale) {
            // Se possui compra ou acesso vitalício liberado, ignora e remove exp_ de teste anterior
            try { await c.env.HISTORY.delete('exp_' + foundCpf.replace(/\D/g, '')); } catch (_) {}
            foundExpiresAt = null;
            foundDuration = 'lifetime';
        }
        
        // Verifica bloqueio
        const db = await getDB(c.env);
        const blockedUsers = db.blocked_users || [];
        // Checa se algum dos identificadores batem
        let isBlocked = false;
        if (blockedUsers.includes(cleanId) || blockedUsers.includes(cleanNum)) isBlocked = true;
        if (foundEmail && blockedUsers.includes(foundEmail)) isBlocked = true;
        if (foundCpf && blockedUsers.includes(foundCpf)) isBlocked = true;
        if (foundPhone && blockedUsers.includes(foundPhone)) isBlocked = true;

        if (isBlocked) {
            productsSet.clear();
        }
        
        // ─── VERIFICAÇÃO INTELIGENTE DE SENHA MULTI-FATOR ───
        if (foundName && !isBlocked && password) {
            const pInput = password.trim().toLowerCase();
            const validPasswords = new Set();

            // 1. Senha personalizada cadastrada pelo usuário na conta gratuita
            if (freeUserMatched && freeUserMatched.password) {
                validPasswords.add(freeUserMatched.password.trim().toLowerCase());
            }

            // 2. Os 4 primeiros dígitos do CPF (padrão universal enviado no WhatsApp e e-mail)
            const cleanCpfKey = foundCpf ? foundCpf.replace(/\D/g, '') : cleanNum || '';
            if (cleanCpfKey.length >= 4) {
                validPasswords.add(cleanCpfKey.slice(0, 4).toLowerCase());
                validPasswords.add(cleanCpfKey.toLowerCase());
            }

            // 3. Senha gravada na venda do histórico
            if (foundSalePassword) {
                validPasswords.add(foundSalePassword.trim().toLowerCase());
            }

            // 4. Senha armazenada na chave pw_ do KV
            if (cleanCpfKey) {
                const storedPW = await c.env.HISTORY.get('pw_' + cleanCpfKey);
                if (storedPW) {
                    validPasswords.add(storedPW.trim().toLowerCase());
                }
            }

            // 5. Se houver telefone, permite também os 4 primeiros dígitos do celular
            if (foundPhone) {
                const cleanPh = foundPhone.replace(/\D/g, '');
                if (cleanPh.length >= 4) {
                    validPasswords.add(cleanPh.slice(0, 4).toLowerCase());
                }
            }

            if (!validPasswords.has(pInput)) {
                return c.json({ found: true, error: 'Senha incorreta.' }, 401);
            }
        }
        
        // ─── REGISTRA ATIVIDADE DE LOGIN AUTOMATICAMENTE ───
        if (foundName && !isBlocked) {
            try {
                const actId = (foundCpf ? foundCpf.replace(/\D/g, '') : cleanNum) || (foundEmail ? foundEmail.trim().toLowerCase() : null);
                if (actId) {
                    const activities = await getClientActivities(c.env);
                    const nowIso = new Date().toISOString();
                    const existing = activities[actId] || {};
                    activities[actId] = {
                        ...existing,
                        name: foundName || existing.name || '',
                        email: foundEmail || existing.email || '',
                        phone: foundPhone || existing.phone || '',
                        cpf: foundCpf || existing.cpf || '',
                        lastLogin: nowIso,
                        firstLogin: existing.firstLogin || nowIso,
                        loginCount: (existing.loginCount || 0) + 1,
                        consumed: existing.consumed || [],
                        consumedCount: existing.consumed ? existing.consumed.length : 0
                    };
                    await saveClientActivities(c.env, activities);
                }
            } catch (actErr) {
                console.error('[ACTIVITY LOGIN TRACK ERROR]', actErr);
            }
        }

        return c.json({
            found: foundName !== null,
            isBlocked: isBlocked,
            name: foundName,
            email: foundEmail,
            phone: foundPhone,
            cpf: foundCpf,
            expiresAt: foundExpiresAt,
            duration: foundDuration || (foundExpiresAt ? 'custom' : 'lifetime'),
            products: Array.from(productsSet)
        });
    } catch (err) {
        console.error('verify-access error:', err);
        return c.json({ error: 'Erro interno ao verificar acesso', detail: err.message }, 500);
    }
});

// ─── TRACK ACTIVITY (CONSUMO DE CONTEÚDO NO APP) ──────────────
adminRoutes.post('/track-activity', async (c) => {
    try {
        const { identifier, contentId, title, type } = await c.req.json();
        if (!identifier || !contentId) return c.json({ error: 'Dados incompletos' }, 400);

        const cleanId = identifier.trim().toLowerCase();
        const cleanNum = cleanId.replace(/\D/g, '');
        const actId = cleanNum.length >= 9 ? cleanNum : cleanId;

        const activities = await getClientActivities(c.env);
        const existing = activities[actId] || {};
        const nowIso = new Date().toISOString();

        const consumedList = Array.isArray(existing.consumed) ? existing.consumed : [];
        const alreadyConsumed = consumedList.some(item => item.id === contentId);

        if (!alreadyConsumed) {
            consumedList.push({
                id: contentId,
                title: title || contentId,
                type: type || 'content',
                date: nowIso
            });
        }

        activities[actId] = {
            ...existing,
            lastConsumedAt: nowIso,
            lastContentTitle: title || contentId,
            consumed: consumedList,
            consumedCount: consumedList.length,
            lastLogin: existing.lastLogin || nowIso,
            loginCount: existing.loginCount || 1
        };

        await saveClientActivities(c.env, activities);
        return c.json({ success: true, consumedCount: consumedList.length });
    } catch (err) {
        console.error('[TRACK ACTIVITY ERROR]', err);
        return c.json({ error: 'Erro ao registrar atividade' }, 500);
    }
});

// ─── CLIENTS METRICS & STATUS (GESTOR MURA) ───────────────────
adminRoutes.get('/admin/clients-metrics', async (c) => {
    const pw = c.req.header('x-admin-password') || c.req.query('password');
    if (pw !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);

    const history = await getHistory(c.env);
    const activities = await getClientActivities(c.env);
    const db = await getDB(c.env);
    const blockedUsers = new Set(db.blocked_users || []);
    const now = Date.now();

    const clientsMap = new Map();

    for (const sale of history) {
        const isApproved = sale.status === 'approved' || !sale.status;
        if (!isApproved) continue;

        const rawCpf = sale.customer?.cpf || sale.cpf || '';
        const cleanCpf = rawCpf.replace(/\D/g, '');
        const rawEmail = (sale.customer?.email || sale.email || '').trim().toLowerCase();
        const rawPhone = sale.customer?.phone || sale.phone || '';
        const name = sale.customer?.name || sale.name || 'Cliente';

        const clientKey = cleanCpf.length >= 9 ? cleanCpf : (rawEmail || String(sale.paymentId || sale.id));

        if (!clientsMap.has(clientKey)) {
            clientsMap.set(clientKey, {
                id: clientKey,
                name: name,
                cpf: cleanCpf.length === 11 ? cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (cleanCpf || 'Não informado'),
                cleanCpf: cleanCpf,
                email: rawEmail || '',
                phone: rawPhone || '',
                totalSpent: 0,
                purchasesCount: 0,
                firstPurchaseDate: sale.date || new Date().toISOString(),
                lastPurchaseDate: sale.date || new Date().toISOString(),
                method: sale.method || 'pix',
                isManual: sale.method === 'manual',
                expiresAt: sale.expiresAt || null,
                duration: sale.duration || null,
                itemsTitles: [],
                productsSet: new Set()
            });
        }

        const client = clientsMap.get(clientKey);
        client.totalSpent += Number(sale.total || 0);
        client.purchasesCount += 1;
        if (new Date(sale.date).getTime() < new Date(client.firstPurchaseDate).getTime()) {
            client.firstPurchaseDate = sale.date;
        }
        if (new Date(sale.date).getTime() > new Date(client.lastPurchaseDate).getTime()) {
            client.lastPurchaseDate = sale.date;
            client.method = sale.method || client.method;
        }

        if (sale.expiresAt) {
            client.expiresAt = sale.expiresAt;
            client.duration = sale.duration || client.duration;
        }

        const titleStr = (sale.items || []).map(i => {
            const t = (typeof i === 'string' ? i : i?.title || '');
            if (t) client.itemsTitles.push(t);
            return t.toLowerCase();
        }).join(' ');

        if (titleStr.includes('doença') || titleStr.includes('doenca') || titleStr.includes('cura das aves') || titleStr.includes('elite') || titleStr.includes('protocolo') || titleStr.includes('combo')) {
            client.productsSet.add('ebook-doencas');
        }
        if (titleStr.includes('tabela') || titleStr.includes('ração') || titleStr.includes('racao') || titleStr.includes('bump') || titleStr.includes('combo-plataforma') || titleStr.includes('combo completo') || titleStr.includes('acesso completo')) {
            client.productsSet.add('tabela-racao');
        }
        if (titleStr.includes('manejo') || titleStr.includes('pintinho') || titleStr.includes('combo-elite')) {
            client.productsSet.add('ebook-manejo');
        }
    }

    const clientsList = [];
    let comboCompletoCount = 0;
    let doisProdutosCount = 0;
    let umProdutoCount = 0;
    let gratuitoCount = 0;

    // Carrega usuários gratuitos cadastrados para checar quem já criou conta
    let freeUsersSet = new Set();
    try {
        const rawFree = await c.env.HISTORY.get('free_users');
        if (rawFree) {
            const parsed = JSON.parse(rawFree);
            parsed.forEach(u => {
                if (u.email) freeUsersSet.add(u.email.trim().toLowerCase());
                const cleanPh = (u.phone || '').replace(/\D/g, '');
                if (cleanPh.length >= 8) freeUsersSet.add(cleanPh.slice(-8));
            });
        }
    } catch (_) {}

    let activeConsumingCount = 0;
    let loggedInCount = 0;
    let recentPendingCount = 0;
    let historicalCount = 0;

    for (const [key, client] of clientsMap.entries()) {
        const isBlocked = blockedUsers.has(client.cleanCpf) || (client.email && blockedUsers.has(client.email)) || blockedUsers.has(client.id);
        const isExpired = client.expiresAt && (new Date(client.expiresAt).getTime() <= now);

        let products = Array.from(client.productsSet);
        if (isBlocked || isExpired) {
            products = [];
        } else if (products.length === 0 && client.totalSpent > 0 && !client.isManual) {
            products = ['ebook-doencas', 'tabela-racao'];
        }

        let level = 'gratuito';
        let levelLabel = 'Gratuito / Teste';
        let levelBadge = 'badge-free';

        const pCount = products.length;
        if (client.totalSpent === 0 || client.isManual || isExpired) {
            level = 'gratuito';
            levelLabel = 'Gratuito / Teste';
            levelBadge = 'badge-free';
            gratuitoCount++;
        } else if (pCount >= 3 || (products.includes('ebook-doencas') && products.includes('ebook-manejo') && products.includes('tabela-racao'))) {
            level = 'combo_completo';
            levelLabel = 'Combo Completo';
            levelBadge = 'badge-combo';
            comboCompletoCount++;
        } else if (pCount === 2) {
            level = 'dois_produtos';
            levelLabel = '2 Produtos';
            levelBadge = 'badge-double';
            doisProdutosCount++;
        } else if (pCount === 1) {
            level = 'um_produto';
            levelLabel = '1 Produto';
            levelBadge = 'badge-single';
            umProdutoCount++;
        } else {
            level = 'gratuito';
            levelLabel = 'Gratuito / Teste';
            levelBadge = 'badge-free';
            gratuitoCount++;
        }

        const act = activities[client.cleanCpf] || activities[client.email] || activities[key] || {};
        const loginCount = act.loginCount || 0;
        const consumedList = Array.isArray(act.consumed) ? act.consumed : [];
        const consumedCount = consumedList.length;

        const clientPhoneEnding = client.phone ? client.phone.replace(/\D/g, '').slice(-8) : '';
        const isRegistered = (client.email && freeUsersSet.has(client.email)) || (clientPhoneEnding && freeUsersSet.has(clientPhoneEnding));

        const hasAccessed = loginCount > 0 || !!act.lastLogin || isRegistered;
        const hasConsumed = consumedCount > 0;

        const saleTime = new Date(client.lastPurchaseDate || client.firstPurchaseDate).getTime();
        const isRecent = (now - saleTime) <= (72 * 60 * 60 * 1000); // Compras das últimas 72 horas

        let status = 'historical';
        let statusLabel = 'Base Histórica';
        let statusBadge = 'status-historical';

        if (hasConsumed) {
            status = 'active_consuming';
            statusLabel = 'Ativo & Consumiu';
            statusBadge = 'status-active';
            activeConsumingCount++;
        } else if (hasAccessed) {
            status = 'logged_in';
            statusLabel = 'Acessou (Logado)';
            statusBadge = 'status-entered';
            loggedInCount++;
        } else if (isRecent) {
            status = 'recent_pending';
            statusLabel = 'Aguardando 1º Acesso';
            statusBadge = 'status-pending';
            recentPendingCount++;
        } else {
            status = 'historical';
            statusLabel = 'Base Histórica (E-mail/PDF)';
            statusBadge = 'status-historical';
            historicalCount++;
        }

        clientsList.push({
            id: key,
            name: client.name,
            cpf: client.cpf,
            cleanCpf: client.cleanCpf,
            email: client.email,
            phone: client.phone,
            totalSpent: Number(client.totalSpent.toFixed(2)),
            purchasesCount: client.purchasesCount,
            firstPurchaseDate: client.firstPurchaseDate,
            lastPurchaseDate: client.lastPurchaseDate,
            method: client.method,
            isBlocked: isBlocked,
            isExpired: isExpired,
            products: products,
            level: level,
            levelLabel: levelLabel,
            levelBadge: levelBadge,
            activity: {
                hasAccessed: hasAccessed,
                hasConsumed: hasConsumed,
                isRegistered: isRegistered,
                isRecent: isRecent,
                loginCount: loginCount,
                firstLogin: act.firstLogin || (isRegistered ? client.firstPurchaseDate : null),
                lastLogin: act.lastLogin || (isRegistered ? client.lastPurchaseDate : null),
                consumedCount: consumedCount,
                consumed: consumedList,
                lastConsumedAt: act.lastConsumedAt || null,
                lastContentTitle: act.lastContentTitle || null,
                status: status,
                statusLabel: statusLabel,
                statusBadge: statusBadge
            }
        });
    }

    clientsList.sort((a, b) => new Date(b.lastPurchaseDate).getTime() - new Date(a.lastPurchaseDate).getTime());

    const totalClients = clientsList.length;
    const totalAccessed = activeConsumingCount + loggedInCount;
    const activationRate = totalClients > 0 ? Number(((totalAccessed / totalClients) * 100).toFixed(1)) : 0;
    const consumingRate = totalClients > 0 ? Number(((activeConsumingCount / totalClients) * 100).toFixed(1)) : 0;

    return c.json({
        summary: {
            totalClients,
            activeConsumingCount,
            loggedInCount,
            recentPendingCount,
            historicalCount,
            totalAccessed,
            activationRate,
            consumingRate,
            levels: {
                combo_completo: comboCompletoCount,
                dois_produtos: doisProdutosCount,
                um_produto: umProdutoCount,
                gratuito: gratuitoCount
            }
        },
        clients: clientsList
    });
});


// ─── CHANGE PASSWORD ──────────────────────────────────────────
adminRoutes.post('/change-password', async (c) => {
    try {
        const { identifier, currentPassword, newPassword } = await c.req.json();
        if (!identifier || !currentPassword || !newPassword) {
            return c.json({ error: 'Dados incompletos.' }, 400);
        }

        const cleanId = identifier.trim().toLowerCase();
        const cleanNum = cleanId.replace(/\D/g, '');

        // Encontra o usuário na base de dados
        let foundCpf = null;
        if (cleanId === '14477751630' || cleanId === '144.777.516-30' || cleanNum === '14477751630') {
            foundCpf = '14477751630';
        } else {
            const history = await getHistory(c.env);
            for (const sale of history) {
                const isApproved = sale.status === 'approved' || !sale.status;
                if (isApproved) {
                    const saleEmail = (sale.customer?.email || sale.email || '').toLowerCase();
                    const saleCpf = (sale.customer?.cpf || sale.cpf || '').replace(/\D/g, '');
                    const salePhone = (sale.customer?.phone || sale.phone || '').replace(/\D/g, '');
                    
                    let isMatch = false;
                    if (cleanId.includes('@')) {
                        if (saleEmail === cleanId) isMatch = true;
                    } else {
                        if (cleanNum.length === 11 && saleCpf === cleanNum) isMatch = true;
                    }
                    if (isMatch && saleCpf) {
                        foundCpf = saleCpf;
                        break;
                    }
                }
            }
        }

        if (!foundCpf) {
            return c.json({ error: 'Usuário não encontrado.' }, 404);
        }

        const cleanCpfKey = foundCpf.replace(/\D/g, '');
        const defaultPW = cleanCpfKey.slice(0, 4);
        const storedPW = await c.env.HISTORY.get('pw_' + cleanCpfKey) || defaultPW;

        const curInput = (currentPassword || '').trim();
        const curSaved = (storedPW || '').trim();
        if (curInput !== curSaved && curInput.toLowerCase() !== curSaved.toLowerCase()) {
            return c.json({ error: 'Senha atual incorreta.' }, 401);
        }

        if (newPassword.length < 4) {
            return c.json({ error: 'A nova senha deve ter no mínimo 4 caracteres.' }, 400);
        }

        await c.env.HISTORY.put('pw_' + cleanCpfKey, newPassword);
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: 'Erro interno ao alterar senha.' }, 500);
    }
});

// ─── ADMIN PANEL (APP ADMIN CONTROLS) ───────────────────────
adminRoutes.post('/admin/search-user', async (c) => {
    try {
        const { identifier, password } = await c.req.json();
        if (password !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
        
        const cleanId = identifier.trim().toLowerCase();
        const cleanNum = cleanId.replace(/\D/g, '');
        
        const history = await getHistory(c.env);
        let foundName = null;
        let foundEmail = null;
        let foundPhone = null;
        let foundCpf = null;
        let foundExpiresAt = null;
        let foundDuration = null;
        let hasActiveSale = false;
        let hasExpiredSale = false;
        let hasLifetimeSale = false;
        let productsSet = new Set();
        const now = Date.now();
        
        for (const sale of history) {
            const isApproved = sale.status === 'approved' || !sale.status;
            if (isApproved) {
                const saleEmail = (sale.customer?.email || sale.email || '').toLowerCase();
                const saleCpf = (sale.customer?.cpf || sale.cpf || '').replace(/\D/g, '');
                const salePhone = (sale.customer?.phone || sale.phone || '').replace(/\D/g, '');
                const saleName = sale.customer?.name || sale.name || '';
                
                let isMatch = false;
                if (cleanId.includes('@') && saleEmail === cleanId) isMatch = true;
                else if (cleanNum.length === 11 && saleCpf === cleanNum) isMatch = true;
                
                if (isMatch) {
                    if (!foundName) foundName = sale.customer?.name || sale.name || '';
                    if (!foundEmail) foundEmail = saleEmail;
                    if (!foundPhone) foundPhone = salePhone;
                    if (!foundCpf) foundCpf = saleCpf;
                    
                    const isExpired = sale.expiresAt && (new Date(sale.expiresAt).getTime() <= now);
                    if (isExpired) {
                        hasExpiredSale = true;
                        continue;
                    }

                    hasActiveSale = true;
                    if (sale.expiresAt) {
                        foundExpiresAt = sale.expiresAt;
                        foundDuration = sale.duration || 'custom';
                    } else {
                        hasLifetimeSale = true;
                    }

                    const titleStr = (sale.items || []).map(i => {
                        if (typeof i === 'string') return i.toLowerCase();
                        if (i && typeof i === 'object') return (i.title || '').toLowerCase();
                        return '';
                    }).join(' ');
                    
                    if (titleStr.includes('doença') || titleStr.includes('doenca') || titleStr.includes('elite') || titleStr.includes('protocolo') || titleStr.includes('combo')) productsSet.add('ebook-doencas');
                    if (titleStr.includes('manejo') || titleStr.includes('pintinho') || titleStr.includes('combo-elite')) productsSet.add('ebook-manejo');
                    if (titleStr.includes('tabela') || titleStr.includes('ração') || titleStr.includes('racao') || titleStr.includes('bump') || titleStr.includes('combo')) productsSet.add('tabela-racao');
                }
            }
        }
        
        if (foundName && hasActiveSale && productsSet.size === 0) productsSet.add('ebook-doencas');

        if (foundCpf && !hasLifetimeSale) {
            const expKey = await c.env.HISTORY.get('exp_' + foundCpf.replace(/\D/g, ''));
            if (expKey) {
                if (new Date(expKey).getTime() <= now) {
                    productsSet.clear();
                    hasExpiredSale = true;
                    hasActiveSale = false;
                } else if (!foundExpiresAt) {
                    foundExpiresAt = expKey;
                }
            }
        } else if (foundCpf && hasLifetimeSale) {
            foundExpiresAt = null;
            foundDuration = 'lifetime';
            hasExpiredSale = false;
        }

        if (!foundName) return c.json({ found: false });

        const db = await getDB(c.env);
        const blockedUsers = db.blocked_users || [];
        let isBlocked = false;
        if (blockedUsers.includes(cleanId) || blockedUsers.includes(cleanNum)) isBlocked = true;
        if (foundEmail && blockedUsers.includes(foundEmail)) isBlocked = true;
        if (foundCpf && blockedUsers.includes(foundCpf)) isBlocked = true;
        if (foundPhone && blockedUsers.includes(foundPhone)) isBlocked = true;

        return c.json({
            found: true,
            isBlocked,
            name: foundName,
            email: foundEmail,
            phone: foundPhone,
            cpf: foundCpf,
            expiresAt: foundExpiresAt,
            duration: foundDuration || (foundExpiresAt ? 'custom' : 'lifetime'),
            isExpired: hasExpiredSale && !hasActiveSale && !hasLifetimeSale,
            products: Array.from(productsSet)
        });
    } catch (err) {
        return c.json({ error: 'Erro interno ao buscar cliente' }, 500);
    }
});

adminRoutes.post('/admin/toggle-block', async (c) => {
    try {
        const { email, cpf, phone, password, block } = await c.req.json();
        if (password !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);
        
        const db = await getDB(c.env);
        if (!db.blocked_users) db.blocked_users = [];
        
        const idsToProcess = [];
        if (email) idsToProcess.push(email.trim().toLowerCase());
        if (cpf) idsToProcess.push(cpf.replace(/\D/g, ''));
        if (phone) idsToProcess.push(phone.replace(/\D/g, ''));

        if (block) {
            idsToProcess.forEach(id => {
                if (id && !db.blocked_users.includes(id)) db.blocked_users.push(id);
            });
        } else {
            db.blocked_users = db.blocked_users.filter(u => !idsToProcess.includes(u));
        }
        
        await saveDB(c.env, db);
        return c.json({ success: true, isBlocked: block });
    } catch (err) {
        return c.json({ error: 'Erro interno ao alternar bloqueio' }, 500);
    }
});

adminRoutes.post('/admin/delete-user', async (c) => {
    try {
        const { email, cpf, phone, password } = await c.req.json();
        if (password !== (c.env.ADMIN_PASSWORD || 'mura2026')) return c.json({ error: 'Acesso Negado' }, 401);

        const cleanEmail = email ? email.trim().toLowerCase() : '';
        const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';
        const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

        if (!cleanEmail && !cleanCpf && !cleanPhone) {
            return c.json({ error: 'Nenhum dado identificador fornecido para exclusão.' }, 400);
        }

        // 1. Remove do histórico de vendas principal (HISTORY)
        const history = await getHistory(c.env);
        const filteredHistory = history.filter(sale => {
            const saleEmail = (sale.customer?.email || sale.email || '').trim().toLowerCase();
            const saleCpf = (sale.customer?.cpf || sale.cpf || '').replace(/\D/g, '');
            const salePhone = (sale.customer?.phone || sale.phone || '').replace(/\D/g, '');

            const matchCpf = cleanCpf && saleCpf && (saleCpf === cleanCpf);
            const matchEmail = cleanEmail && saleEmail && (saleEmail === cleanEmail);
            const matchPhone = cleanPhone && salePhone && (salePhone === cleanPhone || (cleanPhone.length >= 8 && salePhone.slice(-8) === cleanPhone.slice(-8)));

            return !(matchCpf || matchEmail || matchPhone);
        });
        await saveHistory(c.env, filteredHistory);

        // 2. Remove de usuários gratuitos (free_users) se existir
        try {
            const rawFree = await c.env.HISTORY.get('free_users');
            if (rawFree) {
                const freeUsers = JSON.parse(rawFree);
                const filteredFree = freeUsers.filter(u => {
                    const uEmail = (u.email || '').trim().toLowerCase();
                    const uPhone = (u.phone || '').replace(/\D/g, '');
                    const matchEmail = cleanEmail && uEmail === cleanEmail;
                    const matchPhone = cleanPhone && (uPhone === cleanPhone || (cleanPhone.length >= 8 && uPhone.slice(-8) === cleanPhone.slice(-8)));
                    return !(matchEmail || matchPhone);
                });
                await c.env.HISTORY.put('free_users', JSON.stringify(filteredFree));
            }
        } catch (e) {
            console.error('[DELETE USER] Error cleaning free_users:', e);
        }

        // 3. Remove senha armazenada e perfil
        if (cleanCpf) {
            try {
                await c.env.HISTORY.delete('pw_' + cleanCpf);
                await c.env.HISTORY.delete('exp_' + cleanCpf);
                await c.env.CONFIG.delete('profile_' + cleanCpf);
            } catch (_) {}
        }
        if (cleanEmail) {
            try {
                await c.env.CONFIG.delete('profile_' + cleanEmail);
            } catch (_) {}
        }

        // 4. Remove da lista de bloqueados (db.blocked_users) para que uma nova compra funcione livremente
        const db = await getDB(c.env);
        if (db.blocked_users && db.blocked_users.length > 0) {
            const idsToRemove = [cleanEmail, cleanCpf, cleanPhone].filter(Boolean);
            db.blocked_users = db.blocked_users.filter(u => !idsToRemove.includes(u));
            await saveDB(c.env, db);
        }

        // 5. Remove de abandonos (ABANDONS)
        try {
            const abandons = await getAbandons(c.env);
            const filteredAbandons = abandons.filter(a => {
                const aEmail = (a.email || '').trim().toLowerCase();
                const aCpf = (a.cpf || '').replace(/\D/g, '');
                const aPhone = (a.phone || '').replace(/\D/g, '');
                const matchCpf = cleanCpf && aCpf && (aCpf === cleanCpf);
                const matchEmail = cleanEmail && aEmail && (aEmail === cleanEmail);
                const matchPhone = cleanPhone && aPhone && (aPhone === cleanPhone || (cleanPhone.length >= 8 && aPhone.slice(-8) === cleanPhone.slice(-8)));
                return !(matchCpf || matchEmail || matchPhone);
            });
            await saveAbandons(c.env, filteredAbandons);
        } catch (e) {
            console.error('[DELETE USER] Error cleaning abandons:', e);
        }

        return c.json({ success: true, message: 'Cliente excluído com sucesso do sistema.' });
    } catch (err) {
        return c.json({ error: 'Erro interno ao excluir cliente' }, 500);
    }
});

adminRoutes.post('/admin/grant-access', async (c) => {
    try {
        const { name, email, phone, cpf, products, password, duration } = await c.req.json();
        
        if (password !== (c.env.ADMIN_PASSWORD || 'mura2026')) {
            return c.json({ error: 'Acesso Negado' }, 401);
        }
        if (!cpf) {
            return c.json({ error: 'CPF é obrigatório' }, 400);
        }
        if (!products || !products.length) {
            return c.json({ error: 'Pelo menos um produto deve ser selecionado' }, 400);
        }

        const cleanCPF = (cpf || '').replace(/\D/g, '');
        const clientPassword = cleanCPF.slice(0, 4) || '1234';

        // Calcula a expiração com base no tempo escolhido
        const dur = duration || 'lifetime';
        const now = Date.now();
        let expiresAt = null;
        if (dur === '15m') {
            expiresAt = new Date(now + 15 * 60 * 1000).toISOString();
        } else if (dur === '3h') {
            expiresAt = new Date(now + 3 * 60 * 60 * 1000).toISOString();
        } else if (dur === '24h') {
            expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
        }

        // Salva a senha explicitamente no KV vinculada ao CPF (primeiros 4 dígitos)
        await c.env.HISTORY.put('pw_' + cleanCPF, clientPassword);

        // Se for temporário, registra exp_ no KV; se for vitalício, remove exp_ anterior
        if (expiresAt) {
            await c.env.HISTORY.put('exp_' + cleanCPF, expiresAt);
        } else {
            try { await c.env.HISTORY.delete('exp_' + cleanCPF); } catch (_) {}
        }

        const history = await getHistory(c.env);
        const manualId = `manual-${Date.now()}`;
        
        history.push({
            id: manualId,
            paymentId: manualId,
            date: new Date().toISOString(),
            expiresAt: expiresAt,
            duration: dur,
            customer: {
                name: name || 'Acesso Manual',
                email: email || '',
                phone: phone || '',
                cpf: cleanCPF
            },
            items: products.map(p => {
                if (p === 'ebook-doencas') return 'PROTOCOLO ELITE: A Cura das Aves';
                if (p === 'ebook-manejo') return 'Manejo de Pintinhos (Upsell)';
                if (p === 'tabela-racao') return 'Tabela de Raçao';
                return p;
            }),
            total: 0,
            method: 'manual',
            status: 'approved',
            site: 'admin-panel'
        });

        await saveHistory(c.env, history);
        return c.json({ 
            success: true, 
            message: dur === '15m' 
                ? 'Acesso liberado com sucesso por 15 minutos!' 
                : dur === '3h' 
                    ? 'Acesso liberado com sucesso por 3 horas!' 
                    : dur === '24h'
                        ? 'Acesso liberado com sucesso por 24 horas!'
                        : 'Acesso vitalício liberado com sucesso!',
            login: cleanCPF,
            name: name || 'Cliente',
            email: email || '',
            phone: phone || '',
            password: clientPassword,
            duration: dur,
            expiresAt: expiresAt
        });
        
    } catch (err) {
        return c.json({ error: 'Erro interno ao liberar acesso manual' }, 500);
    }
});

// ─── USER PROFILE PERSISTENCE (AVATAR & DISPLAY NAME) ───────────
adminRoutes.post('/profile', async (c) => {
    try {
        const { identifier, displayName, avatarUrl } = await c.req.json();
        if (!identifier) return c.json({ error: 'Identificador obrigatório' }, 400);
        
        const cleanId = identifier.trim().toLowerCase().replace(/\D/g, ''); // se for CPF, remove pontuação
        const key = `profile_${cleanId || identifier.trim().toLowerCase()}`;
        
        const profileData = {
            displayName: displayName || null,
            avatarUrl: avatarUrl || null,
            updatedAt: new Date().toISOString()
        };
        
        await c.env.CONFIG.put(key, JSON.stringify(profileData));
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: 'Erro ao salvar perfil no servidor' }, 500);
    }
});

adminRoutes.get('/profile/:identifier', async (c) => {
    try {
        const iden = c.req.param('identifier');
        if (!iden) return c.json({ error: 'Identificador obrigatório' }, 400);
        
        const cleanId = iden.trim().toLowerCase().replace(/\D/g, '');
        const key = `profile_${cleanId || iden.trim().toLowerCase()}`;
        
        const raw = await c.env.CONFIG.get(key);
        if (!raw) return c.json({ found: false });
        
        const data = JSON.parse(raw);
        return c.json({ found: true, ...data });
    } catch (err) {
        return c.json({ error: 'Erro ao obter perfil do servidor' }, 500);
    }
});
