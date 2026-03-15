const fetch = require('node-fetch');

const API_URL = 'http://localhost:10000'; // Assuming local dev for test

const testPayload = {
    items: [{ id: 'ebook-doencas', title: 'Protocolo Elite', price: 109.90 }],
    customer: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '11999999999',
        cpf: '12345678901'
    }
};

async function testPix() {
    try {
        console.log('Sending PIX request...');
        const res = await fetch(`${API_URL}/api/checkout/pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload)
        });
        const data = await res.json();
        console.log('Response:', data);
        if (data.qr_code) {
            console.log('✅ PIX generated successfully!');
        } else {
            console.error('❌ PIX generation failed:', data);
        }
    } catch (e) {
        console.error('❌ Connection failed (is the server running?):', e.message);
    }
}

testPix();
