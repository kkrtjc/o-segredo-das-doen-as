const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const key = process.env.GEMINI_API_KEY;
console.log(`Key prefix: ${key.substring(0, 10)}...`);

async function list() {
    try {
        const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        console.log('Available Flash Models:');
        res.data.models
            .filter(m => m.name.toLowerCase().includes('flash'))
            .forEach(m => {
                console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
            });
    } catch (e) {
        console.error('Error listing models:', e.response ? e.response.data : e.message);
    }
}

list();
