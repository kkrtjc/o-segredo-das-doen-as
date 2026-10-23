import { sendCAPIEvent } from './capi.js';

// Envia os dados para o webhook do Make.com que disparará o e-mail via Gmail
// E dispara o Purchase server-side via Meta CAPI para atribuição confiável (Desduplicado cirurgicamente)
export async function sendEmail(env, customer, items, paymentId = null, facebookEventId = null, fbc = null, fbp = null, userAgent = null, clientIp = null, site = 'app', externalId = null, senha = null) {
    try {
        // Validação rigorosa de e-mail para evitar erro no Make/Gmail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!customer || !customer.email || !emailRegex.test(customer.email.trim())) {
            console.warn(`[EMAIL ABORTED] E-mail inválido ou ausente: ${customer?.email}`);
            return false;
        }

        // CPF limpo para construir o link do Protocolo Elite
        const cleanCPF = (customer.cpf || '').replace(/\D/g, '');

        // Link do Protocolo Elite — com login e senha pré-preenchidos para acesso em 1 clique
        const PROTOCOLO_ELITE_URL = 'https://protocolo-elite.pages.dev';
        const clientPwd = senha || cleanCPF.slice(0, 4) || '1234';
        const accessLink = `${PROTOCOLO_ELITE_URL}/?login=1&cpf=${cleanCPF}&senha=${encodeURIComponent(clientPwd)}`;

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
    <img src="${env.SITE_URL || 'https://osegredodasgalinhas.pages.dev'}/logo.webp" alt="Logo" style="max-width:180px;height:auto;margin-bottom:15px;">
    <h1 style="color:#FFD700;margin:0;font-size:26px;">ACESSO LIBERADO! 🚀</h1>
    <p style="color:#ccc;margin:8px 0 0;font-size:14px;">Protocolo Elite — A Cura das Aves</p>
  </div>
  <div class="content">
    <p style="font-size:18px;">Olá, <strong>${customer.name}</strong>!</p>
    <p>Parabéns pela sua decisão. Seu pagamento foi confirmado e seu acesso ao <strong>Protocolo Elite</strong> está pronto.</p>

    <div class="cpf-box">
      <div class="cpf-label">🔑 Seu Login de Acesso</div>
      <div class="cpf-value">${cpfFormatted}</div>
      <div class="cpf-label" style="margin-top: 6px; font-size: 11px; color: #888;">Você também pode entrar com seu e-mail cadastrado</div>
      <div style="margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
        <div class="cpf-label">🔒 Sua Senha de Acesso</div>
        <div class="cpf-value" style="font-size: 26px; color: #D4AF37; letter-spacing: 3px;">${clientPwd}</div>
        <div class="cpf-label" style="margin-top: 4px; font-size: 11px;">Guarde esta senha com segurança</div>
      </div>
    </div>

    <div style="text-align:center;margin:30px 0;">
      <a href="${accessLink}" class="btn">ACESSAR O PROTOCOLO ELITE ➔</a>
      <p style="color:#666;font-size:13px;margin-top:10px;">Clique no botão acima. Seus dados já estarão preenchidos.</p>
    </div>

    <div class="info-box">
      <strong>📱 Como acessar:</strong><br>
      1. Clique no botão acima para abrir o aplicativo.<br>
      2. Faça login com seu CPF: <strong>${cpfFormatted}</strong> (ou com seu e-mail: <strong>${customer.email}</strong>).<br>
      3. Use a sua senha: <strong>${clientPwd}</strong>.<br>
      4. Você pode alterar esta senha a qualquer momento nas configurações do aplicativo.
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

        const productListStr = (items || []).map(i => {
            const t = typeof i === 'string' ? i : (i.title || i.id || '');
            return `• ${t}`;
        }).join('\n');

        const whatsappMessage = `Olá, ${customer.name || 'Criador'}! 🐔\n\nSeu acesso ao *Protocolo Elite* está liberado com sucesso!\n\n🌟 *Validade do Acesso:* Vitalício (Acesso Permanente)\n\n📱 *Link de Acesso Direto:*\n${accessLink}\n\n👉 _É só clicar no link acima! Seus dados de login já estarão preenchidos na tela, basta clicar em Entrar:_\n\n🔑 *Seus Dados de Login:*\n• *Login (CPF):* ${cpfFormatted}\n${customer.email ? `• *Ou pelo E-mail:* ${customer.email}\n` : ''}• *Senha de Acesso:* ${clientPwd}\n\n${productListStr ? `📦 *Conteúdos Liberados:*\n${productListStr}\n\n` : ''}Qualquer dúvida estou à disposição por aqui!`;

        const payload = {
            to: customer.email,
            phone: customer.phone || '',
            customer_phone: customer.phone || '',
            subject: '✅ Seu Acesso ao Protocolo Elite foi Liberado!',
            html: htmlContent,
            text: `Olá ${customer.name},\n\nSeu pagamento foi confirmado! Seu acesso ao Protocolo Elite está liberado.\n\n🔑 Seu Login (CPF): ${cpfFormatted}\n🔒 Sua Senha de Acesso: ${clientPwd}\n\nVocê também pode logar com seu e-mail cadastrado usando a mesma senha.\n\nClique no link abaixo para acessar direto:\n${accessLink}\n\nSe precisar de ajuda, fale no WhatsApp:\nhttps://wa.me/5538999832950?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20meu%20acesso%20ao%20Protocolo%20Elite\n\nAtt,\nGalos Mura Brasil`,
            whatsapp_message: whatsappMessage,
            whatsapp_text: whatsappMessage,
            download_link: accessLink,
            customer_name: customer.name || '',
            customer_cpf: cpfFormatted,
            customer_password: clientPwd,
            password: clientPwd,
            access_link: accessLink,
            whatsapp_link: 'https://wa.me/5538999832950?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20meu%20acesso%20ao%20Protocolo%20Elite',
            items: (items || []).map(i => (typeof i === 'string' ? i : i.title)).join(', '),
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
                // URL exata da pagina onde ocorreu a venda (critica para atribuicao correta no Meta Ads)
                // A Meta usa event_source_url para bater com o link de destino dos anuncios.
                // Se a venda veio de pintinhos3.html, o Purchase CAPI deve apontar para pintinhos3.html.
                sourceUrl: (site === 'pintinhos3' ? 'https://osegredodasgalinhas.pages.dev/pintinhos3.html'
                    : site === 'pintinhos2' ? 'https://osegredodasgalinhas.pages.dev/pintinhos2.html'
                    : site === 'pintinhos'  ? 'https://osegredodasgalinhas.pages.dev/pintinhos.html'
                    : env.SITE_URL || 'https://osegredodasgalinhas.pages.dev/'),
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

// ─── E-MAIL DE ACESSO CONCEDIDO MANUALMENTE (ADMIN) ───────────
// Não dispara CAPI Purchase para evitar falsos positivos nos anúncios
export async function sendManualAccessEmail(env, { name, email, phone, cpf, senha, duration, products }) {
    try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            console.warn(`[MANUAL EMAIL ABORTED] E-mail inválido ou ausente: ${email}`);
            return false;
        }

        const cleanCPF = (cpf || '').replace(/\D/g, '');
        const PROTOCOLO_ELITE_URL = 'https://protocolo-elite.pages.dev';
        const accessLink = `${PROTOCOLO_ELITE_URL}/?login=1&cpf=${cleanCPF}&senha=${senha || cleanCPF.slice(0, 4) || '1234'}`;

        const cpfFormatted = cleanCPF.length === 11
            ? `${cleanCPF.slice(0,3)}.${cleanCPF.slice(3,6)}.${cleanCPF.slice(6,9)}-${cleanCPF.slice(9)}`
            : (cpf || 'Seu CPF cadastrado');

        const isTrial = duration && duration !== 'lifetime';
        const durLabel = duration === '15m'
            ? '15 Minutos (Teste Rápido)'
            : duration === '3h'
                ? '3 Horas (Degustação)'
                : duration === '24h'
                    ? '24 Horas (Teste de 1 Dia)'
                    : 'Vitalício (Permanente)';

        const productNames = (products || []).map(p => {
            if (p === 'ebook-doencas') return '• PROTOCOLO ELITE: A Cura das Aves';
            if (p === 'ebook-manejo') return '• Manejo de Pintinhos (Upsell)';
            if (p === 'tabela-racao') return '• Tabela de Ração Completa';
            if (p === 'potencialize-ovos') return '• Potencialize a Produção de Ovos';
            return `• ${p}`;
        }).join('<br>');

        const subject = isTrial
            ? '⏱️ Seu Acesso de Teste ao Protocolo Elite foi Liberado!'
            : '✅ Seu Acesso ao Protocolo Elite foi Liberado!';

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; background: #f8fafc; }
  .header { background: linear-gradient(135deg, #0b0f19 0%, #1e293b 100%); padding: 36px 20px; text-align: center; border-radius: 12px 12px 0 0; border-bottom: 3px solid #D4AF37; }
  .content { padding: 36px 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; }
  .btn { display: inline-block; background: linear-gradient(135deg, #FFD700 0%, #D4AF37 100%); color: #000000 !important; padding: 18px 36px; text-decoration: none; font-weight: 900; border-radius: 50px; font-size: 16px; text-transform: uppercase; box-shadow: 0 10px 20px rgba(212,175,55,0.3); margin: 20px 0; }
  .credentials-box { background: #f8fafc; border: 2px solid #D4AF37; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
  .c-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .c-val { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: 1.5px; font-family: monospace; }
  .trial-banner { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 8px; margin: 18px 0; font-size: 13px; color: #92400e; }
  .products-box { background: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin: 18px 0; font-size: 13px; color: #334155; line-height: 1.8; text-align: left; }
</style>
</head>
<body>
  <div class="header">
    <img src="${env.SITE_URL || 'https://osegredodasgalinhas.pages.dev'}/logo.webp" alt="Logo" style="max-width:160px;height:auto;margin-bottom:12px;">
    <h1 style="color:#FFD700;margin:0;font-size:24px;">${isTrial ? 'ACESSO DE TESTE LIBERADO! ⏱️' : 'ACESSO LIBERADO! 🚀'}</h1>
    <p style="color:#cbd5e1;margin:6px 0 0;font-size:13px;">Protocolo Elite — Criação e Manejo Avícola</p>
  </div>
  <div class="content">
    <p style="font-size:17px;margin-top:0;">Olá, <strong>${name || 'Criador'}</strong>!</p>
    <p style="font-size:14px;color:#475569;">
      ${isTrial 
        ? `Seu acesso temporário ao <strong>Protocolo Elite</strong> foi liberado pelo administrador para você conhecer a nossa plataforma.` 
        : `Seu acesso vitalício ao <strong>Protocolo Elite</strong> foi liberado com sucesso!`}
    </p>

    ${isTrial ? `
    <div class="trial-banner">
      <strong>⏱️ Tempo Liberado:</strong> ${durLabel}<br>
      <span style="font-size:12px;">Aproveite este período para explorar os módulos e recursos. O acesso expira automaticamente ao término do tempo.</span>
    </div>` : ''}

    <div class="credentials-box">
      <div class="c-label">🔑 Login Principal (CPF)</div>
      <div class="c-val">${cpfFormatted}</div>
      ${email ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">Login Alternativo: <strong>${email}</strong></div>` : ''}
      
      <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px;">
        <div class="c-label">🔒 Senha de Acesso</div>
        <div class="c-val" style="color:#d97706;font-size:24px;">${senha || cleanCPF.slice(0, 4) || '1234'}</div>
      </div>
    </div>

    ${productNames ? `
    <div class="products-box">
      <strong style="color:#0f172a;display:block;margin-bottom:6px;">📦 Conteúdos Liberados:</strong>
      ${productNames}
    </div>` : ''}

    <div style="text-align:center;margin:28px 0;">
      <a href="${accessLink}" class="btn">ACESSAR O PROTOCOLO ELITE ➔</a>
      <p style="color:#64748b;font-size:12px;margin-top:10px;">Clique no botão acima. Seus dados já serão pré-preenchidos automaticamente.</p>
    </div>

    <div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:6px;margin:20px 0;font-size:13px;color:#475569;">
      <strong>📱 Dica rápida:</strong><br>
      Você pode salvar o aplicativo na tela inicial do seu celular (Android ou iPhone) para acessar sempre com 1 toque como um app oficial.
    </div>

    <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;">
      <p style="font-size:13px;color:#64748b;margin-bottom:8px;"><strong>Dúvidas ou Suporte?</strong></p>
      <a href="https://wa.me/5538999832950?text=Ol%C3%A1,%20recebi%20meu%20acesso%20ao%20Protocolo%20Elite"
         style="display:inline-block;background:#25D366;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;">
        📱 Chamar no WhatsApp
      </a>
    </div>
    <p style="margin-top:24px;font-size:11px;color:#94a3b8;text-align:center;">© 2026 Protocolo Elite / Galos Mura Brasil.</p>
  </div>
</body>
</html>`;

        const webhookUrl = 'https://hook.us2.make.com/jelleujxca0ntlko5lirhhsfdvlyhetf';
        const payload = {
            to: email.trim().toLowerCase(),
            subject: subject,
            html: htmlContent,
            text: `Olá ${name || 'Criador'},\n\nSeu acesso ao Protocolo Elite foi liberado!\n\n🔑 Login (CPF): ${cpfFormatted}\n🔒 Senha: ${senha || cleanCPF.slice(0, 4) || '1234'}\n\nTempo: ${durLabel}\n\nAcesse pelo link:\n${accessLink}\n\nSuporte: https://wa.me/5538999832950`,
            download_link: accessLink,
            customer_name: name || '',
            customer_cpf: cpfFormatted,
            access_link: accessLink,
            whatsapp_link: 'https://wa.me/5538999832950?text=Ol%C3%A1,%20recebi%20meu%20acesso%20ao%20Protocolo%20Elite',
            facebook_event_id: '',
            fbc: '',
            fbp: '',
            client_user_agent: ''
        };

        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('[MANUAL EMAIL ERROR] Falha no disparo pro Make.com status:', res.status);
            return false;
        }

        console.log(`[MANUAL EMAIL SUCCESS] E-mail de acesso enviado para ${email}`);
        return true;
    } catch (err) {
        console.error('[MANUAL EMAIL EXCEPTION]', err.message);
        return false;
    }
}


