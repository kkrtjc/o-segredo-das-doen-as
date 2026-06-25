import { sendCAPIEvent } from './capi.js';

// Envia os dados para o webhook do Make.com que disparará o e-mail via Gmail
// E dispara o Purchase server-side via Meta CAPI para atribuição confiável (Desduplicado cirurgicamente)
export async function sendEmail(env, customer, items, paymentId = null, facebookEventId = null, fbc = null, fbp = null, userAgent = null, clientIp = null, site = 'app', externalId = null) {
    try {
        // Validação rigorosa de e-mail para evitar erro no Make/Gmail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!customer || !customer.email || !emailRegex.test(customer.email.trim())) {
            console.warn(`[EMAIL ABORTED] E-mail inválido ou ausente: ${customer?.email}`);
            return false;
        }

        // CPF limpo para construir o link do Protocolo Elite
        const cleanCPF = (customer.cpf || '').replace(/\D/g, '');

        // Link do Protocolo Elite com CPF pré-vinculado
        const PROTOCOLO_ELITE_URL = 'https://protocolo-elite.pages.dev';
        const accessLink = cleanCPF
            ? `${PROTOCOLO_ELITE_URL}/?cpf=${cleanCPF}`
            : PROTOCOLO_ELITE_URL;

        // CPF formatado para exibição no e-mail (XXX.XXX.XXX-XX)
        const cpfFormatted = cleanCPF.length === 11
            ? `${cleanCPF.slice(0,3)}.${cleanCPF.slice(3,6)}.${cleanCPF.slice(6,9)}-${cleanCPF.slice(9)}`
            : (customer.cpf || 'Seu CPF cadastrado');

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
  .header { background: linear-gradient(135deg, #000 0%, #1a1a1a 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; border-bottom: 3px solid #D4AF37; }
  .content { padding: 40px 30px; background: #fff; border: 1px solid #eee; border-radius: 0 0 12px 12px; }
  .btn { display: inline-block; background: linear-gradient(to bottom, #FFD700, #D4AF37); color: #000 !important; padding: 18px 35px; text-decoration: none; font-weight: 900; border-radius: 50px; font-size: 18px; text-transform: uppercase; box-shadow: 0 10px 20px rgba(212,175,55,0.3); margin: 20px 0; }
  .cpf-box { background: #f0f9f0; border: 2px solid #D4AF37; border-radius: 10px; padding: 16px 24px; text-align: center; margin: 20px 0; }
  .cpf-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .cpf-value { font-size: 22px; font-weight: 900; color: #000; letter-spacing: 2px; }
  .badge { background: #2ecc71; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
  .info-box { background: #fffbea; border-left: 4px solid #D4AF37; padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-size: 14px; color: #555; }
</style>
</head>
<body>
  <div class="header">
    <img src="https://teste-dl7.pages.dev/logo.webp" alt="Logo" style="max-width:180px;height:auto;margin-bottom:15px;">
    <h1 style="color:#FFD700;margin:0;font-size:26px;">ACESSO LIBERADO! 🚀</h1>
    <p style="color:#ccc;margin:8px 0 0;font-size:14px;">Protocolo Elite — A Cura das Aves</p>
  </div>
  <div class="content">
    <p style="font-size:18px;">Olá, <strong>${customer.name}</strong>!</p>
    <p>Parabéns pela sua decisão. Seu pagamento foi confirmado e seu acesso ao <strong>Protocolo Elite</strong> está pronto.</p>

    <div class="cpf-box">
      <div class="cpf-label">🔑 Sua chave de acesso (CPF)</div>
      <div class="cpf-value">${cpfFormatted}</div>
    </div>

    <div style="text-align:center;margin:30px 0;">
      <a href="${accessLink}" class="btn">ACESSAR O PROTOCOLO ELITE ➔</a>
      <p style="color:#666;font-size:13px;margin-top:10px;">Clique no botão acima. Seu CPF já estará pré-preenchido.</p>
    </div>

    <div class="info-box">
      <strong>📱 Como acessar:</strong><br>
      1. Clique no botão acima<br>
      2. Se necessário, confirme seu CPF: <strong>${cpfFormatted}</strong><br>
      3. Acesse todo o conteúdo do Protocolo Elite
    </div>

    <div style="margin-top:30px;">
      <p><strong>PRECISA DE AJUDA?</strong></p>
      <a href="https://wa.me/5538999832950?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20meu%20acesso%20ao%20Protocolo%20Elite"
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
            subject: '✅ Seu Acesso ao Protocolo Elite foi Liberado!',
            html: htmlContent,
            text: `Olá ${customer.name},\n\nSeu pagamento foi confirmado! Seu acesso ao Protocolo Elite está liberado.\n\n🔑 Sua chave de acesso (CPF): ${cpfFormatted}\n\nClique no link abaixo para acessar:\n${accessLink}\n\nSe precisar de ajuda, fale no WhatsApp:\nhttps://wa.me/5538999832950?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20meu%20acesso%20ao%20Protocolo%20Elite\n\nAtt,\nGalos Mura Brasil`,
            download_link: accessLink,
            customer_name: customer.name || '',
            customer_cpf: cpfFormatted,
            access_link: accessLink,
            whatsapp_link: 'https://wa.me/5538999832950?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20meu%20acesso%20ao%20Protocolo%20Elite',
            // Campos opcionais sempre como string (nunca null/undefined) para evitar erro de validação no Make
            facebook_event_id: facebookEventId || '',
            fbc: fbc || '',
            fbp: fbp || '',
            client_user_agent: userAgent || ''
        };

        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('[EMAIL ERROR] Falha no disparo pro Make.com');
        } else {
            console.log(`[EMAIL] Webhook acionado para ${customer.email} — link: ${accessLink}`);
        }

        // --- META CAPI SERVER-SIDE PURCHASE (10/10 EMQ) ---
        // Dispara o CAPI Purchase com desduplicação cirúrgica usando o facebookEventId gerado no checkout, ou usa o paymentId como fallback se o MP não retornar o metadado
        const eventIdToUse = facebookEventId || ('fallback_ev_' + paymentId);
        
        try {
            const totalValue = items.reduce((acc, i) => acc + Number(i.price), 0);
            const contentIds = items.map(i => String(i.id || i.title));
            
            await sendCAPIEvent(env, {
                eventName: 'Purchase',
                eventId: eventIdToUse, // EXACT MATCH with downloads.html if available
                customer: customer,       // Contains name, email, phone, cpf, cep (if card)
                meta: { 
                    fbc, 
                    fbp, 
                    userAgent, 
                    clientIp,
                    externalId: externalId || customer.cpf // Usa o session_id correto para match no funil (externalId), CPF só como fallback
                },
                value: totalValue,
                currency: 'BRL',
                contentIds: contentIds,
                contentType: 'product',
                sourceUrl: env.SITE_URL || 'https://osegredodasgalinhas.pages.dev/',
                site: site
            });
            console.log(`[CAPI] Purchase server-side disparado com sucesso. EventID: ${eventIdToUse} (Original: ${facebookEventId})`);
        } catch (capiErr) {
            console.error('[CAPI ERROR]', capiErr.message);
        }

        return true;

    } catch (err) {
        console.error('[EMAIL EXCEPTION]', err.message);
        return false;
    }
}


