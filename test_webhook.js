const webhookUrl = 'https://hook.us2.make.com/jelleujxca0ntlko5lirhhsfdvlyhetf';

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
    <img src="https://teste-dl7.pages.dev/logo.webp" alt="Logo" style="height:50px;margin-bottom:15px;">
    <h1 style="color:#FFD700;margin:0;font-size:26px;">ACESSO LIBERADO! 🚀</h1>
  </div>
  <div class="content">
    <p style="font-size:18px;">Olá, <strong>João Paulo</strong>!</p>
    <p>Parabéns pela sua decisão. Seu pagamento foi confirmado e seus materiais já estão prontos.</p>
    <div style="text-align:center;margin:40px 0;">
      <a href="https://mura-api.joaopaulojaguar.workers.dev/api/access/TEST_TOKEN" class="btn">ACESSAR MEUS MATERIAIS ➔</a>
      <p style="color:#666;font-size:13px;margin-top:15px;">O acesso é vitalício. Guarde este e-mail.</p>
    </div>
    <h3 style="color:#000;font-size:16px;border-bottom:1px solid #ddd;padding-bottom:10px;">ITENS DO SEU PEDIDO:</h3>
      <div class="item-card">
        <span class="badge">APROVADO</span>
        <div style="margin-top:5px;font-weight:bold;color:#1a1a1a;">PROTOCOLO ELITE: A Cura das Aves</div>
      </div>
      <div class="item-card">
        <span class="badge">APROVADO</span>
        <div style="margin-top:5px;font-weight:bold;color:#1a1a1a;">Tabela de Ração (Bônus)</div>
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

const payload = {
    to: 'joaopaulojaguar@icloud.com',
    subject: '✅ Seu Acesso Chegou! - O Segredo das Galinhas (TESTE)',
    html: htmlContent,
    text: "Olá João Paulo, seu acesso foi liberado! Acesse seus materiais aqui: https://mura-api.joaopaulojaguar.workers.dev/api/access/TEST_TOKEN",
    download_link: "https://mura-api.joaopaulojaguar.workers.dev/api/access/TEST_TOKEN",
    customer_name: "João Paulo",
    whatsapp_link: "https://wa.me/5538999832950?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20meu%20acesso"
};

fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
})
.then(res => res.text())
.then(text => console.log('Result:', text))
.catch(err => console.error('Error:', err));
