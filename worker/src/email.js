import { generateDownloadToken } from './utils.js';
import { sendCAPIEvent } from './capi.js';

// Envia os dados para o webhook do Make.com que disparará o e-mail via Gmail
// E dispara o Purchase server-side via Meta CAPI para atribuição confiável
export async function sendEmail(env, customer, items, paymentId = null, facebookEventId = null, fbc = null, fbp = null, userAgent = null, clientIp = null) {
    try {
        if (!customer || !customer.email || customer.email.trim() === '') {
            console.warn('[EMAIL WARNING] Tentativa de envio abortada. E-mail não fornecido.');
            return false;
        }

        const BASE_URL = env.BASE_URL || 'https://mura-api.joaopaulojaguar.workers.dev';
        const downloadToken = await generateDownloadToken(customer.email, items, paymentId, env);
        const downloadLink = `${BASE_URL}/api/access/${downloadToken}`;

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
  .header { background: linear-gradient(135deg, #000 0%, #1a1a1a 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; border-bottom: 3px solid #D4AF37; }
  .content { padding: 40px 30px; background: #fff; border: 1px solid #eee; border-radius: 0 0 12px 12px; }
  .btn { display: inline-block; background: linear-gradient(to bottom, #FFD700, #D4AF37); color: #000 !important; padding: 18px 35px; text-decoration: none; font-weight: 900; border-radius: 50px; font-size: 18px; text-transform: uppercase; box-shadow: 0 10px 20px rgba(212,175,55,0.3); margin: 20px 0; }
  .item-card { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #D4AF37; }
  .badge { background: #2ecc71; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header">
    <img src="https://teste-dl7.pages.dev/logo.webp" alt="Logo" style="max-width:180px;height:auto;margin-bottom:15px;">
    <h1 style="color:#FFD700;margin:0;font-size:26px;">ACESSO LIBERADO! 🚀</h1>
  </div>
  <div class="content">
    <p style="font-size:18px;">Olá, <strong>${customer.name}</strong>!</p>
    <p>Parabéns pela sua decisão. Seu pagamento foi confirmado e seus materiais já estão prontos.</p>
    <div style="text-align:center;margin:40px 0;">
      <a href="${downloadLink}" class="btn">ACESSAR MEUS MATERIAIS ➔</a>
      <p style="color:#666;font-size:13px;margin-top:15px;">O acesso é vitalício. Guarde este e-mail.</p>
    </div>

    <div style="margin-top:30px;">
      <p><strong>PRECISA DE AJUDA?</strong></p>
      <a href="https://wa.me/5538999832950?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20meu%20acesso"
         style="display:inline-block;background:#25D366;color:white;padding:12px 25px;text-decoration:none;border-radius:8px;font-weight:bold;">
        📱 Falar no WhatsApp
      </a>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#666;">© 2026 Galos Mura Brasil — Todos os direitos reservados.</p>
  </div>
</body>
</html>`;

        const webhookUrl = 'https://hook.us2.make.com/jelleujxca0ntlko5lirhhsfdvlyhetf';
        const payload = {
            to: customer.email,
            subject: '✅ Seu Acesso Chegou! - O Segredo das Galinhas',
            html: htmlContent,
            text: `Olá ${customer.name}, seu acesso foi liberado!\n\nPara baixar seus materiais, acesse o link abaixo:\n${downloadLink}\n\nSe tiver qualquer dúvida, me mande uma mensagem no WhatsApp:\nhttps://wa.me/5538999832950?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20meu%20acesso\n\nAtt,\nProtocolo Elite`,
            download_link: downloadLink,
            customer_name: customer.name,
            whatsapp_link: 'https://wa.me/5538999832950?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20meu%20acesso',
            facebook_event_id: facebookEventId,
            fbc: fbc,
            fbp: fbp,
            client_user_agent: userAgent
        };

        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('[EMAIL ERROR] Falha no disparo pro Make.com');
            // Mesmo se email falhar, CAPI deve disparar
        } else {
            console.log(`[EMAIL] Webhook acionado para ${customer.email}`);
        }

        // ── META CAPI: Purchase server-side ──────────────────────────
        // CPF, cidade, estado — tudo que tiver disponível vai hasheado
        const totalValue = items.reduce((acc, i) => acc + Number(i.price || 0), 0);
        const contentIds = items.map(i => i.id || i.title);
        const contentName = items.map(i => i.title).join(', ');
        const sourceUrl = env.SITE_URL
            ? `${env.SITE_URL}/downloads.html`
            : 'https://osegredodasgalinhas.pages.dev/downloads.html';

        try {
            await sendCAPIEvent(env, {
                eventName: 'Purchase',
                eventId: facebookEventId,
                customer: {
                    name:  customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    cpf:   customer.cpf,    // ← CPF agora incluído
                    city:  customer.city,
                    state: customer.state,
                    zip:   customer.zip,
                },
                meta: {
                    fbc,
                    fbp,
                    userAgent,
                    clientIp,
                },
                value: totalValue,
                currency: 'BRL',
                contentIds,
                contentName,
                sourceUrl,
            });
        } catch (capiErr) {
            console.error('[CAPI ERROR]', capiErr.message);
        }

        return true;

    } catch (err) {
        console.error('[EMAIL EXCEPTION]', err.message);
        return false;
    }
}


