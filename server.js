const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mercadopago = require('mercadopago');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const axios = require('axios');


dotenv.config();

const app = express();

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true para 465, false para outros
    auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER || 'galosmurabrasill@gmail.com',
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || 'sua-senha-de-app'
    }
});

// Verificar conexão do e-mail
transporter.verify((error, success) => {
    if (error) {
        console.log('❌ [EMAIL] Erro na configuração:', error.message);
        console.log('⚠️ Configure as variáveis SMTP_USER e SMTP_PASS no .env');
    } else {
        console.log('✅ [EMAIL] Servidor de e-mail pronto para enviar mensagens');
    }
});


// Configuração de Segurança CORS (Simplificada para Testes e Produção)
app.use(cors()); // Allow all for local development/testing

// Rota de Diagnóstico (Health Check)
app.get('/health', (req, res) => {
    res.send('<h1>Mura Engine Online! 🚀</h1>');
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});
app.use(bodyParser.json());

// Paths - PERSISTENCE LOGIC (Render Starter)
const MOUNTED_DISK_PATH = '/data'; // Based on our Render Disk setup
const DATA_DIR = fs.existsSync(MOUNTED_DISK_PATH) ? MOUNTED_DISK_PATH : path.join(__dirname, 'data');

const DB_PATH = path.join(DATA_DIR, 'db.json');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');
const LEADS_PATH = path.join(DATA_DIR, 'leads.json');
const ANALYTICS_PATH = path.join(DATA_DIR, 'analytics.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads'); // Move uploads to disk too!

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initial Data Migration (Move local files to persistent disk if disk is empty)
const LOCAL_DB = path.join(__dirname, 'data', 'db.json');
const LOCAL_HISTORY = path.join(__dirname, 'data', 'history.json');

if (DATA_DIR === MOUNTED_DISK_PATH) {
    if (!fs.existsSync(DB_PATH) && fs.existsSync(LOCAL_DB)) {
        fs.copyFileSync(LOCAL_DB, DB_PATH);
        console.log('📦 [MIGRAÇÃO] Banco de dados movido para o DISCO PERSISTENTE.');
    }
    if (!fs.existsSync(HISTORY_PATH) && fs.existsSync(LOCAL_HISTORY)) {
        fs.copyFileSync(LOCAL_HISTORY, HISTORY_PATH);
        console.log('📦 [MIGRAÇÃO] Histórico movido para o DISCO PERSISTENTE.');
    }
}

if (!fs.existsSync(HISTORY_PATH)) fs.writeFileSync(HISTORY_PATH, '[]');
if (!fs.existsSync(LEADS_PATH)) fs.writeFileSync(LEADS_PATH, '[]');
if (!fs.existsSync(ANALYTICS_PATH)) fs.writeFileSync(ANALYTICS_PATH, JSON.stringify({
    totals: {
        clicks: 0, checkoutOpens: 0, checkoutStarts: 0,
        uiErrors: 0, trustClicks: 0, mobileSessions: 0,
        desktopSessions: 0, slowLoads: 0, pageViews: 0,
        emailClicks: 0
    },
    daily: {}
}, null, 4));

// Serve static files
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Helpers
// In-memory cache for DB
let cacheDB = null;

function getDB() {
    // Forçar a leitura do arquivo para evitar dados em cache quando editamos o arquivo manualmente
    // if (cacheDB) return cacheDB; 
    try {
        cacheDB = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        return cacheDB;
    } catch (e) {
        return { products: {}, orderBumps: {} };
    }
}
function saveDB(data) {
    cacheDB = data;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4));
}

function getHistory() {
    try {
        return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    } catch (e) {
        return [];
    }
}
function saveHistory(data) { fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 4)); }

function getLeads() {
    try {
        return JSON.parse(fs.readFileSync(LEADS_PATH, 'utf8'));
    } catch (e) {
        return [];
    }
}
function saveLeads(data) { fs.writeFileSync(LEADS_PATH, JSON.stringify(data, null, 4)); }

function getAnalytics() {
    try {
        let analytics = {
            totals: {
                clicks: 0, checkoutOpens: 0, checkoutStarts: 0,
                uiErrors: 0, trustClicks: 0,
                mobileSessions: 0, desktopSessions: 0, slowLoads: 0, pageViews: 0,
                emailClicks: 0, uniqueVisits: 0, ctaClicks: 0, checkoutAbandons: 0,
                videoPlay: 0 // New Metric
            },
            daily: {}
        };

        if (fs.existsSync(ANALYTICS_PATH)) {
            const fileData = JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf8'));

            // Migration for old flat structure
            if (!fileData.totals && fileData.pageViews !== undefined) {
                analytics.totals = { ...analytics.totals, ...fileData };
            } else {
                analytics = { ...analytics, ...fileData };
            }
        }

        const history = getHistory();
        const approvedSales = history.filter(h => h && (h.status === 'approved' || h.total > 0));
        const totalRevenue = approvedSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

        return {
            ...analytics,
            totalRevenue: totalRevenue,
            approvedCount: approvedSales.length,
            historyCount: history.length
        };
    } catch (e) {
        console.error("❌ [ANALYTICS ERROR]", e.message);
        return {
            totals: {
                clicks: 0, checkoutOpens: 0, checkoutStarts: 0,
                uiErrors: 0, trustClicks: 0, mobileSessions: 0,
                desktopSessions: 0, slowLoads: 0, pageViews: 0,
                emailClicks: 0, uniqueVisits: 0, ctaClicks: 0, checkoutAbandons: 0,
                videoPlay: 0
            },
            daily: {},
            totalRevenue: 0, approvedCount: 0, historyCount: 0
        };
    }
}

function saveAnalytics(data) {
    try {
        const toSave = {
            totals: data.totals,
            daily: data.daily
        };
        fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(toSave, null, 4));
    } catch (e) {
        console.error("❌ [SAVE ANALYTICS ERROR]", e.message);
    }
}

// --- RESTORED LOGIC ---

// 1. Mercado Pago Client (v2)
const { MercadoPagoConfig, Payment } = mercadopago;
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);

// 2. Helper: Log Sale to History
function logSale(customer, items, paymentId, method) {
    const history = getHistory();

    // Check if sale already exists to avoid duplicates
    const exists = history.some(h => String(h.paymentId) === String(paymentId));
    if (exists) {
        console.log(`ℹ️ [HISTORY] Venda ${paymentId} já registrada. Pulando...`);
        return;
    }

    const sale = {
        id: paymentId,
        paymentId: paymentId,
        date: new Date().toISOString(),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        items: items.map(i => i.title),
        total: items.reduce((acc, i) => acc + Number(i.price), 0),
        method: method,
        status: 'approved'
    };
    history.push(sale);
    saveHistory(history);
    console.log(`📝 [HISTORY] Venda registrada: ${sale.id} - ${sale.items.length} itens`);
}

function debugWebhook(data) {
    try {
        const debugPath = path.join(DATA_DIR, 'webhook_debug.json');
        let logs = [];
        if (fs.existsSync(debugPath)) {
            logs = JSON.parse(fs.readFileSync(debugPath, 'utf8'));
        }
        logs.unshift({
            timestamp: new Date().toISOString(),
            data: data
        });
        // Keep last 50 logs
        if (logs.length > 50) logs = logs.slice(0, 50);
        fs.writeFileSync(debugPath, JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error("❌ [WEBHOOK DEBUG ERROR]", e.message);
    }
}

// 3. API Config (Required for Frontend Products)
app.get('/api/config', (req, res) => {
    res.set('Cache-Control', 'no-store');
    // Return the cached DB which contains products and bumps
    res.json(getDB());
});

app.post('/api/config/update', (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== (process.env.ADMIN_PASSWORD || 'mura2026')) return res.status(401).json({ error: 'Acesso Negado' });

    const data = req.body;
    if (!data || !data.products) return res.status(400).json({ error: 'Dados inválidos' });

    console.log('💾 [ADMIN] Salvando novas configurações...');
    saveDB(data);
    res.json({ success: true });
});

app.post('/api/config/reset', (req, res) => {
    const { password } = req.body;
    if (password !== (process.env.ADMIN_PASSWORD || 'mura2026')) return res.status(401).json({ error: 'Acesso Negado' });

    // FACTORY RESET LOGIC
    try {
        if (fs.existsSync(LOCAL_DB)) {
            // Overwrite persistence with source code DB
            fs.copyFileSync(LOCAL_DB, DB_PATH);
            cacheDB = null; // Clear RAM cache

            console.log('🚨 [RESET] Sistema restaurado para padrão de fábrica pelo Admin.');
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Arquivo original de fábrica não encontrado.' });
        }
    } catch (e) {
        console.error("Reset Error:", e);
        res.status(500).json({ error: 'Falha ao restaurar sistema.' });
    }
});

// 4. Admin History & Analytics API
app.get('/api/history', (req, res) => {
    const password = req.params.password || req.query.password || req.headers['x-admin-password'];
    if (password !== (process.env.ADMIN_PASSWORD || 'mura2026')) return res.status(401).json({ error: 'Acesso Negado' });
    res.json(getHistory());
});

app.post('/api/history/clear', (req, res) => {
    const { password } = req.body;
    if (password !== (process.env.ADMIN_PASSWORD || 'mura2026')) return res.status(401).json({ error: 'Acesso Negado' });
    saveHistory([]);
    res.json({ success: true });
});

// 4.1 Leads API
app.get('/api/leads', (req, res) => {
    const password = req.params.password || req.query.password || req.headers['x-admin-password'];
    // Allow basic access for now or strictly enforce password
    if (password !== (process.env.ADMIN_PASSWORD || 'mura2026')) return res.status(401).json({ error: 'Acesso Negado' });
    res.json(getLeads());
});

app.post('/api/leads', (req, res) => {
    const { name, phone, source } = req.body;

    // Simple Validation
    if (!phone) return res.status(400).json({ error: 'WhatsApp é obrigatório' });

    const leads = getLeads();

    // Deduplication (by Phone)
    const existing = leads.find(l => l.phone === phone);

    if (existing) {
        console.log(`♻️ [LEAD] Lead retornou: ${phone}`);
        return res.json({ success: true, message: 'Lead já cadastrado' });
    }

    const newLead = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        name: name || 'Sem Nome',
        phone: phone,
        source: source || 'unknown'
    };

    leads.push(newLead);
    saveLeads(leads);

    console.log(`🎯 [LEAD] Novo lead capturado: ${name} (${phone})`);
    res.json({ success: true });
});

app.get('/api/analytics', (req, res) => {
    // Allow basic analytics without auth or require it? keeping consistent
    const password = req.params.password || req.query.password || req.headers['x-admin-password'];
    // if (password !== (process.env.ADMIN_PASSWORD || 'mura2026')) return res.status(401).json({ error: 'Acesso Negado' });
    // Allow analytics to be fetched by admin panel freely if CORS allows
    res.json(getAnalytics());
});

app.post('/api/track', (req, res) => {
    const { type, isMobile, ctaId, details } = req.body;

    // LOGGING MELHORADO PARA O RENDER
    if (type === 'payment_method_selected') {
        const icon = details === 'card' ? '💳' : '💠';
        console.log(`${icon} [CHECKOUT UI] Cliente alterou para: ${details ? details.toUpperCase() : 'N/A'}`);
    }
    else if (type === 'checkout_error' || type === 'ui_error') {
        console.error(`❌ [CHECKOUT UI ERROR] ${details || 'Erro desconhecido'}`);
    }
    else {
        console.log(`📈 [TRACK] Evento: ${type}, Mobile: ${isMobile}, CTA: ${ctaId || 'N/A'}`);
    }

    const analytics = getAnalytics();
    const today = new Date().toISOString().split('T')[0];

    // Ensure today's bucket exists
    if (!analytics.daily[today]) {
        analytics.daily[today] = {
            clicks: 0, checkoutOpens: 0, checkoutStarts: 0,
            uiErrors: 0, trustClicks: 0, mobileSessions: 0,
            desktopSessions: 0, slowLoads: 0, pageViews: 0,
            emailClicks: 0, uniqueVisits: 0, ctaClicks: 0, checkoutAbandons: 0,
            ctaBreakdown: {} // Detailed CTA ID breakdown
        };
    }

    const t = analytics.totals;
    const d = analytics.daily[today];

    // Helper to safely increment
    const increment = (key) => {
        if (t[key] !== undefined) t[key]++; else t[key] = 1;
        if (d[key] !== undefined) d[key]++; else d[key] = 1;
    };

    if (type === 'click') increment('clicks');
    else if (type === 'unique_visit') increment('uniqueVisits');
    else if (type === 'cta_click') {
        increment('ctaClicks');
        if (ctaId) {
            d.ctaBreakdown = d.ctaBreakdown || {};
            d.ctaBreakdown[ctaId] = (d.ctaBreakdown[ctaId] || 0) + 1;
        }
    }
    else if (type === 'checkout_open') increment('checkoutOpens');
    else if (type === 'checkout_start') increment('checkoutStarts');
    else if (type === 'checkout_abandon') increment('checkoutAbandons');
    else if (type === 'ui_error' || type === 'checkout_error') increment('uiErrors');
    else if (type === 'trust_click') increment('trustClicks');
    else if (type === 'slow_load') increment('slowLoads');
    else if (type === 'session_start') {
        increment('pageViews');
        if (isMobile) increment('mobileSessions');
        else increment('desktopSessions');
    }
    else if (type === 'video_play') {
        increment('videoPlay');
    }

    saveAnalytics(analytics);
    res.json({ success: true });
});

app.get('/api/products/:id', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const db = getDB();
    const product = db.products[req.params.id];
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

    // CORREÇÃO: Busca em orderBumps E products (para permitir upsell de produtos como o ebook-manejo)
    const bumps = (product.orderBumps || []).map(id => db.orderBumps[id] || db.products[id]).filter(k => k);

    res.json({ ...product, fullBumps: bumps });
});

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    res.json({ url: `/uploads/${req.file.filename}` });
});



// --- 3. SECURITY: Expiring Download Tokens ---
const crypto = require('crypto');
const SECRET_KEY = process.env.JWT_SECRET || 'mura-galinhas-secret-2026';

function generateDownloadToken(email, items, paymentId = null) {
    const expires = Date.now() + (12 * 60 * 60 * 1000); // 12 horas (Segurança Estrita)
    const data = `${email}|${items.map(i => i.id || i.title).join(',')}|${expires}${paymentId ? `|${paymentId}` : ''}`;
    const hash = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');
    return Buffer.from(`${data}|${hash}`).toString('base64');
}

// Email Sender Function con Design Premium y Seguridad
async function sendEmail(customer, items, paymentId = null) {
    console.log(`📧 [EMAIL] Preparando envio PREMIUM para: ${customer.email}`);

    // Simplified Link Logic with Tracking Token (User Request)
    const downloadToken = generateDownloadToken(customer.email, items, paymentId);
    const downloadLink = `${process.env.BASE_URL || 'https://teste-m1kq.onrender.com'}/api/access/${downloadToken}`;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .email-body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; background: #fdfdfd; }
                .header { background: linear-gradient(135deg, #000 0%, #1a1a1a 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; border-bottom: 3px solid #D4AF37; }
                .content { padding: 40px 30px; background: #fff; border: 1px solid #eee; border-top: none; borderRadius: 0 0 12px 12px; }
                .btn { display: inline-block; background: #D4AF37; background: linear-gradient(to bottom, #FFD700, #D4AF37); color: #000 !important; padding: 18px 35px; text-decoration: none; font-weight: 900; border-radius: 50px; font-size: 18px; text-transform: uppercase; box-shadow: 0 10px 20px rgba(212, 175, 55, 0.3); margin: 20px 0; }
                .item-card { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #D4AF37; }
                .badge { background: #2ecc71; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            </style>
        </head>
        <body class="email-body">
            <div class="header">
                <img src="https://osegredodasgalinhas.pages.dev/logo.png" alt="Logo" style="height: 50px; margin-bottom: 15px;">
                <h1 style="color: #FFD700; margin: 0; font-size: 26px;">ACESSO LIBERADO! 🚀</h1>
            </div>
            
            <div class="content">
                <p style="font-size: 18px;">Olá, <strong>${customer.name}</strong>!</p>
                <p>Parabéns pela sua decisão. Seu pagamento foi confirmado e seus materiais já estão prontos para você começar hoje mesmo.</p>
                
                <div style="text-align: center; margin: 40px 0;">
                    <a href="${downloadLink}" class="btn">ACESSAR MEUS MATERIAIS ➔</a>
                    <p style="color: #666; font-size: 13px; margin-top: 15px;">O acesso é vitalício. Guarde este e-mail.</p>
                </div>
                
                <h3 style="color: #000; font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">ITENS DO SEU PEDIDO:</h3>
                ${items.map(item => `
                    <div class="item-card">
                        <span class="badge">APROVADO</span>
                        <div style="margin-top: 5px; font-weight: bold; color: #1a1a1a;">${item.title}</div>
                    </div>
                `).join('')}
                
                <div class="security-note">
                    <p><strong>PRECISA DE AJUDA?</strong></p>
                    <a href="https://wa.me/5538999832950?text=Olá,%20preciso%20de%20ajuda%20com%20meu%20acesso" 
                       style="display: inline-block; background: #25D366; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0;">
                        📱 Falar no WhatsApp
                    </a>
                    <p style="margin-top: 20px;"><strong>DICA DE SEGURANÇA:</strong> Por proteção ao seu conteúdo, este link é rastreável e expira em 12 horas. Caso precise de ajuda, chame no suporte via WhatsApp.</p>
                    <p>© 2026 Galos Mura Brasil - Todos os direitos reservados.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: '"Galos Mura Brasil" <galosmurabrasill@gmail.com>',
            to: customer.email,
            subject: '✅ Seu Acesso Chegou! - O Segredo das Galinhas',
            html: htmlContent
        });

        console.log(`✅ [EMAIL] Enviado com sucesso! ID: ${info.messageId}`);
        return true;
    } catch (err) {
        console.error('❌ [EMAIL ERROR] Falha no envio Gmail:', err.message);
        return false;
    }
}

// ROTA DE TESTE DE EMAIL (Resend)
app.get('/test-email', async (req, res) => {
    try {
        console.log("🛠️ [TESTE] Iniciando teste de fluxo completo de email...");
        const customer = {
            name: 'Cliente Teste Mura',
            email: 'galosmurabrasill@gmail.com',
            phone: '38999832950'
        };
        const items = [
            { id: 'manejo', title: 'Manual de Manejo (Teste)', price: 10 },
            { id: 'doencas', title: 'Guia de Doenças (Teste)', price: 5 }
        ];

        await sendEmail(customer, items);

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Teste Gmail SMTP Enviado! 🚀</h1>
                <p>O servidor tentou enviar um e-mail para <b>galosmurabrasill@gmail.com</b>.</p>
                <p>Verifique agora os <b>Registros (Logs) do Render</b> para confirmar o status.</p>
            </div>
        `);
    } catch (error) {
        res.status(500).send(`<h1>Erro no Teste! ❌</h1><p>${error.message}</p>`);
    }
});

// Ebook Download Routes
app.get('/download/:type', (req, res) => {
    const type = req.params.type;
    const token = req.query.t;
    let filePath = '';
    let fileName = '';

    // TRACKING LOGIC
    if (token) {
        try {
            const decoded = Buffer.from(token, 'base64').toString();
            const parts = decoded.split('|');
            // email|items|expires|paymentId|hash
            if (parts.length >= 4) {
                const paymentId = parts[3];
                const history = getHistory();
                const saleIdx = history.findIndex(h => h.paymentId === paymentId);
                if (saleIdx > -1) {
                    history[saleIdx].downloaded = true;
                    history[saleIdx].downloadDate = new Date().toISOString();
                    saveHistory(history);
                    console.log(`📥 [TRACK] Cliente ${history[saleIdx].email} baixou o arquivo: ${type}`);
                }
            }
        } catch (err) {
            console.error("Download tracking error:", err);
        }
    }

    if (type === 'manejo') {
        filePath = path.join(__dirname, 'ebook_manejo.pdf');
        fileName = 'Manual_Manejo_Pintinhos.pdf';
    } else if (type === 'doencas') {
        filePath = path.join(__dirname, 'ebook_doencas.pdf');
        fileName = 'Guia_Doencas_Avicolas.pdf';
    } else if (type === 'orderbump' || type === 'bump') {
        filePath = path.join(__dirname, 'ebook_orderbump.pdf');
        fileName = 'Tabela_Racao_Completa.pdf';
    } else {
        filePath = path.join(__dirname, 'ebook.pdf');
        fileName = 'Ebook_O_Segredo_das_Galinhas.pdf';
    }

    // Debug logging
    console.log(`[DOWNLOAD] Request for type: ${type}`);
    console.log(`[DOWNLOAD] Target path: ${filePath}`);

    if (fs.existsSync(filePath)) {
        console.log(`[DOWNLOAD] File found! Sending: ${fileName}`);
        res.download(filePath, fileName);
    } else {
        console.error(`[DOWNLOAD] File NOT found at: ${filePath}`);

        // Retornar erro 404 direto se o arquivo específico não existir
        res.status(404).send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Ops! Arquivo não encontrado.</h1>
                <p>Não foi possível localizar o arquivo: <strong>${fileName}</strong></p>
                <p>Nosso sistema registrou esse erro e já estamos verificando.</p>
                <p>Enquanto isso, clique abaixo para receber pelo WhatsApp:</p>
                <a href="https://wa.me/5538999832950?text=Ola,%20tive%20erro%20ao%20baixar%20o%20arquivo%20${encodeURIComponent(fileName)}" 
                   style="display: inline-block; background: #25d366; color: white; padding: 15px 30px; text-decoration: none; border-radius: 30px; font-weight: bold; margin-top: 20px;">
                   <i class="fa fa-whatsapp"></i> Receber no WhatsApp
                </a>
            </div>
        `);
    }
});

// Downloads Page Route - Serves custom download page with purchased items
app.get('/downloads', (req, res) => {
    res.sendFile(path.join(__dirname, 'downloads.html'));
});

// Helper Function for detailed Error Logging
function formatErrorLog(context, customer, error) {
    let msg = `❌ [${context} ERROR]`;
    if (customer && customer.email) msg += ` Cliente: ${customer.email} |`;

    if (error.response && error.response.data && error.response.data.cause) {
        const causes = error.response.data.cause;
        const mainCause = Array.isArray(causes) ? causes[0] : causes;

        // Mapeamento de erros comuns do Mercado Pago
        if (mainCause.code === 2067) msg += ` CPF inválido ou mal formatado.`;
        else if (mainCause.code === 324) msg += ` CPF inválido (Não existente).`;
        else if (mainCause.code === 325) msg += ` Mês de validade inválido.`;
        else if (mainCause.code === 326) msg += ` Ano de validade inválido.`;
        else if (mainCause.code === 221) msg += ` Sobrenome ausente ou inválido.`;
        else if (mainCause.code === 214) msg += ` CPF ausente.`;
        else if (mainCause.code === 205) msg += ` Número do cartão nulo/inválido.`;
        else msg += ` Erro API: ${mainCause.description || JSON.stringify(mainCause)}`;
    }
    else if (error.message) {
        msg += ` Erro: ${error.message}`;
    }

    return msg;
}

app.post('/api/checkout/pix', async (req, res) => {
    const startTime = Date.now();
    const { items, customer, deliveryMethod } = req.body;
    console.log(`💠 [PIX] Nova solicitação Iniciada`);
    console.log(`👤 Cliente: ${customer.name} (${customer.email})`);

    const totalAmount = Number(items.reduce((acc, item) => acc + Number(item.price), 0).toFixed(2));
    console.log(`💰 Total Calculado: ${totalAmount}`);

    if (totalAmount <= 0) {
        console.error(`❌ [PIX ERROR] Valor inválido calculado: ${totalAmount}`);
        return res.status(400).json({ error: 'Erro no valor do pedido', message: 'O valor total deve ser maior que zero.' });
    }

    // CRITICAL: Ensure CPF is clean (only numbers, no formatting)
    const cleanCPF = (customer.cpf || '').replace(/\D/g, '');

    if (cleanCPF.length !== 11) {
        console.error(`❌ [PIX ERROR] CPF inválido: ${customer.cpf} (limpo: ${cleanCPF})`);
        return res.status(400).json({
            error: 'CPF inválido',
            message: 'O CPF deve conter exatamente 11 dígitos.'
        });
    }

    const body = {
        transaction_amount: totalAmount,
        description: items.map(i => i.title).join(', ').slice(0, 256),
        payment_method_id: 'pix',
        external_reference: `ORDER-${Date.now()}`,
        notification_url: `${process.env.BASE_URL || 'https://teste-m1kq.onrender.com'}/api/webhooks/mercadopago`,
        statement_descriptor: 'GALOSMURA',
        payer: {
            email: customer.email.trim(),
            first_name: customer.name.split(' ')[0],
            last_name: customer.name.split(' ').slice(1).join(' ') || 'Cliente',
            identification: { type: 'CPF', number: cleanCPF }
        },
        metadata: {
            delivery_method: deliveryMethod,
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone
        }
    };

    try {
        const response = await payment.create({ body });

        console.log(`✅ [PIX SUCCESS] payment_id=${response.id} customer=${customer.email}`);

        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64,
            id: response.id,
            status: response.status
        });
    } catch (error) {
        // LOG DE ERRO MELHORADO
        console.error(formatErrorLog('PIX', customer, error));

        res.status(500).json({
            error: 'Erro ao gerar PIX',
            message: error.message,
            details: error.response ? error.response.data : (error.cause || 'Sem detalhes')
        });
    }
});

app.post('/api/checkout/card', async (req, res) => {
    try {
        const { items, customer, token, installments, issuer_id, payment_method_id } = req.body;
        console.log(`💳 [CARTÃO] Iniciando Processamento`);
        console.log(`👤 Cliente: ${customer.name} (${customer.email})`);
        console.log(`📦 Itens: ${items.length}`);
        console.log(`🔢 Parcelas: ${installments}, Method: ${payment_method_id}`);

        const totalAmount = Number(items.reduce((acc, item) => acc + Number(item.price), 0).toFixed(2));
        console.log(`💰 Total Calculado: ${totalAmount}`);

        if (totalAmount <= 0) {
            console.error(`❌ [CARTÃO ERROR] Valor inválido calculado: ${totalAmount}`);
            return res.status(400).json({ error: 'Erro no valor do pedido', message: 'O valor total deve ser maior que zero.' });
        }

        // CRITICAL: Ensure CPF is clean (only numbers, no formatting)
        const cleanCPF = (customer.cpf || '').replace(/\D/g, '');

        if (cleanCPF.length !== 11) {
            console.error(`❌ [CARTÃO ERROR] CPF inválido: ${customer.cpf} (limpo: ${cleanCPF})`);
            return res.status(400).json({
                error: 'CPF inválido',
                message: 'O CPF deve conter exatamente 11 dígitos.'
            });
        }

        // Clean and format phone for Mercado Pago (country code + area code + number)
        const cleanPhone = (customer.phone || '').replace(/\D/g, '');
        const phoneAreaCode = cleanPhone.slice(0, 2);
        const phoneNumber = cleanPhone.slice(2);

        // Get client IP properly
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || req.socket.remoteAddress
            || '127.0.0.1';

        const body = {
            transaction_amount: totalAmount,
            token: token,
            description: items.map(i => i.title).join(', ').slice(0, 256), // MP limit
            installments: Number(installments),
            payment_method_id,
            issuer_id: issuer_id || null,
            binary_mode: false, // OTIMIZAÇÃO: Permite pagamentos pendentes de revisão (aumenta aprovação)
            capture: true, // Captura imediata
            external_reference: `ORDER-${Date.now()}`,
            notification_url: `${process.env.BASE_URL || 'https://teste-m1kq.onrender.com'}/api/webhooks/mercadopago`,
            statement_descriptor: 'GALOSMURA', // Máximo 13 caracteres sem espaços
            payer: {
                email: customer.email,
                first_name: customer.name.split(' ')[0],
                last_name: customer.name.split(' ').slice(1).join(' ') || 'Cliente',
                identification: { type: 'CPF', number: cleanCPF },
                phone: {
                    area_code: phoneAreaCode || '11',
                    number: phoneNumber || '999999999'
                }
            },
            additional_info: {
                ip_address: clientIP,
                items: items.map((item, idx) => ({
                    id: item.id || `item-${idx}`,
                    title: item.title.slice(0, 256),
                    description: (item.description || item.title).slice(0, 256),
                    category_id: 'others', // Categoria mais genérica para evitar restrições
                    quantity: 1,
                    unit_price: Number(item.price)
                })),
                payer: {
                    first_name: customer.name.split(' ')[0],
                    last_name: customer.name.split(' ').slice(1).join(' ') || 'Cliente',
                    phone: {
                        area_code: phoneAreaCode || '11',
                        number: phoneNumber || '999999999'
                    },
                    registration_date: new Date().toISOString(),
                    address: {
                        zip_code: customer.cep || '00000000',
                        street_name: 'Não Informado',
                        street_number: 0
                    }
                }
            },
            metadata: {
                delivery_method: 'email',
                customer_phone: customer.phone,
                customer_name: customer.name,
                customer_email: customer.email,
                customer_cep: customer.cep
            }
        };

        // Add Device ID if provided (CRITICAL for Anti-Fraud - aumenta aprovação)
        if (req.body.deviceId) {
            console.log(`📱 [CARTÃO] Device ID recebido: ${req.body.deviceId}`);
            body.additional_info.payer.device_id = req.body.deviceId;
        }

        console.log(`🚀 [CARTÃO] Enviando para Mercado Pago...`);
        const response = await payment.create({ body });
        console.log(`📩 [CARTÃO] Resposta MP: status=${response.status}, detail=${response.status_detail}`);

        if (response.status === 'approved') {
            console.log(`✅ [CARTÃO] Pagamento aprovado! ID: ${response.id}`);
            logSale(customer, items, response.id, 'cartão');
            sendEmail(customer, items, response.id);

            const downloadToken = generateDownloadToken(customer.email, items, response.id);
            res.json({ status: 'approved', id: response.id, redirectToken: downloadToken });

        } else if (response.status === 'in_process' || response.status === 'pending') {
            // OTIMIZAÇÃO: Aceita pagamentos em análise/pendente (comum em primeiras compras)
            console.log(`⏳ [CARTÃO] Pagamento em análise! ID: ${response.id}`);
            res.json({
                status: response.status,
                status_detail: response.status_detail,
                id: response.id,
                message: 'Pagamento em análise. Você receberá a confirmação por e-mail em até 2 dias úteis.'
            });

        } else {
            console.warn(`❌ [CARTÃO] Pagamento Recusado: ${response.status} (${response.status_detail})`);
            res.status(400).json({ status: response.status, status_detail: response.status_detail });
        }
    } catch (error) {
        const customerRef = req.body.customer || { email: 'desconhecido' };
        console.error(formatErrorLog('CARTÃO', customerRef, error));

        res.status(500).json({
            error: 'Erro ao processar pagamento',
            message: error.message,
            details: error.response ? error.response.data : (error.cause || 'No details')
        });
    }
});

app.get('/api/payment/:id', async (req, res) => {
    try {
        const result = await payment.get({ id: req.params.id });

        // Fallback: If approved but not logged, log it now
        if (result.status === 'approved') {
            const metadata = result.metadata || {};
            const customer = {
                name: metadata.customer_name || (result.payer && result.payer.first_name
                    ? `${result.payer.first_name} ${result.payer.last_name || ''}`.trim()
                    : 'Cliente'),
                email: metadata.customer_email || (result.payer && result.payer.email) || 'galosmurabrasill@gmail.com',
                phone: metadata.customer_phone || 'Sem Telefone'
            };
            const itemTitles = (result.description || 'Produto').split(', ');
            const items = itemTitles.map(title => ({
                title: title,
                price: result.transaction_amount / itemTitles.length
            }));

            logSale(customer, items, result.id, result.payment_method_id === 'pix' ? 'pix' : 'cartão');

            // Generate Secure Token for Redirect
            const token = generateDownloadToken(customer.email, items, result.id);
            return res.json({
                id: result.id,
                status: result.status,
                status_detail: result.status_detail,
                redirectToken: token
            });
        }


        res.json({ id: result.id, status: result.status, status_detail: result.status_detail });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
});

app.post('/api/webhooks/mercadopago', async (req, res) => {
    // Debug entry
    debugWebhook({
        query: req.query,
        body: req.body,
        headers: req.headers
    });

    // Extraction pattern for modern V2 webhooks (data.id) and legacy (id/topic)
    const topic = req.query.topic || req.query.type || req.body.topic || req.body.type || req.body.action;
    const paymentId = req.query.id || (req.body.data && req.body.data.id) || req.body.id;

    console.log(`📡 [WEBHOOK] Chamada recebida! Topic/Action: ${topic}, ID: ${paymentId}`);

    // If it's a test notification or missing ID, just return 200
    if (!paymentId) {
        return res.sendStatus(200);
    }

    // Mercado Pago sends 'payment.updated' or simply calls it 'payment' topic
    // Some integrations use 'action' like 'payment.created'
    if (topic && (topic.includes('payment') || topic === 'opened_checkout')) {
        try {
            const paymentResult = await payment.get({ id: paymentId });
            console.log(`🔔 [WEBHOOK] Status pagamento ${paymentId}: ${paymentResult.status} (${paymentResult.status_detail || 'sem detalhe'})`);

            if (paymentResult.status === 'approved') {
                console.log(`✅ [WEBHOOK] Pagamento Aprovado! ID: ${paymentId}`);

                // Check metadata
                const metadata = paymentResult.metadata || {};
                console.log(`📋 [WEBHOOK] Métadados encontrados:`, JSON.stringify(metadata));

                // Reconstruct customer data - Prioritize metadata
                const customer = {
                    name: metadata.customer_name || (paymentResult.payer && paymentResult.payer.first_name
                        ? `${paymentResult.payer.first_name} ${paymentResult.payer.last_name || ''}`.trim()
                        : 'Cliente'),
                    email: metadata.customer_email || (paymentResult.payer && paymentResult.payer.email) || 'galosmurabrasill@gmail.com',
                    phone: metadata.customer_phone || (paymentResult.payer && paymentResult.payer.phone ? paymentResult.payer.phone.area_code + paymentResult.payer.phone.number : 'Sem Telefone')
                };

                // Reconstruct items from description
                const itemTitles = (paymentResult.description || 'Produto').split(', ');
                const items = itemTitles.map(title => ({
                    title: title,
                    price: paymentResult.transaction_amount / itemTitles.length
                }));

                logSale(customer, items, paymentId, paymentResult.payment_method_id === 'pix' ? 'pix' : 'cartão');

                console.log(`📤 [WEBHOOK] Enviando e-mail automático...`);
                sendEmail(customer, items, paymentId);

                console.log(`📦 Venda registrada via Webhook: ${customer.name} - ${itemTitles.join(', ')}`);
            }
            res.sendStatus(200);
        } catch (error) {
            console.error('Webhook error processing payment:', paymentId, error.message);
            // Return 200 even on error to stop MP retries if we can't find it
            // but log it for debug.
            res.sendStatus(200);
        }
    } else {
        res.sendStatus(200);
    }
});

// --- 4. ADMIN: Resend & Tracking ---

app.post('/api/history/resend-email', (req, res) => {
    const { paymentId, password } = req.body;
    if (password !== (process.env.ADMIN_PASSWORD || 'mura2026')) return res.status(401).json({ error: 'Acesso Negado' });

    const history = getHistory();
    const sale = history.find(h => h.paymentId === paymentId);

    if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });

    const customer = {
        name: sale.name,
        email: sale.email,
        phone: sale.phone
    };

    // Note: sale.items is currently just titles in the history log. 
    // sendEmail uses them for display and token generation.
    const items = (sale.items || []).map(title => ({ title: title }));

    sendEmail(customer, items, paymentId)
        .then(success => {
            if (success) res.json({ success: true });
            else res.status(500).json({ error: 'Falha ao enviar e-mail' });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// Click Tracking Redirect
app.get('/api/access/:token', (req, res) => {
    const token = req.params.token;
    try {
        const decoded = Buffer.from(token, 'base64').toString();
        const parts = decoded.split('|');
        // Parts: email, items, expires, [paymentId], hash
        // The length depends on if paymentId was included (old vs new tokens)

        const analytics = getAnalytics();
        const today = new Date().toISOString().split('T')[0];
        if (!analytics.daily[today]) analytics.daily[today] = { clicks: 0, checkoutOpens: 0, checkoutStarts: 0, uiErrors: 0, trustClicks: 0, mobileSessions: 0, desktopSessions: 0, slowLoads: 0, pageViews: 0, emailClicks: 0, ctaClicks: {} };

        analytics.totals.emailClicks = (analytics.totals.emailClicks || 0) + 1;
        if (analytics.daily[today]) analytics.daily[today].emailClicks = (analytics.daily[today].emailClicks || 0) + 1;
        saveAnalytics(analytics);

        // Update history if paymentId is present
        let paymentId = null;
        if (parts.length === 5) { // email|items|expires|paymentId|hash
            paymentId = parts[3];
        }

        if (paymentId) {
            const history = getHistory();
            const saleIdx = history.findIndex(h => h.paymentId === paymentId);
            if (saleIdx > -1) {
                history[saleIdx].clickedEmail = true;
                history[saleIdx].clickDate = new Date().toISOString();
                saveHistory(history);
                console.log(`🕵️ [TRACK] Cliente ${history[saleIdx].email} clicou no e-mail.`);
            }
        }

        // Redirect to actual downloads page with items param
        const itemsStr = parts[1] || '';
        const redirectUrl = `https://osegredodasgalinhas.pages.dev/downloads.html?t=${encodeURIComponent(token)}&items=${encodeURIComponent(itemsStr)}`;
        res.redirect(redirectUrl);
    } catch (e) {
        console.error("Tracking error:", e);
        res.redirect(`https://osegredodasgalinhas.pages.dev/downloads.html?t=${token}`);
    }
});

// --- 5. ADMIN LOGS (OPCIONAL) ---

// --- 6. MURA IA DIALOGUE API ---
app.post('/api/mura/chat', async (req, res) => {
    const { password, message, history: chatHistory } = req.body;
    if (password !== (process.env.ADMIN_PASSWORD || 'mura2026')) return res.status(401).json({ error: 'Acesso Negado' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API Key não configurada no servidor.' });

    try {
        console.log(`🤖 [MURA IA] Processando pergunta: "${message.substring(0, 50)}..."`);
        const analytics = getAnalytics();
        const dbData = getDB();
        const productsCount = Object.keys(dbData.products).length;
        const bumpsCount = Object.keys(dbData.orderBumps).length;

        const systemInstruction = `Você é a MURA IA, uma assistente virtual de inteligência avançada e especialista em CRO (Otimização de Conversão) para o negócio "Galos Mura Brasil" (GMB).
Seu objetivo é ajudar o administrador do painel a entender o desempenho da página e sugerir melhorias práticas e estratégicas.

CONTEXTO ATUAL DO NEGÓCIO:
- Produtos Ativos: ${productsCount}
- Order Bumps configurados: ${bumpsCount}
- Total de Vendas Aprovadas: ${analytics.approvedCount}
- Faturamento Total: R$ ${analytics.totalRevenue.toFixed(2)}
- Visitas Únicas: ${analytics.totals.uniqueVisits}
- Visualizações de Vídeo (VSL): ${analytics.totals.videoPlay}
- Aberturas de Checkout: ${analytics.totals.checkoutOpens}
- Taxa de Retenção de Vídeo (Play/Visitas): ${((analytics.totals.videoPlay / (analytics.totals.uniqueVisits || 1)) * 100).toFixed(1)}%
- Taxa de Conversão de Checkout (Checkout/Play): ${((analytics.totals.checkoutOpens / (analytics.totals.videoPlay || 1)) * 100).toFixed(1)}%
- Taxa de Venda Final (Vendas/Checkout): ${((analytics.approvedCount / (analytics.totals.checkoutOpens || 1)) * 100).toFixed(1)}%

REGRAS DE RESPOSTA:
1. Seja direta, profissional, mas com um tom tecnológico e futurista.
2. Sempre que houver queda em alguma métrica (ex: pouca gente dando play no vídeo), sugira uma melhoria específica (ex: mudar a thumb, a headline ou o carregamento).
3. Use Markdown para formatar as respostas (negrito, listas, etc).
4. Se o usuário perguntar algo que não tem a ver com o negócio, traga o assunto de volta para a performance do GMB.
5. Suas sugestões devem ser baseadas em dados reais que eu te passei acima.

RESPONDA SEMPRE EM PORTUGUÊS (PT-BR).`;

        const payload = {
            system_instruction: {
                parts: [{ text: systemInstruction }]
            },
            contents: chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0
                ? [
                    ...chatHistory.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    })),
                    { role: "user", parts: [{ text: message }] }
                ]
                : [{ role: "user", parts: [{ text: message }] }]
        };

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
            payload,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            }
        );

        if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
            console.error("❌ [GEMINI ERROR] Resposta inválida da API:", JSON.stringify(response.data));
            return res.status(500).json({ error: 'A IA não retornou uma resposta válida.' });
        }

        const aiText = response.data.candidates[0].content.parts[0].text;
        res.json({ response: aiText });

    } catch (error) {
        const errorDetail = error.response?.data?.error?.message || error.response?.data || error.message;
        console.error("❌ [MURA IA ERROR]", errorDetail);
        res.status(500).json({
            error: 'Erro na comunicação com a IA.',
            detail: errorDetail
        });
    }
});

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

console.log('⏳ Starting Mura Engine Server...');
app.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(40));
    console.log(`🚀 Mura Engine Online!`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Host: ${HOST}`);
    console.log(`📅 Time: ${new Date().toLocaleString()}`);
    console.log('='.repeat(40) + '\n');
});

