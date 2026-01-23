// --- 1. GLOBAL CONFIG & STATE ---
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
    ? 'http://localhost:10000'
    : 'https://teste-m1kq.onrender.com';

let cart = {
    mainProduct: null,
    bumps: [] // IDs of selected bumps
};

// --- INIT: CHECK PENDING PIX (Recover Logic) ---
document.addEventListener('DOMContentLoaded', async () => {
    const cached = localStorage.getItem('active_pix_session');
    if (cached) {
        try {
            const session = JSON.parse(cached);
            // Only check if recent (< 1 hour) to avoid zombie checks
            if ((Date.now() - session.timestamp) < 60 * 60 * 1000) {
                console.log("🔍 Verificando pagamento pendente em background...");
                try {
                    const s = await fetch(`${API_URL}/api/payment/${session.data.id}`);
                    const sd = await s.json();
                    if (sd.status === 'approved') {
                        // User paid! Redirect immediately.
                        console.log("✅ Pagamento confirmado em background! Redirecionando...");
                        localStorage.removeItem('active_pix_session');
                        window.location.href = `downloads.html?items=RECOVERED_SESSION`; // Simplified for recovery
                    } else {
                        // Not paid. User reloaded -> They probably want a fresh start.
                        // Clear storage so the modal starts clean.
                        console.log("ℹ️ Pagamento não identificado. Limpando sessão antiga.");
                        localStorage.removeItem('active_pix_session');
                    }
                } catch (e) { console.warn("Background check failed", e); }
            } else {
                localStorage.removeItem('active_pix_session');
            }
        } catch (e) { localStorage.removeItem('active_pix_session'); }
    }
});

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. FAQ Accordion Logic ---
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            const isOpen = item.classList.contains('active');
            document.querySelectorAll('.faq-item').forEach(otherItem => otherItem.classList.remove('active'));
            if (!isOpen) item.classList.add('active');
        });
    });

    // --- 2. Smooth Scroll ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });



    // --- 4. Testimonials (Infinite Carousel) ---
    const testimonials = [
        { text: '"Salvou minhas galinhas! Perdi 20 galinhas antes de ler esse guia."', author: 'Carlos Silva', location: 'Minas Gerais', stars: 5, avatar: 'carrosel/carlos.png' },
        { text: '"Muito bom, consegui identificar a doença da minha galinha na mesma hora."', author: 'Maria Santos', location: 'São Paulo', stars: 5, avatar: 'carrosel/maria.PNG' },
        { text: '"Vale cada centavo. Aprendi mais aqui do que em 2 anos criando galinhas."', author: 'João Oliveira', location: 'Bahia', stars: 5, avatar: 'carrosel/joao_new.jpg' },
        { text: '"O manejo correto mudou tudo aqui no sítio. Recomendo demais!"', author: 'Ana Costa', location: 'Goiás', stars: 5, avatar: 'carrosel/ana.png' },
        { text: '"Simples e direto. Parei de gastar com remédio errado."', author: 'Ricardo Lima', location: 'Paraná', stars: 5, avatar: 'carrosel/ricardo.jpeg' }
    ];

    const testimonialsTrack = document.getElementById('testimonials-track');
    if (testimonialsTrack) {
        // 1. Defined dimensions for JS-CSS sync
        const CARD_WIDTH = 300;
        const CARD_MARGIN = 20;
        const SET_WIDTH = testimonials.length * (CARD_WIDTH + CARD_MARGIN); // 5 * 320 = 1600px

        // 2. Set the CSS variable for the animation distance (exactly 1 set width, NEGATIVE)
        testimonialsTrack.style.setProperty('--scroll-amount', `-${SET_WIDTH}px`);

        // 3. Massive duplication to ensure infinite illusion even on 8K screens
        // 12 sets * 1600px = 19200px total width.
        const loopContent = Array(12).fill(testimonials).flat();

        loopContent.forEach(t => {
            const starsHTML = '<i class="fa-solid fa-star" style="color: #FFD700;"></i>'.repeat(t.stars);
            const card = document.createElement('div');
            card.className = 'testimonial-card-original';
            // Enforce strict dimensions matching our calculation
            card.style.minWidth = `${CARD_WIDTH}px`;
            card.style.maxWidth = `${CARD_WIDTH}px`;
            card.style.marginRight = `${CARD_MARGIN}px`; // Inline to guarantee calculation match

            card.innerHTML = `
                <div style="font-size: 1.5rem; color: rgba(255,255,255,0.3); margin-bottom: 0.5rem;"><i class="fa-solid fa-quote-left"></i></div>
                <p style="font-style: italic; margin-bottom: 1.5rem; color: #eee; font-size: 0.95rem; min-height: 60px;">"${t.text}"</p>
                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 45px; height: 45px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255,255,255,0.5); flex-shrink: 0;">
                        <img src="${t.avatar}" alt="${t.author}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${t.author}&background=random&color=fff'">
                    </div>
                    <div>
                        <strong style="display: block; color: #fff; font-size: 0.9rem;">${t.author}</strong>
                        <small style="color: rgba(255,255,255,0.6); font-size: 0.8rem;"><i class="fa-solid fa-location-dot" style="margin-right: 4px;"></i> ${t.location}</small>
                        <div style="margin-top: 0.2rem; font-size: 0.7rem; color: #FFD700;">${starsHTML}</div>
                    </div>
                </div>
            `;
            testimonialsTrack.appendChild(card);
        });
    }

    // --- 5. Initializations ---
    renderHomeProducts();
    setupFields();

    // --- 6. Sticky CTA Logic ---
    const stickyCta = document.querySelector('.sticky-cta-bar');
    const heroSection = document.querySelector('.hero');
    if (stickyCta && heroSection) {
        window.addEventListener('scroll', () => {
            const triggerPoint = heroSection.offsetHeight - 200;
            if (window.scrollY > triggerPoint) stickyCta.classList.add('visible');
            else stickyCta.classList.remove('visible');
        });
    }

    // --- 7. NEW: Mobile-First Tracking ---
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    trackEvent('session_start', isMobile);

    // Track Slow Load
    window.addEventListener('load', () => {
        const perf = window.performance.timing;
        const loadTime = (perf.loadEventEnd - perf.navigationStart) / 1000;
        if (loadTime > 5) trackEvent('slow_load', isMobile);
    });

    // Track Trust Clicks (Seals, Guarantee)
    document.querySelectorAll('.trust-seal, .guarantee-section, .secure-info').forEach(el => {
        el.addEventListener('click', () => trackEvent('trust_click', isMobile));
    });

    // Pixels tracking
    setTimeout(() => {
        if (typeof fbq === 'function') {
            fbq('trackCustom', 'TimeSpent_15s');
            fbq('track', 'ViewContent');
        }
    }, 15000);
});

// --- 2. CHECKOUT & API LOGIC ---

const mp = new MercadoPago('APP_USR-2502a3c7-5f59-45b0-8365-1cfcad7b0fa5');
const checkoutModal = document.getElementById('checkout-modal');

async function trackEvent(type, isMobile = null) {
    if (isMobile === null) isMobile = window.innerWidth <= 768;
    try {
        await fetch(`${API_URL}/api/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, isMobile })
        });
    } catch (e) { console.warn("Track failed", e); }
}

async function openCheckout(productId) {
    trackEvent('checkout_open');
    trackEvent('click');
    // Pixel Tracking: AddToCart & InitiateCheckout
    if (typeof fbq === 'function') {
        fbq('track', 'AddToCart', { content_ids: [productId], content_type: 'product' });
        fbq('track', 'InitiateCheckout');
    }
    if (typeof ttq === 'object') {
        ttq.track('AddToCart', { contents: [{ content_id: productId }] });
        ttq.track('InitiateCheckout');
    }

    if (!checkoutModal) return;

    // --- RESET CHECKOUT STATE ---
    // 1. Reset View
    document.getElementById('checkout-main-view').classList.remove('hidden');
    document.getElementById('pix-result').classList.add('hidden');

    // 2. Clear any active polling (Global variable needs to be defined at top level)
    if (window.activePixPoll) {
        clearInterval(window.activePixPoll);
        window.activePixPoll = null;
    }

    const secureOverlay = document.getElementById('secure-loading');
    const lockScroll = () => {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    };

    if (secureOverlay) {
        secureOverlay.classList.add('active');
        lockScroll();
        const secureText = document.getElementById('secure-text');
        if (secureText) {
            setTimeout(() => secureText.innerText = "Criptografando dados...", 1000);
            setTimeout(() => secureText.innerText = "Conexão Segura Estabelecida.", 2000);
        }
    }

    try {
        const response = await fetch(`${API_URL}/api/products/${productId}`);
        const productData = await response.json();

        if (productData.error) throw new Error(productData.error);

        cart.mainProduct = { ...productData, id: productId };
        cart.bumps = [];

        document.getElementById('checkout-product-name').innerText = productData.title;
        document.getElementById('checkout-product-price-display').innerText = formatBRL(productData.price);

        const iconContainer = document.getElementById('product-icon-container');
        if (iconContainer) {
            if (productData.cover === 'combo') {
                iconContainer.innerHTML = `
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <img src="capadospintinhos.png" alt="Manejo" style="width: 30px; height: 40px; object-fit: cover; border-radius: 4px;">
                        <img src="capadasdoencas.png" alt="Doenças" style="width: 30px; height: 40px; object-fit: cover; border-radius: 4px;">
                    </div>`;
            } else {
                iconContainer.innerHTML = `<img src="${productData.cover}" style="width: 50px; height: 65px; object-fit: cover; border-radius: 6px;">`;
            }
        }

        renderOrderBumps(productData.fullBumps);
        updateTotal();
        switchMethod('pix');

        // --- Premium Animation Sequence ---
        setTimeout(() => {
            // 1. Fade Out Secure Loading
            if (secureOverlay) secureOverlay.classList.remove('active');

            // 2. Start Logo Slide Animation
            const logoOverlay = document.getElementById('checkout-logo-overlay');
            if (logoOverlay) {
                logoOverlay.classList.add('active');

                // 3. Wait for slide and pulse
                setTimeout(() => {
                    // Start Logo Exit
                    logoOverlay.classList.add('run-left');

                    // Show Checkout IMMEDIATELY with overlap
                    checkoutModal.classList.add('active');

                    // 4. Cleanup Overlay only after it's fully gone (Fade out background)
                    setTimeout(() => {
                        logoOverlay.style.opacity = '0'; // Fade out overlay background smoothly
                        setTimeout(() => {
                            logoOverlay.classList.remove('active', 'run-left');
                            logoOverlay.style.opacity = '1'; // Reset for next time
                        }, 400);
                    }, 100);
                }, 1200); // Sequence duration
            } else {
                checkoutModal.classList.add('active');
            }
        }, 700); // Secure lock duration

    } catch (err) {
        console.error("Error opening checkout:", err);
        alert("Erro ao carregar checkout. Verifique sua conexão.");
        if (secureOverlay) secureOverlay.classList.remove('active');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }
}

function renderOrderBumps(bumps) {
    const area = document.getElementById('order-bump-area');
    if (!area) return;
    area.innerHTML = (bumps || []).map(bump => {
        let imgSrc = bump.image;
        if (!imgSrc) {
            if (bump.id === 'ebook-doencas' || bump.id === 'bump-doencas') imgSrc = 'capadasdoencas.png';
            else if (bump.id === 'ebook-manejo' || bump.id === 'bump-manejo') imgSrc = 'capadospintinhos.png';
            else if (bump.id === 'bump-6361') imgSrc = 'tabela_racao_bump.png';
        }

        return `
            <div class="order-bump-container" onclick="toggleBump('${bump.id}')">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" class="order-bump-checkbox" id="bump-chk-${bump.id}" ${cart.bumps.includes(bump.id) ? 'checked' : ''}>
                    ${imgSrc ? `<img src="${imgSrc}" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover;">` : ''}
                    <div class="order-bump-content">
                        <span class="order-bump-tag">${bump.tag || 'OFERTA ÚNICA'}</span>
                        <strong class="order-bump-title" style="display: block; color: #fff;">${bump.title}</strong>
                        <span class="order-bump-description" style="display: block; color: rgba(255,255,255,0.5); font-size: 0.8rem;">${bump.description}</span>
                        <span class="order-bump-price" style="color: var(--color-secondary); font-weight: 800;">+ ${formatBRL(bump.price)}</span>
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
    let total = cart.mainProduct.price;
    cart.bumps.forEach(id => {
        const b = cart.mainProduct.fullBumps.find(x => x.id === id);
        if (b) total += b.price;
    });

    document.querySelectorAll('.checkout-total-display').forEach(el => el.innerText = formatBRL(total));
    updateInstallments(total);
}

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

async function renderHomeProducts() {
    const container = document.getElementById('home-products-container');
    if (!container) return;

    try {
        console.log("Iniciando carga de ofertas de:", `${API_URL}/api/config`);
        const res = await fetch(`${API_URL}/api/config`);
        if (!res.ok) throw new Error("Fetch failed");

        const db = await res.json();
        const products = db.products;
        container.innerHTML = '';

        Object.keys(products).forEach(id => {
            const p = products[id];
            const card = document.createElement('div');
            card.className = `price-card ${p.isFeatured ? 'featured' : ''}`;
            if (p.isFeatured) card.id = 'offer-focus';

            const featuresHTML = (p.features || []).map(f => `<li><span class="check-icon">✓</span> ${f}</li>`).join('');

            let coverHTML = '';
            if (p.cover === 'combo') {
                coverHTML = `
                    <div class="combo-visual">
                        <img src="capadospintinhos.png" class="combo-img" alt="Manejo">
                        <img src="capadasdoencas.png" class="combo-img" alt="Doenças">
                    </div>`;
            } else {
                coverHTML = `<img src="${p.cover}" alt="${p.title}" style="max-width: 120px; margin: 10px auto; display: block;">`;
            }

            card.innerHTML = `
                ${p.isFeatured ? `<span class="badge-featured">${p.badge || 'MAIS VENDIDO'}</span>` : ''}
                <h3 class="price-title">${p.title}</h3>
                <p>${p.description || ''}</p>
                ${coverHTML}
                ${p.originalPrice ? `<div style="text-decoration: line-through; color: #999; margin-top: 10px;">De R$ ${p.originalPrice.toFixed(2).replace('.', ',')}</div>` : ''}
                <span class="price-amount" ${p.isFeatured ? 'style="color: var(--color-secondary);"' : ''}>
                    R$ ${Math.floor(p.price)}<small>,${(p.price % 1).toFixed(2).split('.')[1]}</small>
                </span>
                <ul class="price-features" ${p.isFeatured ? 'style="margin-top: 1.5rem;"' : ''}>
                    ${featuresHTML}
                </ul>
                <button onclick="openCheckout('${id}')" class="btn ${p.isFeatured ? 'btn-primary btn-pulse' : 'btn-secondary'}" style="width:100%;">
                    ${p.isFeatured ? 'QUERO SALVAR MINHA CRIAÇÃO' : 'COMPRAR AGORA'}
                </button>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("ERRO CARGA OFERTAS:", e);
        container.innerHTML = `<p style="color: #fff; text-align: center; grid-column: 1/-1; padding: 20px;">Não foi possível carregar as ofertas. <br><small>Verifique se o servidor no Render está online.</small></p>`;
    }
}

// --- 3. PAYMENT HANDLING ---

function switchMethod(method) {
    const btns = document.querySelectorAll('.method-btn');
    btns.forEach(b => b.classList.remove('active'));
    document.querySelector(`.method-btn[data-method="${method}"]`)?.classList.add('active');

    const pixArea = document.getElementById('pix-area');
    const cardArea = document.getElementById('card-area');
    const pixIdentity = document.getElementById('pix-identity-section');

    if (method === 'pix') {
        if (pixArea) { pixArea.style.display = 'block'; setTimeout(() => pixArea.style.opacity = '1', 50); }
        if (pixIdentity) { pixIdentity.style.display = 'block'; }
        if (cardArea) { cardArea.style.opacity = '0'; setTimeout(() => cardArea.style.display = 'none', 300); }
    } else {
        if (cardArea) { cardArea.style.display = 'block'; setTimeout(() => cardArea.style.opacity = '1', 50); }
        if (pixIdentity) { pixIdentity.style.display = 'none'; }
        if (pixArea) { pixArea.style.opacity = '0'; setTimeout(() => pixArea.style.display = 'none', 300); }
    }
}

function updateInstallments(price) {
    const select = document.getElementById('card-installments');
    if (!select) return;
    select.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const total = i === 1 ? price : price * (1 + (0.015 * i));
        const parcel = total / i;
        const option = document.createElement('option');
        option.value = i;
        option.innerText = `${i}x de ${formatBRL(parcel)} ${i === 1 ? '(Sem juros)' : ''}`;
        select.appendChild(option);
    }
}

async function handlePayment(method) {
    // SMART DATA MAPPING
    const commonData = {
        email: document.getElementById('payer-email').value,
        phone: document.getElementById('payer-phone').value ? document.getElementById('payer-phone').value.replace(/\D/g, '') : ''
    };

    let customer = {};

    if (method === 'pix') {
        customer = {
            ...commonData,
            name: document.getElementById('payer-name').value,
            cpf: document.getElementById('payer-cpf').value ? document.getElementById('payer-cpf').value.replace(/\D/g, '') : ''
        };
    } else {
        // CARD MODE: Use Cardholder Data as Customer Data
        customer = {
            ...commonData,
            name: document.getElementById('card-holder').value,
            cpf: document.getElementById('card-cpf').value ? document.getElementById('card-cpf').value.replace(/\D/g, '') : ''
        };
    }

    if (!customer.name || !customer.cpf || !customer.email || customer.cpf.length < 11) {
        alert('Por favor, preencha todos os campos obrigatórios (Nome, CPF e Email).');
        return;
    }

    const items = [{ id: cart.mainProduct.id, title: cart.mainProduct.title, price: cart.mainProduct.price }];
    cart.bumps.forEach(id => {
        const b = cart.mainProduct.fullBumps.find(x => x.id === id);
        if (b) items.push({ id: b.id, title: b.title, price: b.price });
    });

    if (method === 'pix') {
        const btn = document.getElementById('btn-pay-pix');
        const originalText = btn.innerText;

        // --- 🛡️ PIX LOGIC (ALWAYS NEW) ---
        // We removed the "Reuse Only" logic to fix the "Stuck" issue.
        const totalAmount = items.reduce((acc, item) => acc + Number(item.price), 0);
        const itemIds = items.map(i => i.id).sort().join(',');

        btn.innerText = 'Gerando Pix...';
        btn.disabled = true;


        try {
            const res = await fetch(`${API_URL}/api/checkout/pix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, customer })
            });
            const data = await res.json();

            if (data.qr_code) {
                // Save to Persistence
                localStorage.setItem('active_pix_session', JSON.stringify({
                    data: data,
                    total: totalAmount,
                    itemIds: itemIds,
                    timestamp: Date.now()
                }));

                showPixResult(data, items);
            } else {
                // Error from server
                console.error("Pix Error Response:", data);
                const errorMsg = data.message || data.error || 'Erro desconhecido ao gerar PIX';
                alert(`Erro ao gerar PIX: ${errorMsg}\n\nDetalhes: ${JSON.stringify(data.details || {})}`);
                btn.disabled = false;
                btn.innerText = originalText;
            }
        } catch (e) {
            console.error("Pix Error:", e);
            alert('Erro ao gerar Pix: ' + e.message);
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } else {
        // CARD PAYMENT (Restored complex logic)
        const btn = document.getElementById('btn-pay-card');
        const originalText = btn.innerText;
        const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
        const cardHolder = document.getElementById('card-holder').value;
        const cardExpiry = document.getElementById('card-expiration').value;
        const cardCVV = document.getElementById('card-cvv').value;

        btn.innerText = 'Processando...';
        btn.disabled = true;

        try {
            // CRITICAL FIX: Ensure CPF is clean and valid (exactly 11 digits)
            const cleanCPF = customer.cpf.replace(/\D/g, '');

            if (cleanCPF.length !== 11) {
                alert('CPF inválido. Por favor, verifique o CPF digitado (deve ter 11 dígitos).');
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }

            const cardTokenParams = {
                cardNumber,
                cardholderName: cardHolder,
                cardExpirationMonth: cardExpiry.split('/')[0],
                cardExpirationYear: '20' + cardExpiry.split('/')[1],
                securityCode: cardCVV,
                identificationType: 'CPF',
                identificationNumber: cleanCPF  // Use cleaned CPF
            };

            const token = await mp.createCardToken(cardTokenParams);
            if (!token || !token.id) throw new Error("Erro ao gerar token do cartão.");

            // Show Processing View (Reusing the pulsing logo UI)
            document.getElementById('checkout-main-view').classList.add('hidden');
            const processingView = document.getElementById('pix-result');
            processingView.classList.remove('hidden');

            // Hide specific PIX elements if any, or just update the text
            const pixInstructions = processingView.querySelector('.pix-instructions');
            if (pixInstructions) pixInstructions.innerText = '💳 PROCESSANDO PAGAMENTO SEGURO...';

            const qrContainer = processingView.querySelector('.qr-container');
            if (qrContainer) qrContainer.style.display = 'none';

            const copyArea = processingView.querySelector('.copy-paste-area');
            if (copyArea) copyArea.style.display = 'none';

            const res = await fetch(`${API_URL}/api/checkout/card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items, customer, token: token.id,
                    installments: document.getElementById('card-installments').value,
                    payment_method_id: getPaymentMethodId(cardNumber),
                    issuer_id: null,
                    deviceId: (mp && typeof mp.getDeviceId === 'function') ? mp.getDeviceId() : null
                })
            });

            const result = await res.json();
            if (result.status === 'approved') {
                const totalVal = document.querySelector('.checkout-total-display').innerText.replace(/[^\d,]/g, '').replace(',', '.');
                window.location.href = `downloads.html?items=${items.map(i => i.id).join(',')}&total=${totalVal}`;
            } else {
                let msg = 'Pagamento Recusado.';
                if (result.status_detail) msg += ` Motivo: ${result.status_detail}`;
                if (result.error) msg += `\nErro: ${result.message || result.error}`;

                // Mensagens simplificadas para o cliente
                const map = {
                    'cc_rejected_bad_filled_other': 'CPF inválido. Verifique os dados e tente novamente.',
                    'cc_rejected_bad_filled_card_number': 'Número do cartão inválido.',
                    'cc_rejected_bad_filled_date': 'Data de validade incorreta.',
                    'cc_rejected_bad_filled_security_code': 'Código CVV incorreto.',
                    'cc_rejected_insufficient_amount': 'Saldo insuficiente no cartão.',
                    'cc_rejected_high_risk': 'Cartão recusado por segurança. Tente outro cartão.',
                    'cc_rejected_other_reason': 'Cartão recusado pelo banco.',
                    'cc_rejected_call_for_authorize': 'Entre em contato com seu banco para autorizar.',
                    'cc_rejected_card_disabled': 'Cartão bloqueado. Entre em contato com seu banco.',
                    'cc_rejected_duplicated_payment': 'Pagamento duplicado detectado.',
                    'cc_rejected_max_attempts': 'Limite de tentativas excedido. Tente novamente mais tarde.',
                    'cc_rejected_blacklist': 'Cartão não autorizado.',
                    'cc_rejected_invalid_installments': 'Número de parcelas inválido.',
                    'pending_review_manual': 'Pagamento em análise. Você receberá confirmação por e-mail.',
                    'pending_contingency': 'Processando pagamento. Aguarde a confirmação.',
                    'rejected': 'Pagamento recusado.',
                    'cc_rejected_bad_filled_security_code': 'Código de segurança incorreto.'
                };

                if (map[result.status_detail]) msg = map[result.status_detail];
                else if (result.error) msg += `\nErro: ${result.message || result.error}`;

                alert(msg + '\n\nTente conferir os dados ou pagar via PIX.');

                // Return to form if failed
                document.getElementById('checkout-main-view').classList.remove('hidden');
                processingView.classList.add('hidden');

                if (qrContainer) qrContainer.style.display = 'block';
                if (copyArea) copyArea.style.display = 'flex';

                btn.disabled = false;
                btn.innerText = originalText;
            }
        } catch (e) {
            alert('Erro no cartão: ' + e.message);
            document.getElementById('checkout-main-view').classList.remove('hidden');
            document.getElementById('pix-result').classList.add('hidden');
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

// Event Listeners with Order Bump Interception
document.getElementById('btn-pay-pix')?.addEventListener('click', (e) => {
    e.preventDefault();
    const intercepted = interceptPaymentButton(() => handlePayment('pix'));
    if (!intercepted) handlePayment('pix');
});

document.getElementById('btn-pay-card')?.addEventListener('click', (e) => {
    e.preventDefault();
    const intercepted = interceptPaymentButton(() => handlePayment('card'));
    if (!intercepted) handlePayment('card');
});
document.querySelectorAll('.method-btn').forEach(b => b.addEventListener('click', () => switchMethod(b.dataset.method)));
document.querySelector('.close-modal')?.addEventListener('click', () => {
    checkoutModal.classList.remove('active');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    // RESET BUTTONS STATE (Critical Fix)
    const btnPix = document.getElementById('btn-pay-pix');
    if (btnPix) {
        btnPix.disabled = false;
        btnPix.innerText = 'GERAR PIX AGORA'; // Or original text
    }
    const btnCard = document.getElementById('btn-pay-card');
    if (btnCard) {
        btnCard.disabled = false;
        btnCard.innerText = 'PAGAR COM CARTÃO';
    }

    // Reset State logic for next open
    setTimeout(() => {
        document.getElementById('checkout-main-view').classList.remove('hidden');
        document.getElementById('pix-result').classList.add('hidden');
        if (window.activePixPoll) {
            clearInterval(window.activePixPoll);
            window.activePixPoll = null;
        }
    }, 300);
});

// --- 4. MASKS ---
const masks = {
    cpf: v => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
    phone: v => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'),
    card: v => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})/g, '$1 ').trim(),
    date: v => v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d{2})/, '$1/$2'),
    cvv: v => v.replace(/\D/g, '').slice(0, 4)
};

function setupFields() {
    // Track Checkout Start
    const inputs = document.querySelectorAll('#checkout-modal input');
    inputs.forEach(input => {
        input.addEventListener('blur', () => {
            if (input.value.trim().length > 2 && !sessionStorage.getItem('checkout_started')) {
                sessionStorage.setItem('checkout_started', 'true');
                trackEvent('checkout_start');
            }
        });
    });
    // 2. Real-time Formatting & Validation
    const fieldMapping = {
        'payer-cpf': 'cpf',
        'card-cpf': 'cpf', // ADDED
        'payer-phone': 'phone',
        'card-number': 'card',
        'card-expiration': 'date',
        'card-cvv': 'cvv'
    };

    Object.keys(fieldMapping).forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const type = fieldMapping[id];

        el.addEventListener('input', e => {
            let val = e.target.value;
            if (masks[type]) e.target.value = masks[type](val);

            // Validation Feedback Loop
            validateField(el, type);
        });

        // Initial validation on blur
        el.addEventListener('blur', () => validateField(el, type));
    });

    // --- 2.1 Dynamic Card Brand Visual ---
    const cardInput = document.getElementById('card-number');
    const cardIcon = cardInput?.parentElement?.querySelector('i');

    if (cardInput && cardIcon) {
        cardInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '');
            const brand = getPaymentMethodId(val); // This helper was already defined at bottom

            // Remove old classes
            cardIcon.className = '';

            // Set new class based on brand
            if (brand === 'visa') cardIcon.className = 'fa-brands fa-cc-visa';
            else if (brand === 'master') cardIcon.className = 'fa-brands fa-cc-mastercard';
            else if (brand === 'amex') cardIcon.className = 'fa-brands fa-cc-amex';
            else if (brand === 'elo') cardIcon.className = 'fa-solid fa-credit-card'; // Elo doesn't have a reliable FA free icon usually, fallback generic or custom
            else if (brand === 'hipercard') cardIcon.className = 'fa-solid fa-credit-card';
            else cardIcon.className = 'fa-solid fa-credit-card'; // Default

            // Add gold color for recognized brands
            if (brand !== 'master') cardIcon.style.color = (val.length > 4) ? '#FFD700' : '';
            else cardIcon.style.color = (val.length > 4) ? '#FFD700' : '';
        });
    }
}

function validateField(el, type) {
    const val = el.value.replace(/\D/g, '');
    let isValid = false;

    if (type === 'card') isValid = val.length >= 13 && val.length <= 16; // Simplificado para feedback visual
    else if (type === 'cvv') isValid = val.length >= 3;
    else if (type === 'date') isValid = val.length === 4 && parseInt(val.slice(0, 2)) <= 12;
    else if (type === 'cpf') isValid = val.length === 11;
    else if (type === 'phone') isValid = val.length >= 10;

    if (val.length === 0) {
        el.classList.remove('is-valid', 'is-invalid');
    } else if (isValid) {
        el.classList.add('is-valid');
        el.classList.remove('is-invalid');
    } else {
        if (!el.classList.contains('is-invalid')) {
            trackEvent('ui_error'); // Only track first time per blur
        }
        el.classList.add('is-invalid');
        el.classList.remove('is-valid');
    }
}

function showPixResult(data, items) {
    document.getElementById('checkout-main-view').classList.add('hidden');
    document.getElementById('pix-result').classList.remove('hidden');
    document.getElementById('qr-code-img').src = `data:image/png;base64,${data.qr_code_base64}`;
    document.getElementById('pix-copy-paste').value = data.qr_code;

    const copyBtn = document.getElementById('btn-copy-pix');
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(data.qr_code);
            copyBtn.innerHTML = 'COPIADO!';
            setTimeout(() => copyBtn.innerHTML = 'COPIAR CÓDIGO PIX', 2000);
        };
    }

    // Start Adaptive Polling (Burst Mode)
    if (window.activePixPoll) clearInterval(window.activePixPoll);

    let attempts = 0;
    const fastPollDuration = 30; // 30 ticks of fast polling

    // Function to run poll logic
    const pollLogic = async () => {
        try {
            const s = await fetch(`${API_URL}/api/payment/${data.id}`);
            const sd = await s.json();
            if (sd.status === 'approved') {
                if (window.activePixPoll) clearTimeout(window.activePixPoll);
                window.activePixPoll = null;
                localStorage.removeItem('active_pix_session');
                const totalVal = document.querySelector('.checkout-total-display').innerText.replace(/[^\d,]/g, '').replace(',', '.');
                window.location.href = `downloads.html?items=${items.map(i => i.id).join(',')}&total=${totalVal}`;
            } else {
                // If not approved yet, schedule next poll
                attempts++;
                // First 30 seconds: poll every 1 second (FAST)
                // After that: poll every 3 seconds (NORMAL)
                const delay = attempts < fastPollDuration ? 1000 : 3000;
                window.activePixPoll = setTimeout(pollLogic, delay);
            }
        } catch (e) {
            console.warn("Poll error:", e);
            // Retry on error after normal delay
            window.activePixPoll = setTimeout(pollLogic, 3000);
        }
    };

    // Kick off first poll immediately
    window.activePixPoll = setTimeout(pollLogic, 1000);
}


// --- 5. FLOATING TOASTS LOGIC ---
const toastData = [
    { name: 'Ricardo S.', city: 'PR', text: 'Comprei e não me arrependo, conteúdo excelente!', avatar: 'carrosel/ricardo.jpeg' },
    { name: 'Ana Costa', city: 'GO', text: 'Meus pintinhos pararam de morrer.', avatar: 'carrosel/ana.png' },
    { name: 'João O.', city: 'BA', text: 'O suporte foi muito atencioso.', avatar: 'carrosel/joao_new.jpg' },
    { name: 'Carlos M.', city: 'MG', text: 'Material super completo, valeu a pena.', avatar: 'carrosel/carlos.png' },
    { name: 'Fernanda L.', city: 'SP', text: 'Recuperei meu galo favorito com o guia!', avatar: 'carrosel/fernanda.png' },
    { name: 'Roberto J.', city: 'RS', text: 'Entrega imediata, já estou estudando.', avatar: 'https://ui-avatars.com/api/?name=Roberto+J&background=random' },
    { name: 'Maria S.', city: 'SC', text: 'Muito bem explicado, parabéns.', avatar: 'carrosel/maria.PNG' }
];

let toastInterval = null;

function startToastLoop() {
    if (toastInterval) clearInterval(toastInterval);

    // Show first toast quickly
    setTimeout(showRandomToast, 1500);

    toastInterval = setInterval(showRandomToast, 5000); // New toast every 5s
}

function stopToastLoop() {
    if (toastInterval) {
        clearInterval(toastInterval);
        toastInterval = null;
    }
    const container = document.getElementById('toast-container');
    if (container) container.innerHTML = ''; // Clear existing
}

function showRandomToast() {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (container.children.length > 0) return; // Only show one at a time for "delicadeza"

    const data = toastData[Math.floor(Math.random() * toastData.length)];

    const toast = document.createElement('div');
    toast.className = 'toast-card';
    toast.innerHTML = `
        <img src="${data.avatar}" class="toast-avatar" alt="${data.name}" onerror="this.src='https://ui-avatars.com/api/?name=${data.name}&background=random&color=fff'">
        <div class="toast-content">
            <h4>${data.name} <span>${data.city}</span></h4>
            <div class="toast-stars">
                <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
            </div>
            <p>"${data.text}"</p>
        </div>
    `;

    container.appendChild(toast);

    // Remove logic handled by CSS animation mainly, but cleanup DOM
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5500); // wait for animation end (5s) + buffer
}

// --- HELPER: DETECT PAYMENT METHOD ---
function getPaymentMethodId(number) {
    const n = number.replace(/\D/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^5[1-5]/.test(n)) return 'master';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650|6516|6550)/.test(n)) return 'elo';
    if (/^6062/.test(n)) return 'hipercard';
    return 'master'; // Fallback
}

