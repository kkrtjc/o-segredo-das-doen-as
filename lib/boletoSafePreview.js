const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, '..', 'private', 'boleto', 'BoletoBancario.png');

let cachedPng = null;
let cachedAt = 0;
const CACHE_MS = 60 * 1000;

function bandSvg(w, h) {
    const fs = Math.max(9, Math.round(h * 0.028));
    const fsSmall = Math.max(8, Math.round(h * 0.024));
    const line = '00000.00000 00000.000000 00000.000000 0 00000000000000';
    const rects = [
        { x: w * 0.13, y: h * 0.04, rw: w * 0.86, rh: h * 0.11 },
        { x: w * 0.02, y: h * 0.16, rw: w * 0.60, rh: h * 0.12 },
        { x: w * 0.02, y: h * 0.29, rw: w * 0.52, rh: h * 0.10 },
        { x: w * 0.56, y: h * 0.16, rw: w * 0.42, rh: h * 0.22 },
        { x: w * 0.02, y: h * 0.40, rw: w * 0.52, rh: h * 0.18 },
        { x: w * 0.56, y: h * 0.40, rw: w * 0.42, rh: h * 0.18 },
        { x: w * 0.02, y: h * 0.60, rw: w * 0.96, rh: h * 0.13 },
        { x: w * 0.02, y: h * 0.76, rw: w * 0.96, rh: h * 0.22 },
    ];

    let r = rects.map(
        (b) =>
            `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.rw.toFixed(1)}" height="${b.rh.toFixed(1)}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>`
    );

    const textRows = [
        { x: w * 0.14, y: h * 0.11, t: line, size: fsSmall },
        { x: w * 0.04, y: h * 0.23, t: 'XXXX — 0000-0 / 0000000-0', size: fs },
        { x: w * 0.04, y: h * 0.35, t: 'XX/XX/0000 · DOC 000000 · XXXX', size: fsSmall },
        { x: w * 0.58, y: h * 0.32, t: 'R$ 000.000,00', size: Math.round(fs * 1.15) },
        { x: w * 0.04, y: h * 0.48, t: 'XXXX · 00000-00000000 · 0000', size: fsSmall },
        { x: w * 0.04, y: h * 0.54, t: 'CNPJ 00.000.000/0000-00 · CEP 00000-000', size: fsSmall },
        { x: w * 0.04, y: h * 0.68, t: 'XXXX XXXX XXXX — XXXX/XX', size: fs },
        { x: w * 0.04, y: h * 0.88, t: '0'.repeat(44), size: fsSmall },
    ];

    r = r.concat(
        textRows.map(
            (row) =>
                `<text x="${row.x.toFixed(1)}" y="${row.y.toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-size="${row.size}" fill="#0f172a">${escapeXml(row.t)}</text>`
        )
    );

    return Buffer.from(
        `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${r.join('')}</svg>`,
        'utf8'
    );
}

function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function buildSafeBoletoPng() {
    // Otimizado: Reduzido processamento de metadados e compressão para carregamento instantâneo
    const base = sharp(SOURCE);
    const { width, height } = await base.metadata();
    
    // Removida densidade desnecessária para SVG simples
    const overlay = await sharp(bandSvg(width, height)).png().toBuffer();

    return base
        .composite([{ input: overlay, blend: 'over' }])
        .png({ compressionLevel: 6 }) // Equilíbrio ideal entre velocidade e tamanho
        .toBuffer();
}

async function getSafeBoletoPngBuffer() {
    // Otimização: Cache perpétuo em memória (a imagem é estática)
    if (cachedPng) return cachedPng;
    
    console.log('🖼️ [BOLETO PREVIEW] Gerando cache da imagem de pré-visualização...');
    cachedPng = await buildSafeBoletoPng();
    return cachedPng;
}

module.exports = { getSafeBoletoPngBuffer, SOURCE };
