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
export async function logSale(env, customer, items, paymentId, method, site = 'app') {
    const history = await getHistory(env);
    if (history.some(h => String(h.paymentId) === String(paymentId))) return false;
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
        site: site
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
    const { name, email, phone, product, pixGenerated, pixId, site } = await c.req.json();
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
    abandons.push({ id: Date.now().toString(), date: new Date().toISOString(), name: name || '', email: email || '', phone: phone || '', product: product || 'unknown', pixGenerated: pixGenerated || false, pixId: pixId || null, paid: false, site: site || 'app' });
    await saveAbandons(c.env, abandons);
    return c.json({ success: true });
});

adminRoutes.post('/abandon/convert', async (c) => {
    const { pixId } = await c.req.json();
    if (!pixId) return c.json({ error: 'pixId obrigatório' }, 400);
    const abandons = await getAbandons(c.env);
    const idx = abandons.findIndex(a => String(a.pixId) === String(pixId));
    if (idx > -1) { abandons[idx].paid = true; abandons[idx].paidAt = new Date().toISOString(); }
    await saveAbandons(c.env, abandons);
    return c.json({ success: true });
});

// ─── VERIFY ACCESS (APP LOGIN) ────────────────────────────────
adminRoutes.post('/verify-access', async (c) => {
    try {
        const { identifier, password } = await c.req.json();
        if (!identifier) return c.json({ error: 'Identificador ausente' }, 400);
        
        const cleanId = identifier.trim().toLowerCase();
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
                products: ['ebook-manejo', 'tabela-racao', 'ebook-doencas']
            });
        }

        const history = await getHistory(c.env);
        let foundName = null;
        let foundEmail = null;
        let foundPhone = null;
        let foundCpf = null;
        let productsSet = new Set();
        
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
                }
                
                if (isMatch) {
                    if (!foundName && saleName) foundName = saleName;
                    if (!foundEmail && saleEmail) foundEmail = saleEmail;
                    if (!foundPhone && salePhone) foundPhone = salePhone;
                    if (!foundCpf && saleCpf) foundCpf = saleCpf;
                    
                    // Mapeia os títulos dos itens para os IDs de produtos do app (suporta strings e objetos)
                    const titleStr = (sale.items || []).map(i => {
                        if (typeof i === 'string') return i.toLowerCase();
                        if (i && typeof i === 'object') return (i.title || '').toLowerCase();
                        return '';
                    }).join(' ');
                    
                    if (titleStr.includes('doença') || titleStr.includes('doenca') || titleStr.includes('elite') || titleStr.includes('protocolo')) {
                        productsSet.add('ebook-doencas');
                    }
                    if (titleStr.includes('manejo') || titleStr.includes('pintinho')) {
                        productsSet.add('ebook-manejo');
                    }
                    if (titleStr.includes('tabela') || titleStr.includes('ração') || titleStr.includes('racao') || titleStr.includes('bump')) {
                        productsSet.add('tabela-racao');
                    }
                    if (titleStr.includes('combo')) {
                        productsSet.add('ebook-doencas');
                        productsSet.add('ebook-manejo');
                        productsSet.add('tabela-racao');
                    }
                }
            }
        }
        
        // Se encontrou a pessoa mas não identificou o produto (compras antigas), libera o principal
        if (foundName && productsSet.size === 0) {
            productsSet.add('ebook-doencas');
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
        
        if (foundName && !isBlocked) {
            const cleanCpfKey = foundCpf ? foundCpf.replace(/\D/g, '') : cleanNum || 'nocpf';
            const defaultPW = cleanCpfKey.slice(0, 4) || '1234';
            const storedPW = await c.env.HISTORY.get('pw_' + cleanCpfKey) || defaultPW;
            
            if (password && password !== storedPW) {
                return c.json({ found: true, error: 'Senha incorreta.' }, 401);
            }
        }
        
        return c.json({
            found: foundName !== null,
            isBlocked: isBlocked,
            name: foundName,
            email: foundEmail,
            phone: foundPhone,
            cpf: foundCpf,
            products: Array.from(productsSet)
        });
    } catch (err) {
        return c.json({ error: 'Erro interno ao verificar acesso' }, 500);
    }
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
                        if (cleanNum.length >= 8 && salePhone.length >= 8) {
                            if (salePhone.endsWith(cleanNum) || cleanNum.endsWith(salePhone)) {
                                isMatch = true;
                            }
                        }
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

        if (currentPassword !== storedPW) {
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
        let productsSet = new Set();
        
        for (const sale of history) {
            const isApproved = sale.status === 'approved' || !sale.status;
            if (isApproved) {
                const saleEmail = (sale.customer?.email || sale.email || '').toLowerCase();
                const saleCpf = (sale.customer?.cpf || sale.cpf || '').replace(/\D/g, '');
                const salePhone = (sale.customer?.phone || sale.phone || '').replace(/\D/g, '');
                
                let isMatch = false;
                if (cleanId.includes('@') && saleEmail === cleanId) isMatch = true;
                else if (cleanNum.length === 11 && saleCpf === cleanNum) isMatch = true;
                
                if (isMatch) {
                    if (!foundName) foundName = sale.customer?.name || sale.name || '';
                    if (!foundEmail && saleEmail) foundEmail = saleEmail;
                    if (!foundPhone && salePhone) foundPhone = salePhone;
                    if (!foundCpf && saleCpf) foundCpf = saleCpf;
                    
                    const titleStr = (sale.items || []).map(i => {
                        if (typeof i === 'string') return i.toLowerCase();
                        if (i && typeof i === 'object') return (i.title || '').toLowerCase();
                        return '';
                    }).join(' ');
                    
                    if (titleStr.includes('doença') || titleStr.includes('doenca') || titleStr.includes('elite') || titleStr.includes('protocolo') || titleStr.includes('combo')) productsSet.add('ebook-doencas');
                    if (titleStr.includes('manejo') || titleStr.includes('pintinho') || titleStr.includes('combo')) productsSet.add('ebook-manejo');
                    if (titleStr.includes('tabela') || titleStr.includes('ração') || titleStr.includes('racao') || titleStr.includes('bump') || titleStr.includes('combo')) productsSet.add('tabela-racao');
                }
            }
        }
        
        if (foundName && productsSet.size === 0) productsSet.add('ebook-doencas');

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

adminRoutes.post('/admin/grant-access', async (c) => {
    try {
        const { name, email, phone, cpf, products, password } = await c.req.json();
        
        if (password !== (c.env.ADMIN_PASSWORD || 'mura2026')) {
            return c.json({ error: 'Acesso Negado' }, 401);
        }
        if (!cpf) {
            return c.json({ error: 'CPF é obrigatório' }, 400);
        }
        if (!products || !products.length) {
            return c.json({ error: 'Pelo menos um produto deve ser selecionado' }, 400);
        }

        const history = await getHistory(c.env);
        const manualId = `manual-${Date.now()}`;
        
        history.push({
            id: manualId,
            paymentId: manualId,
            date: new Date().toISOString(),
            customer: {
                name: name || 'Acesso Manual',
                email: email || '',
                phone: phone || '',
                cpf: cpf
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
        return c.json({ success: true, message: 'Acesso liberado com sucesso!' });
        
    } catch (err) {
        return c.json({ error: 'Erro interno ao liberar acesso manual' }, 500);
    }
});
