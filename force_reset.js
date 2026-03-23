
const https = require('https');

const data = JSON.stringify({
  password: 'mura2026'
});

const options = {
  hostname: 'teste-m1kq.onrender.com',
  port: 443,
  path: '/api/config/reset',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🔄 Disparando reset forçado no Render...');

const req = https.request(options, (res) => {
  let responseBody = '';
  res.on('data', (d) => { responseBody += d; });
  res.on('end', () => {
    console.log('✅ Status:', res.statusCode);
    console.log('📄 Resposta:', responseBody);
  });
});

req.on('error', (error) => {
  console.error('❌ Erro:', error);
});

req.write(data);
req.end();
