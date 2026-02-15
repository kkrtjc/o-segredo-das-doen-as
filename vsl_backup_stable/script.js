// --- 1. GLOBAL CONFIG & STATE ---
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
    ? 'http://localhost:10000'
    : 'https://teste-m1kq.onrender.com';

const mp = new MercadoPago('APP_USR-2502a3c7-5f59-45b0-8365-1cfcad7b0fa5');

let cart = {
    mainProduct: null,
    bumps: [] // IDs of selected bumps
};

let currentPaymentMethod = 'pix';
let midCheckoutUpsellPending = true;

const HELP_MESSAGES = {
    'payer-email': 'Insira seu melhor e-mail para receber o acesso.',
    'payer-phone': 'Precisamos do seu WhatsApp para suporte técnico.',
    'payer-name': 'Digite seu nome completo conforme documento.',
    'payer-cpf': 'O CPF é necessário para emissão da sua nota fiscal.',
    'card-holder': 'Nome exatamente como está escrito no seu cartão.',
    'card-number': 'Digite os 16 números da frente do seu cartão.',
    'card-cep': 'CEP da sua residência para validação de segurança.'
};

const masks = {
    cpf: v => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').replace(/\.-/, '-').replace(/\.\./, '.'),
    phone: v => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'),
    card: v => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})/g, '$1 ').trim(),
    date: v => v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d{2})/, '$1/$2'),
    cvv: v => v.replace(/\D/g, '').slice(0, 4),
    cep: v => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{3})/, '$1-$2')
};

// --- 2. CORE FUNCTIONS ---

async function trackEvent(type, isMobileManual = null, ctaId = null, details = null) {
    const isMobile = isMobileManual !== null ? isMobileManual : (window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window));
    try {
        fetch(`${API_URL}/api/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, isMobile, ctaId, details })
        }).catch(e => console.warn("Track sync failed", e));
    } catch (e) { }
}

async function openCheckout(productId, forceBumps = []) {
    const modal = document.getElementById('checkout-modal');
    if (!modal) {
        console.error("Checkout modal not found in DOM");
        return;
    }

    trackEvent('checkout_open', { product: productId });
    sessionStorage.setItem('mura_modal_open', 'true');
    if (typeof fbq === 'function') fbq('track', 'InitiateCheckout');

    // Reset view visibility
    document.getElementById('checkout-main-view')?.classList.remove('hidden');
    document.getElementById('pix-result')?.classList.add('hidden');

    if (window.activePixPoll) {
        clearTimeout(window.activePixPoll);
        window.activePixPoll = null;
    }

    const secureOverlay = document.getElementById('secure-loading');
    if (secureOverlay) {
        secureOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    }

    try {
        const response = await fetch(`${API_URL}/api/products/${productId}?t=${Date.now()}`);
        const productData = await response.json();

        cart.mainProduct = { ...productData, id: productId };
        cart.bumps = forceBumps || [];

        // Update UI
        document.getElementById('checkout-product-name').innerText = productData.title;
        document.getElementById('checkout-prod-title').innerText = productData.title;
        if (productData.cover) document.getElementById('checkout-prod-img').src = productData.cover;

        switchMethod('pix');
        renderOrderBumps(productData.fullBumps);
        updateTotal();

        setTimeout(() => {
            if (secureOverlay) secureOverlay.classList.remove('active');
            modal.classList.remove('hidden');
            modal.style.display = 'flex'; // Ensure flexible display
            setTimeout(() => {
                modal.classList.add('active');
                document.getElementById('payer-name')?.focus();
            }, 10);
        }, 800);

    } catch (err) {
        console.error("Error opening checkout:", err);
        if (secureOverlay) secureOverlay.classList.remove('active');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }
}

function closeCheckout() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }, 400);

    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    if (sessionStorage.getItem('mura_modal_open') === 'true') {
        trackEvent('checkout_abandon');
        sessionStorage.removeItem('mura_modal_open');
    }

    if (window.activePixPoll) {
        clearTimeout(window.activePixPoll);
        window.activePixPoll = null;
    }
}

function switchMethod(method) {
    currentPaymentMethod = method;

    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.method === method);
    });

    document.querySelectorAll('.payment-view, .method-view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${method}`);
    });

    if (method === 'pix') {
        if (!cart.bumps.includes('bump-6361')) cart.bumps.push('bump-6361');
    } else {
        const idx = cart.bumps.indexOf('bump-6361');
        if (idx > -1) cart.bumps.splice(idx, 1);
    }

    updateTotal();
    trackEvent('payment_method_switch', { method });
}

function renderOrderBumps(bumps) {
    const area = document.getElementById('order-bump-area');
    if (!area) return;

    const filteredBumps = (bumps || []).filter(bump => {
        if (currentPaymentMethod === 'pix' && bump.id === 'bump-6361') return false;
        return true;
    });

    area.innerHTML = filteredBumps.map(bump => {
        let imgSrc = bump.image;
        if (!imgSrc) {
            if (bump.id.includes('doencas')) imgSrc = 'capadasdoencas.png';
            else if (bump.id.includes('manejo')) imgSrc = 'capadospintinhos.png';
            else if (bump.id === 'bump-6361') imgSrc = 'tabela_racao_bump.png';
        }

        return `
            <div class="order-bump-container" onclick="toggleBump('${bump.id}')">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" class="order-bump-checkbox" id="bump-chk-${bump.id}" ${cart.bumps.includes(bump.id) ? 'checked' : ''}>
                    ${imgSrc ? `<img src="${imgSrc}" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover;">` : ''}
                    <div class="order-bump-content">
                        <span class="order-bump-tag">${bump.tag || 'OFERTA ÚNICA'}</span>
                        <strong class="order-bump-title" style="display: block; color: #fff; font-size: 0.95rem;">${bump.title}</strong>
                        <span class="order-bump-description" style="display: block; color: rgba(255,255,255,0.5); font-size: 0.75rem;">${bump.description}</span>
                        <span class="order-bump-price" style="color: var(--color-secondary); font-weight: 800;">+ ${formatBRL(currentPaymentMethod === 'pix' ? bump.price : (bump.priceCard || bump.price))}</span>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function toggleBump(bumpId) {
    const idx = cart.bumps.indexOf(bumpId);
    if (idx > -1) cart.bumps.splice(idx, 1);
    else cart.bumps.push(bumpId);

    const chk = document.getElementById(`bump-chk-${bumpId}`);
    if (chk) chk.checked = cart.bumps.includes(bumpId);
    updateTotal();
}

function updateTotal() {
    if (!cart.mainProduct) return;

    let total = cart.mainProduct.price;
    let cardTotal = cart.mainProduct.originalPrice || cart.mainProduct.price;

    cart.bumps.forEach(id => {
        let bump = cart.mainProduct.fullBumps?.find(b => b.id === id);
        if (bump) {
            total += (id === 'bump-6361' && currentPaymentMethod === 'pix') ? 0 : bump.price;
            cardTotal += bump.priceCard || bump.price;
        }
    });

    const finalPrice = currentPaymentMethod === 'pix' ? total : cardTotal;

    document.querySelectorAll('.checkout-total-display').forEach(el => {
        el.innerText = formatBRL(finalPrice);
        if (currentPaymentMethod === 'pix') {
            const badge = document.createElement('span');
            badge.className = 'pix-discount-badge';
            badge.style.cssText = 'font-size: 0.75rem; color: #32bcad; background: rgba(50, 188, 173, 0.1); padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: 700;';
            badge.innerText = 'BÔNUS PIX';
            el.appendChild(badge);
        }
    });

    const topPrice = document.getElementById('checkout-product-price-display');
    if (topPrice) topPrice.innerText = formatBRL(finalPrice);

    updateInstallments(finalPrice);
}

function updateInstallments(total) {
    const selector = document.getElementById('installments-select');
    if (!selector) return;
    selector.innerHTML = '';
    for (let i = 1; i <= 4; i++) {
        const val = total / i;
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `${i}x de ${formatBRL(val)} ${i > 1 ? 'sem juros' : '(À vista)'}`;
        selector.appendChild(opt);
    }
}

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// --- 3. PAYMENT HANDLING ---

async function handlePayment(method) {
    if (midCheckoutUpsellPending && !cart.bumps.includes('ebook-manejo')) {
        showSlideInUpsell(method);
        return;
    }

    const isValid = validateCheckoutInputs(method);
    if (!isValid) return;

    const customer = {
        email: document.getElementById('payer-email').value,
        phone: document.getElementById('payer-phone').value.replace(/\D/g, ''),
        name: (method === 'pix' ? document.getElementById('payer-name') : document.getElementById('card-holder')).value,
        cpf: document.getElementById('payer-cpf').value.replace(/\D/g, ''),
        cep: method === 'card' ? document.getElementById('card-cep').value.replace(/\D/g, '') : null
    };

    const items = [{ id: cart.mainProduct.id, title: cart.mainProduct.title, price: (method === 'card' ? cart.mainProduct.originalPrice || cart.mainProduct.price : cart.mainProduct.price) }];
    cart.bumps.forEach(id => {
        const b = cart.mainProduct.fullBumps?.find(x => x.id === id);
        if (b) items.push({ id: b.id, title: b.title, price: (method === 'pix' && id === 'bump-6361') ? 0 : (method === 'card' ? b.priceCard || b.price : b.price) });
    });

    if (method === 'pix') {
        const btn = document.getElementById('btn-pay-pix');
        const originalText = btn.innerText;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GERANDO...';
        btn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/api/checkout/pix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, customer })
            });
            const data = await res.json();
            if (data.qr_code) showPixResult(data, items);
            else alert(data.message || 'Erro ao gerar PIX');
        } catch (e) { alert('Erro na conexão'); }
        btn.disabled = false;
        btn.innerText = originalText;
    } else {
        const btn = document.getElementById('btn-pay-card');
        const originalText = btn.innerText;
        btn.innerText = 'Processando...';
        btn.disabled = true;

        try {
            const cardTokenParams = {
                cardNumber: document.getElementById('card-number').value.replace(/\s/g, ''),
                cardholderName: document.getElementById('card-holder').value,
                cardExpirationMonth: document.getElementById('card-expiration').value.split('/')[0],
                cardExpirationYear: '20' + document.getElementById('card-expiration').value.split('/')[1],
                securityCode: document.getElementById('card-cvv').value,
                identificationType: 'CPF',
                identificationNumber: customer.cpf
            };

            const token = await mp.createCardToken(cardTokenParams);
            if (!token?.id) throw new Error("Cartão inválido");

            const res = await fetch(`${API_URL}/api/checkout/card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items, customer, token: token.id,
                    installments: document.getElementById('installments-select')?.value || '1',
                    payment_method_id: getPaymentMethodId(cardTokenParams.cardNumber)
                })
            });
            const result = await res.json();
            if (result.status === 'approved') {
                window.location.href = `downloads.html?status=approved&items=${items.map(i => i.id).join(',')}`;
            } else alert(result.message || 'Pagamento recusado');
        } catch (e) { alert(e.message); }
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

function showPixResult(data, items) {
    document.getElementById('checkout-main-view').classList.add('hidden');
    const resultArea = document.getElementById('pix-result');
    resultArea.classList.remove('hidden');
    document.getElementById('qr-code-img').src = `data:image/png;base64,${data.qr_code_base64}`;
    document.getElementById('pix-copy-paste').value = data.qr_code;

    const totalVal = document.querySelector('.checkout-total-display').innerText.replace(/[^\d,]/g, '').replace(',', '.');
    startPixPolling(data.id, items.map(i => i.id).join(','), totalVal);
}

function startPixPolling(paymentId, itemIds, total) {
    const poll = async () => {
        try {
            const res = await fetch(`${API_URL}/api/payment/${paymentId}`);
            const data = await res.json();
            if (data.status === 'approved') {
                window.location.href = `downloads.html?status=approved&items=${itemIds}&total=${total}`;
            } else {
                window.activePixPoll = setTimeout(poll, 3000);
            }
        } catch (e) { window.activePixPoll = setTimeout(poll, 5000); }
    };
    window.activePixPoll = setTimeout(poll, 2000);
}

function validateCheckoutInputs(method) {
    const fields = ['payer-email', 'payer-phone', 'payer-cpf', (method === 'pix' ? 'payer-name' : 'card-holder')];
    if (method === 'card') fields.push('card-number', 'card-expiration', 'card-cvv', 'card-cep');

    let isValid = true;
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.value.trim().length < 3) {
            el?.classList.add('is-invalid');
            isValid = false;
        } else el?.classList.remove('is-invalid');
    });
    return isValid;
}

// --- 4. INITIALIZATION & UX ---

document.addEventListener('DOMContentLoaded', () => {
    // FAQ
    document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', () => q.parentElement.classList.toggle('active'));
    });

    // Masks
    document.addEventListener('input', (e) => {
        const id = e.target.id;
        if (id === 'payer-cpf') e.target.value = masks.cpf(e.target.value);
        if (id === 'payer-phone') e.target.value = masks.phone(e.target.value);
        if (id === 'card-number') e.target.value = masks.card(e.target.value);
        if (id === 'card-expiration') e.target.value = masks.date(e.target.value);
        if (id === 'card-cvv') e.target.value = masks.cvv(e.target.value);
        if (id === 'card-cep') e.target.value = masks.cep(e.target.value);
    });

    // Pricing Buttons
    renderHomeProducts();

    // Payment Listeners
    document.getElementById('btn-pay-pix')?.addEventListener('click', (e) => { e.preventDefault(); handlePayment('pix'); });
    document.getElementById('btn-pay-card')?.addEventListener('click', (e) => { e.preventDefault(); handlePayment('card'); });
    document.querySelectorAll('.method-btn').forEach(btn => btn.addEventListener('click', () => switchMethod(btn.dataset.method)));
    document.querySelector('.close-modal')?.addEventListener('click', closeCheckout);
});

async function renderHomeProducts() {
    const container = document.getElementById('home-products-container');
    if (!container) return;
    try {
        const res = await fetch(`${API_URL}/api/config?t=${Date.now()}`);
        const db = await res.json();
        const p = db.products['ebook-doencas'];
        if (!p) return;

        container.innerHTML = `
            <div class="price-card-horizontal featured" id="offer-focus">
                <span class="badge-featured">${p.badge || 'OFERTA ÚNICA'}</span>
                <div class="pricing-horizontal-content">
                    <div class="pricing-visual-horizontal"><img src="${p.cover}" class="pricing-img-horizontal"></div>
                    <div class="pricing-info-horizontal">
                        <h3 class="price-title">${p.title}</h3>
                        <p>${p.description || ''}</p>
                        <div class="price-container">
                            <span class="price-amount">R$ 119<small>,90</small></span>
                        </div>
                        <button onclick="openCheckout('ebook-doencas')" class="btn btn-primary btn-pulse" style="width:100%">QUERO MEU ACESSO AGORA!</button>
                    </div>
                </div>
            </div>`;
    } catch (e) { container.innerHTML = 'Erro ao carregar oferta.'; }
}

function getPaymentMethodId(n) {
    if (/^4/.test(n)) return 'visa';
    if (/^5[1-5]/.test(n)) return 'master';
    return 'other';
}
