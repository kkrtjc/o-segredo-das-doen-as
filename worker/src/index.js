import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { checkoutRoutes } from './checkout.js';
import { adminRoutes } from './admin.js';
import { trackingRoutes } from './tracking.js';
import { downloadRoutes } from './downloads.js';
import { webhookRoutes } from './webhooks.js';

const app = new Hono();

// CORS — permite qualquer origem
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-admin-password'],
}));

// Health check
app.get('/health', (c) => c.text('Mura Engine V3 Online! 🚀 (Cloudflare Workers)'));

// Rotas de checkout (PIX, cartão)
app.route('/api/checkout', checkoutRoutes);

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
        };
        const itemTitles = (result.description || 'Produto').split(', ');
        const items = itemTitles.map(t => ({ title: t, price: result.transaction_amount / itemTitles.length }));
        
        // Anti-duplicação: verifica lock na KV antes de registrar
        const lockKey = `lock_${result.id}`;
        const isLocked = await c.env.HISTORY.get(lockKey);
        
        if (!isLocked) {
            await c.env.HISTORY.put(lockKey, 'locked', { expirationTtl: 7200 });
            const isNewSale = await logSale(c.env, customer, items, result.id, result.payment_method_id === 'pix' ? 'pix' : 'cartão');
            if (isNewSale) {
                await sendEmail(c.env, customer, items, result.id,
                    metadata.facebook_event_id,
                    metadata.fbc,
                    metadata.fbp,
                    metadata.user_agent);
            }
        }
        
        const token = await generateDownloadToken(customer.email, items, result.id, c.env);
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

