const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mercadopago = require('mercadopago');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configure Mercado Pago
const client = new mercadopago.MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-4739527964432168-123020-0d33e7e9f3b552431a4739527964432168' // Placeholder or Test Token
});

const payment = new mercadopago.Payment(client);
const preference = new mercadopago.Preference(client);

// Checkout Endpoint
app.post('/api/checkout', async (req, res) => {
    const { items, customer, deliveryMethod } = req.body;

    try {
        // Create Preference for Credit Card (and others via SDK)
        const body = {
            items: items.map(item => ({
                id: item.id,
                title: item.title,
                unit_price: Number(item.price),
                quantity: 1,
                currency_id: 'BRL'
            })),
            payer: {
                name: customer.name,
                email: customer.email,
                identification: {
                    type: 'CPF',
                    number: customer.cpf
                },
                phone: {
                    number: customer.phone
                }
            },
            back_urls: {
                success: 'https://osegredodasgalinhas.com/obrigado',
                failure: 'https://osegredodasgalinhas.com/erro',
                pending: 'https://osegredodasgalinhas.com/pendente'
            },
            auto_return: 'approved',
            notification_url: 'https://yourdomain.com/api/webhooks/mercadopago',
            metadata: {
                delivery_method: deliveryMethod,
                customer_phone: customer.phone
            }
        };

        const response = await preference.create({ body });
        res.json({ init_point: response.init_point });

    } catch (error) {
        console.error('Error creating preference:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Pix Endpoint (Specific for immediate display if needed)
app.post('/api/checkout/pix', async (req, res) => {
    const { items, customer, deliveryMethod } = req.body;

    // Sum prices
    const totalAmount = items.reduce((acc, item) => acc + Number(item.price), 0);

    const body = {
        transaction_amount: totalAmount,
        description: items.map(i => i.title).join(', '),
        payment_method_id: 'pix',
        payer: {
            email: customer.email,
            first_name: customer.name.split(' ')[0],
            last_name: customer.name.split(' ').slice(1).join(' ') || 'N/A',
            identification: {
                type: 'CPF',
                number: customer.cpf
            }
        },
        metadata: {
            delivery_method: deliveryMethod,
            customer_phone: customer.phone
        }
    };

    try {
        const response = await payment.create({ body });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64,
            id: response.id,
            status: response.status
        });
    } catch (error) {
        console.error('Error creating Pix payment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Webhook Endpoint
app.post('/api/webhooks/mercadopago', async (req, res) => {
    const { query } = req;
    const topic = query.topic || query.type;

    if (topic === 'payment') {
        const paymentId = query.id || req.body.data.id;
        try {
            const paymentResult = await payment.get({ id: paymentId });

            if (paymentResult.status === 'approved') {
                const { metadata } = paymentResult;
                // LOGIC: Trigger Delivery
                console.log(`Payment approved for order. Delivering via ${metadata.delivery_method} to ${metadata.customer_phone}`);
                // TODO: Call email/whatsapp delivery service
            }

            res.sendStatus(200);
        } catch (error) {
            console.error('Webhook Error:', error);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(200);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
