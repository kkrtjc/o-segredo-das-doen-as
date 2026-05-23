const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

// Correção das labels do cartão
c = c.replace(/<label>Numero do Cartao<\/label>/g, '<label><i class="fa-regular fa-credit-card"></i> Número do Cartão</label>');
c = c.replace(/<label>Validade<\/label>/g, '<label><i class="fa-regular fa-calendar"></i> Validade</label>');
c = c.replace(/<label>CVV<\/label>/g, '<label><i class="fa-solid fa-lock"></i> CVV</label>');

// Correção da Câmera
c = c.replace(
    /<div class="field-tooltip">Digite os numeros do cartao<\/div>/g,
    '<div class="field-tooltip" style="display: flex; align-items: center; gap: 6px; color: #10b981;"><i class="fa-solid fa-camera"></i> Toque aqui para escanear o cartão com a câmera (iOS/Android)</div>'
);

// Apresentação de Preço Principal
c = c.replace(
    /De R\$ 149,90 por:/g,
    'De R$ 149,90 por apenas:'
);

c = c.replace(
    /<strong class="dyn-installments" style="color: #fff;">4x de R\$ 37,47 sem juros<\/strong> no/g,
    '<strong class="dyn-installments" style="color: #fff; font-size: 1.15em;">4x de R$ 27,47</strong> <span style="font-size: 0.75em; color: #94a3b8; font-weight: normal;">(Total R$ 109,90)</span><br><span style="color: #10b981; font-weight: 800; font-size: 0.9em; display: inline-block; margin-top: 4px;">Ou R$ 89,90 à vista no PIX ou Cartão</span><br><span style="display:none">'
);
// Adicionamos um <span style="display:none"> no final para esconder o texto " no PIX ou Boleto" original que vem depois.

c = c.replace(
    /<span id="top-checkout-card-installment" style="font-size: 1.3rem; color: #16a34a; font-weight: 900; line-height: 1;">4x de R\$ 37,47<\/span>/g,
    '<span id="top-checkout-card-installment" style="font-size: 1.3rem; color: #16a34a; font-weight: 900; line-height: 1.1;">4x de R$ 27,47 <span style="font-size: 0.65em; color: #64748b; font-weight: 500;">(Total R$ 109,90)</span></span><br><span style="font-size: 0.85rem; color: #059669; font-weight: 800; display: block; margin-top: 3px;">ou R$ 89,90 à vista (PIX/Cartão)</span>'
);

// E para o Top Checkout do PIX/Boleto:
c = c.replace(
    /<span id="top-checkout-pix-price" style="font-size: 1.3rem; color: #16a34a; font-weight: 900; line-height: 1;">R\$ 149,90<\/span>/g,
    '<span id="top-checkout-pix-price" style="font-size: 1.3rem; color: #16a34a; font-weight: 900; line-height: 1;">R$ 89,90</span>'
);

fs.writeFileSync('index.html', c, 'utf8');
console.log('Feito.');
