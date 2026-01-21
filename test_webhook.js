
const http = require('http');

const data = JSON.stringify({
    type: 'payment',
    data: {
        id: '1234567890'
    }
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/webhooks/mercadopago?type=payment&id=1234567890',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
