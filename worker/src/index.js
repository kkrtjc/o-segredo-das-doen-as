import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { checkoutRoutes } from './checkout.js';
import { adminRoutes } from './admin.js';
import { trackingRoutes } from './tracking.js';
import { downloadRoutes } from './downloads.js';
import { webhookRoutes } from './webhooks.js';
import { capiRoutes } from './capiRoutes.js';

const app = new Hono();

// CORS — permite qualquer origem
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-admin-password'],
}));

// Health check
app.get('/health', (c) => c.text('Mura Engine V3 Online! 🚀 (Cloudflare Workers)'));

// ─── REGISTRO DE CONTA GRATUITA (usado pelo app Protocolo Elite) ─────────────
// O app chama POST /register com { name, email, phone, password }
// Cria uma conta gratuita (sem produtos pagos) e retorna { success: true, products: [] }
app.post('/register', async (c) => {
    try {
        const { name, email, phone, password } = await c.req.json();

        if (!name || !email || !phone || !password) {
            return c.json({ error: 'Dados incompletos. Preencha todos os campos.' }, 400);
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.replace(/\D/g, '');

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return c.json({ error: 'E-mail inválido.' }, 400);
        }
        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
            return c.json({ error: 'Celular inválido.' }, 400);
        }
        if (password.length < 6 || password.length > 22) {
            return c.json({ error: 'Senha deve ter entre 6 e 22 caracteres.' }, 400);
        }

        // Verifica duplicatas usando a KV de usuários gratuitos
        const rawFreeUsers = await c.env.HISTORY.get('free_users');
        const freeUsers = rawFreeUsers ? JSON.parse(rawFreeUsers) : [];

        const alreadyExists = freeUsers.some(u =>
            u.email === cleanEmail || u.phone === cleanPhone
        );

        if (alreadyExists) {
            return c.json({ error: 'Este e-mail ou celular já está cadastrado.' }, 409);
        }

        // Verifica também no histórico de vendas (comprador que está tentando criar conta grátis)
        const { getHistory } = await import('./admin.js');
        const history = await getHistory(c.env);
        const existsInHistory = history.some(sale => {
            const saleEmail = (sale.customer?.email || sale.email || '').toLowerCase();
            const salePhone = (sale.customer?.phone || sale.phone || '').replace(/\D/g, '');
            return saleEmail === cleanEmail || salePhone === cleanPhone;
        });

        if (existsInHistory) {
            return c.json({ error: 'Este e-mail ou celular já possui uma conta. Use a opção "Entrar".' }, 409);
        }

        // Salva o novo usuário gratuito
        freeUsers.push({
            id: `free-${Date.now()}`,
            date: new Date().toISOString(),
            name: name.trim(),
            email: cleanEmail,
            phone: cleanPhone,
            // Senha hasheada de forma simples (não há dados sensíveis aqui, apenas acesso à plataforma gratuita)
            password: password,
            products: []
        });

        await c.env.HISTORY.put('free_users', JSON.stringify(freeUsers));

        return c.json({ success: true, name: name.trim(), products: [] });

    } catch (err) {
        console.error('Erro no /register:', err);
        return c.json({ error: 'Erro interno. Tente novamente em alguns segundos.' }, 500);
    }
});

// Rotas de checkout (PIX, cartão)
app.route('/api/checkout', checkoutRoutes);

// CAPI server-side — recebe eventos do browser e repassa ao Meta
app.route('/api', capiRoutes);

// Status de pagamento — compatível com script.js que chama /api/payment/:id
app.get('/api/payment/:id', async (c) => {
    const { checkoutRoutes: cr } = await import('./checkout.js');
    // Redireciona para o handler interno de status
    const MP_TOKEN = c.env.MP_ACCESS_TOKEN;
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${c.req.param('id')}`, {
        headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    const result = await res.json();
    if (result.status === 'approved') {
        const { logSale } = await import('./admin.js');
        const { generateDownloadToken } = await import('./utils.js');
        const { sendEmail } = await import('./email.js');
        const metadata = result.metadata || {};
        const customer = {
            name: metadata.customer_name || `${result.payer?.first_name || ''} ${result.payer?.last_name || ''}`.trim() || 'Cliente',
            email: metadata.customer_email || result.payer?.email || 'galosmurabrasill@gmail.com',
            phone: metadata.customer_phone || 'Sem Telefone',
            cpf: metadata.customer_cpf || result.payer?.identification?.number || 'Sem CPF',
        };
        const itemTitles = (result.description || 'Produto').split(', ');
        const items = itemTitles.map(t => ({ title: t, price: result.transaction_amount / itemTitles.length }));
        
        // Anti-duplicação: verifica lock na KV antes de registrar
        const lockKey = `lock_${result.id}`;
        const isLocked = await c.env.HISTORY.get(lockKey);
        
        if (!isLocked) {
            await c.env.HISTORY.put(lockKey, 'locked', { expirationTtl: 7200 });
            const isNewSale = await logSale(c.env, customer, items, result.id, result.payment_method_id === 'pix' ? 'pix' : 'cartão', metadata.site || 'app');
            if (isNewSale) {
                await sendEmail(c.env, customer, items, result.id,
                    metadata.facebook_event_id,
                    metadata.fbc,
                    metadata.fbp,
                    metadata.user_agent,
                    null,
                    metadata.site || 'app',
                    metadata.external_id);
            }
        }
        
        const token = await generateDownloadToken(customer.email, items, result.id, c.env);
        const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
        if (!isLocked) {
            // clientIp passado para o CAPI enriquecer o Purchase
        }
        return c.json({ id: result.id, status: result.status, redirectToken: token });
    }
    return c.json({ id: result.id, status: result.status, status_detail: result.status_detail });
});

// Webhook Mercado Pago
app.route('/api/webhooks', webhookRoutes);

// Admin, analytics, leads, abandons, config, products
app.route('/api', adminRoutes);

// Analytics tracking
app.route('/api', trackingRoutes);

// Downloads (PDFs do R2) + redirect do link do e-mail
app.route('/', downloadRoutes);

export default app;

