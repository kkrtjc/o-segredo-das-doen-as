// ============================================================
// DOWNLOADS — Serve PDFs do Cloudflare R2
// Equivalente a GET /download/:type do server.js
// ============================================================

import { Hono } from 'hono';
import { generateDownloadToken } from './utils.js';
import { getHistory, saveHistory, getAnalytics, saveAnalytics } from './admin.js';

export const downloadRoutes = new Hono();

const fileMap = {
    manejo:    { key: 'ebook_manejo.pdf',    name: 'Manual_Manejo_Pintinhos.pdf' },
    doencas:   { key: 'ebook_doencas.pdf',   name: 'Guia_Doencas_Avicolas.pdf' },
    orderbump: { key: 'ebook_orderbump.pdf', name: 'Tabela_Racao_Completa.pdf' },
    bump:      { key: 'ebook_orderbump.pdf', name: 'Tabela_Racao_Completa.pdf' },
};

downloadRoutes.get('/download/:type', async (c) => {
    const type = c.req.param('type');
    const tokenParam = c.req.query('t');
    const file = fileMap[type];

    if (!file) return c.text('Arquivo não encontrado.', 404);

    // Tracking do download
    if (tokenParam) {
        try {
            const decoded = atob(tokenParam);
            const parts = decoded.split('|');
            if (parts.length >= 4) {
                const paymentId = parts[3];
                const history = await getHistory(c.env);
                const idx = history.findIndex(h => h.paymentId === paymentId);
                if (idx > -1) {
                    history[idx].downloaded = true;
                    history[idx].downloadDate = new Date().toISOString();
                    await saveHistory(c.env, history);
                }
            }
        } catch (_) {}
    }

    // Busca o PDF diretamente do frontend (novo método que dispensa o R2 / cartão)
    const frontendUrl = `https://teste-dl7.pages.dev/pdfs_secure_12x9a/${file.key}`;
    const pdfResponse = await fetch(frontendUrl);
    
    if (!pdfResponse.ok) {
        return c.html(`
            <div style="font-family:sans-serif;text-align:center;padding:50px;">
                <h1>Ops! Arquivo não encontrado.</h1>
                <p>Clique abaixo para receber pelo WhatsApp:</p>
                <a href="https://wa.me/5538999832950?text=Ol%C3%A1,%20tive%20erro%20ao%20baixar%20o%20arquivo"
                   style="display:inline-block;background:#25d366;color:white;padding:15px 30px;text-decoration:none;border-radius:30px;font-weight:bold;margin-top:20px;">
                   Receber no WhatsApp
                </a>
            </div>`, 404);
    }

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${file.name}"`);
    headers.set('Content-Type', 'application/pdf');
    headers.set('Cache-Control', 'no-store');

    // Retorna o arquivo (proxy stream)
    return new Response(pdfResponse.body, { headers });
});

// ─── ACCESS TOKEN REDIRECT (link do e-mail) ──────────────────
downloadRoutes.get('/api/access/:token', async (c) => {
    const token = c.req.param('token');
    const BASE_URL = 'https://teste-dl7.pages.dev';
    try {
        const decoded = atob(token);
        const parts = decoded.split('|');

        // Tracking de clique no email
        const analytics = await getAnalytics(c.env);
        analytics.totals.emailClicks = (analytics.totals.emailClicks || 0) + 1;
        await saveAnalytics(c.env, analytics);

        // Atualiza histórico
        if (parts.length >= 4) {
            const paymentId = parts[3];
            const history = await getHistory(c.env);
            const idx = history.findIndex(h => h.paymentId === paymentId);
            if (idx > -1) { history[idx].clickedEmail = true; history[idx].clickDate = new Date().toISOString(); }
            await saveHistory(c.env, history);
        }

        const itemsStr = parts[1] || '';
        return Response.redirect(`${BASE_URL}/downloads.html?t=${encodeURIComponent(token)}&items=${encodeURIComponent(itemsStr)}`, 302);
    } catch (e) {
        return Response.redirect(`${BASE_URL}/downloads.html?t=${token}`, 302);
    }
});
