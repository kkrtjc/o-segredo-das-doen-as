const fs = require('fs');
const path = require('path');
const { getSafeBoletoPngBuffer } = require('../lib/boletoSafePreview');

const OUT = path.join(__dirname, '..', 'assets', 'boleto-ilustrativo.png');

async function main() {
    const dir = path.dirname(OUT);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const buf = await getSafeBoletoPngBuffer();
    fs.writeFileSync(OUT, buf);
    console.log('OK', OUT, buf.length);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
