const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
    ? 'http://localhost:10000'
    : 'https://mura-api.joaopaulojaguar.workers.dev';

const PAGE_SOURCE = (() => {
    const loc = (window.location.pathname + window.location.href).toLowerCase();
    if (loc.includes('pintinhos3')) return 'pintinhos3';
    if (loc.includes('pintinhos2')) return 'pintinhos2';
    if (loc.includes('pintinhos') || document.body?.dataset?.page === 'pintinhos' || document.body?.classList?.contains('pintinhos-page')) return 'pintinhos';
    if (document.querySelector('.vsl-page')) return 'vsl';
    return 'text';
})();

let cart = {
    mainProduct: null,
    bumps: [] // IDs of selected bumps
};

// GLOBAL PAYMENT STATE
let currentPaymentMethod = 'pix'; // Default
let currentFacebookEventId = null; 

function generateEventID() {
    return 'ev_' + Date.now() + '_' + Math.random().toString(16).slice(2, 10);
}

// --- PERFORMANCE: PRE-FETCHING ---
const prefetchedProducts = {};

// --- DYNAMIC PRICING UPDATER ---
function applyDynamicPrices(productData) {
    if (!productData || !productData.price) return;
    
    const price = productData.price;
    const baseOriginal = productData.originalPrice || 149.90;
    
    const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    if (baseOriginal > price) {
        let discountStr = Math.round(((baseOriginal - price) / baseOriginal) * 100).toString();
        document.querySelectorAll('.dyn-discount-percent').forEach(el => el.innerText = discountStr);
    }
    
    const instPrice = productData.originalPrice ? (Math.floor((productData.originalPrice / 4) * 100) / 100) : (price / 4);
    const instStr = `4x de R$ ${fmt(instPrice)} sem juros`;

    document.querySelectorAll('.dyn-price-main').forEach(el => el.innerText = fmt(price));
    document.querySelectorAll('.dyn-installments').forEach(el => el.innerText = instStr);
    document.querySelectorAll('.dyn-checkout-original').forEach(el => el.innerText = `R$ ${fmt(baseOriginal)}`);
    document.querySelectorAll('.dyn-checkout-pix').forEach(el => el.innerText = `R$ ${fmt(price)} no PIX`);
    document.querySelectorAll('.dyn-cta-pix').forEach(el => el.innerText = `R$ ${fmt(price)} no PIX`);
}

// --- INIT: CHECK PENDING PIX (Recover Logic) ---
    // Wrap everything in a robust initialization
    const initPage = async () => {
        // 0. IMMEDIATE SYNCHRONOUS INIT (Garante máscaras e rastreio de abandono desde o milissegundo 0)
        try { initFAQ(); } catch (e) {}
        try { initSmoothScroll(); } catch (e) {}
        try { initComparisonSlider(); } catch (e) {}
        try { initStickyCTA(); } catch (e) {}
        try { initLazyLoading(); } catch (e) {}
        try { initImageTransitions(); } catch (e) {}
        try { initHelpBubbles(); } catch (e) {}
        try { setupFields(); } catch (e) {}
        try { initCheckoutAbandonAutoTracking(); } catch (e) {}
        try { initMobileFixes(); } catch (e) {}
        try { renderHomeProducts(); } catch (e) {}

        // LAZY VIDEO
        try {
            const lazyVideo = document.getElementById('vsl-video');
            if (lazyVideo && 'IntersectionObserver' in window) {
                const videoObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const source = lazyVideo.querySelector('source');
                            if (source && source.dataset.src) {
                                source.src = source.dataset.src;
                                lazyVideo.load();
                            }
                            observer.unobserve(lazyVideo);
                        }
                    });
                }, { rootMargin: '200px' });
                videoObserver.observe(lazyVideo);
            }
        } catch (e) {}

        // CTA CLICK TRACKING (Imediato)
        try {
            document.querySelectorAll('a[href^="#offer"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const ctaId = btn.getAttribute('data-cta') || 'generic_cta';
                    trackEvent('cta_click', null, ctaId);
                });
            });
        } catch (e) {}

        // 1. UNIQUE VISITOR + SESSÃO TRACKING
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const lastVisit = localStorage.getItem('mura_visita_hoje');

            // Sequentialize to avoid KV race conditions in Worker
            await trackEvent('session_start');

            if (lastVisit !== todayStr) {
                await trackEvent('unique_visit');
                localStorage.setItem('mura_visita_hoje', todayStr);
            }
        } catch (e) {
            console.warn('[TRACKING] Failed:', e);
        }

        // 2. PIX RECOVERY
        const cached = localStorage.getItem('active_pix_session');
        if (cached) {
            try {
                const session = JSON.parse(cached);
                if ((Date.now() - session.timestamp) < 60 * 60 * 1000) {
                    try {
                        const s = await fetch(`${API_URL}/api/payment/${session.data.id}`);
                        const sd = await s.json();
                        if (sd.status === 'approved') {
                            localStorage.removeItem('active_pix_session');
                            const recoveryEventId = session.facebookEventId || generateEventID();
                            const { fbc: recFbc, fbp: recFbp } = getMetaCookies();
                            const rc = session.customer || {};
                            window.location.href = `downloads.html?items=${session.itemIds}&total=${session.total.toFixed(2)}&evid=${encodeURIComponent(recoveryEventId)}&fbc=${encodeURIComponent(recFbc)}&fbp=${encodeURIComponent(recFbp)}&email=${encodeURIComponent(rc.email||'')}&name=${encodeURIComponent(rc.name||'')}&cpf=${encodeURIComponent(rc.cpf||'')}&phone=${encodeURIComponent(rc.phone||'')}`;
                        } else {
                            localStorage.removeItem('active_pix_session');
                        }
                    } catch (e) { /* Recover silently */ }
                } else {
                    localStorage.removeItem('active_pix_session');
                }
            } catch (e) { localStorage.removeItem('active_pix_session'); }
        }

        // 3. PRE-FETCH
        const productsToPreload = ['ebook-doencas', 'combo-elite', 'ebook-manejo', 'combo-plataforma'];
        productsToPreload.forEach(async (id) => {
            try {
                const response = await fetch(`${API_URL}/api/products/${id}`);
                if (response.ok) {
                    prefetchedProducts[id] = await response.json();
                    if (id === 'combo-plataforma') {
                        const resp = prefetchedProducts[id];
                        if (typeof applyDynamicPrices === 'function') applyDynamicPrices(resp);
                    }
                }
            } catch (e) { console.warn(`[PREFETCH] Failed: ${id}`); }
        });

        // 8. DIRECT CHECKOUT LINK
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('checkout') === 'doencas') {
            setTimeout(() => {
                if (typeof openCheckout === 'function') openCheckout('ebook-doencas');
            }, 800);
        }
    };

    // Robust Entry Point
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initPage();
    } else {
        document.addEventListener('DOMContentLoaded', initPage);
    }

// --- COMPONENT INITIALIZERS (Refactored for clarity) ---

function initFAQ() {
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            const isOpen = item.classList.contains('active');
            document.querySelectorAll('.faq-item').forEach(otherItem => otherItem.classList.remove('active'));
            if (!isOpen) item.classList.add('active');
        });
    });
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            e.preventDefault();
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                if (targetId === '#offer-focus' || targetId === '#offers') {
                    const comboCard = document.querySelector('.price-card.featured');
                    if (comboCard) {
                        comboCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        return;
                    }
                }
                window.scrollTo({ top: targetElement.offsetTop - 80, behavior: 'smooth' });
            }
        });
    });
}

function initStickyCTA() {
    const stickyCta = document.querySelector('.sticky-cta-bar');
    const heroSection = document.querySelector('.hero');
    if (stickyCta && heroSection) {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(([entry]) => {
                if (!entry.isIntersecting) stickyCta.classList.add('visible');
                else stickyCta.classList.remove('visible');
            }, { threshold: 0.05 });
            observer.observe(heroSection);
        } else {
            let ticking = false;
            window.addEventListener('scroll', () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        const triggerPoint = heroSection.offsetHeight - 200;
                        if (window.scrollY > triggerPoint) stickyCta.classList.add('visible');
                        else stickyCta.classList.remove('visible');
                        ticking = false;
                    });
                    ticking = true;
                }
            }, { passive: true });
        }
    }
}

function initLazyLoading() {
    if (!('IntersectionObserver' in window)) return;
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            }
        });
    }, { rootMargin: '50px' });

    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        if (img.src) img.classList.add('loaded');
        else imageObserver.observe(img);
    });
}

function initImageTransitions() {
    document.querySelectorAll('img').forEach(img => {
        if (img.closest('.testimonial-track-original')) {
            img.style.opacity = '1';
            return;
        }
        img.style.transition = 'opacity 0.4s ease-in-out';
        img.onload = () => img.style.opacity = '1';
        if (!img.complete) img.style.opacity = '0';
    });
}

function initMobileFixes() {
    const updateVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    window.addEventListener('resize', updateVh);
    updateVh();

        document.addEventListener('touchmove', (e) => {
        // Se estiver rolando dentro do checkout, nunca previna!
        if (e.target.closest('#checkout-page')) return;
        
        if (document.body.classList.contains('modal-open')) {
            const modal = document.querySelector('.modal-overlay.active');
            if (modal && !modal.contains(e.target)) {
                e.preventDefault();
            }
        }
    }, { passive: false });
}

// --- 2. CHECKOUT & API LOGIC ---

// mp is initialized in index.html to avoid duplicate declaration errors
const checkoutModal = document.getElementById('checkout-page');

// --- TRACKING ENGINE ---
async function trackEvent(type, isMobileManual = null, ctaId = null, details = null, useBeacon = false) {
    const isMobile = isMobileManual !== null ? isMobileManual : (
        window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );

    const body = JSON.stringify({ type, isMobile, ctaId, details, site: PAGE_SOURCE });

    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
            const sent = navigator.sendBeacon(`${API_URL}/api/track`, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
            if (sent) return;
        } catch (e) {}
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const resp = await fetch(`${API_URL}/api/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body,
                keepalive: true
            });
            if (resp.ok) return;
        } catch (e) {
            if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
        }
    }
}

function trackPixel(eventName, params = {}, eventId = null) {
    const options = eventId ? { eventID: eventId } : {};
    if (typeof fbq === 'function') {
        fbq('track', eventName, params, options);
    } else {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (typeof fbq === 'function') {
                fbq('track', eventName, params, options);
                clearInterval(interval);
            } else if (attempts >= 10) clearInterval(interval);
        }, 500);
    }
}

/**
 * ─── META ADVANCED MANUAL MATCHING ────────────────────────────────────────────
 * Re-inicializa o Pixel com dados do cliente assim que os temos.
 * Meta usa esses dados hasheados para atribuir eventos server-side (CAPI)
 * ao clique original do anúncio — resolvendo a falta de atribuição.
 * 
 * Chamado: (1) ao abrir o checkout, (2) ao digitar email/telefone no formulário.
 */
function updateMetaUserData(customer = {}) {
    try {
        if (typeof fbq !== 'function') return;
        
        const userData = {};
        
        // Email — campo mais importante para match
        if (customer.email && customer.email.includes('@')) {
            userData.em = customer.email.trim().toLowerCase();
        }
        
        // Telefone — Formato E.164 Brasil (5511999999999)
        if (customer.phone) {
            const rawPhone = customer.phone.replace(/\D/g, '');
            userData.ph = rawPhone.startsWith('55') ? rawPhone : '55' + rawPhone;
        }
        
        // Nome dividido em primeiro e último
        if (customer.name) {
            const parts = customer.name.trim().split(' ');
            if (parts[0]) userData.fn = parts[0].toLowerCase();
            if (parts.length > 1) userData.ln = parts[parts.length - 1].toLowerCase();
        }
        
        // CPF → campo 'db' (document/tax ID) — identificador oficial para BR
        // Documentação Meta: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
        if (customer.cpf) {
            const cleanCPF = customer.cpf.replace(/\D/g, '');
            if (cleanCPF.length === 11) {
                userData.db = cleanCPF; // Meta faz hash SHA-256 automaticamente
            }
        }
        
        // External ID = Session ID (não CPF) — é o que liga browser → CAPI no funil
        const sessionId = sessionStorage.getItem('mura_session_id');
        if (sessionId) {
            userData.external_id = sessionId;
        }
        
        // Só re-inicializa se tiver pelo menos um dado útil
        if (Object.keys(userData).length > 0) {
            fbq('init', '1346740157465853', userData);
            console.log('[META MATCHING] Pixel re-inicializado. Campos:', Object.keys(userData).join(', '));
        }
    } catch (e) {
        console.warn('[META MATCHING] Erro ao atualizar dados do usuário:', e);
    }
}

// ─── CAPI SERVER-SIDE ENGINE ──────────────────────────────────────────────────────────────
// Coleta dados do usuário do formulário e envia ao Worker,
// que repassa ao Meta com IP e User-Agent reais do servidor.
// Meta recebe: email + telefone + nome + CPF + cidade + estado — tudo hasheado.

/** Lê os campos do formulário de checkout que estejam preenchidos */
function getCurrentCustomerData() {
    const get = (id) => (document.getElementById(id)?.value || '').trim();
    return {
        name:  get('customer-name')  || get('payer-name')  || '',
        email: get('customer-email') || get('payer-email') || '',
        phone: get('customer-phone') || get('payer-phone') || '',
        cpf:   get('customer-cpf')   || get('payer-cpf')   || '',
        city:  get('customer-city')  || '',
        state: get('customer-state') || '',
        zip:   get('customer-cep')   || get('customer-zip') || '',
    };
}

/** Lê cookies _fbc e _fbp do Meta */
function getMetaCookies() {
    const cookies = document.cookie.split(';').reduce((acc, c) => {
        const [k, v] = c.trim().split('=');
        if (k) acc[k] = v || '';
        return acc;
    }, {});
    
    let fbc = cookies['_fbc'] || '';
    const fbp = cookies['_fbp'] || '';

    // FALLBACK: Se o cookie _fbc não existe mas o fbclid está na URL
    if (!fbc) {
        const params = new URLSearchParams(window.location.search);
        const fbclid = params.get('fbclid');
        if (fbclid) {
            fbc = `fb.1.${Date.now()}.${fbclid}`;
        }
    }

    return { fbc, fbp };
}

/**
 * Envia evento ao Worker que repassa ao Meta CAPI server-side.
 * Complementa o fbq() — Meta deduplica pelo eventId.
 *
 * @param {string} eventName   - 'ViewContent' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase'
 * @param {string} eventId     - Mesmo ID usado no fbq() para deduplicação
 * @param {Object} [extra]     - { value, contentIds, contentName, customer }
 */
async function trackCAPI(eventName, eventId, extra = {}) {
    try {
        const params = new URLSearchParams(window.location.search);
        const testCode = params.get('testCode') || sessionStorage.getItem('mura_test_code') || null;
        if (testCode && !sessionStorage.getItem('mura_test_code')) sessionStorage.setItem('mura_test_code', testCode);

        const { fbc, fbp } = getMetaCookies();
        const formData = getCurrentCustomerData();
        // extra.customer sobrescreve o form quando temos dados completos (ex: no pagamento)
        const customer = extra.customer ? { ...formData, ...extra.customer } : formData;

        // Session ID para match cross-device (mesmo sem cookies)
        let externalId = sessionStorage.getItem('mura_session_id');
        if (!externalId) {
            externalId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            sessionStorage.setItem('mura_session_id', externalId);
        }

        const payload = {
            eventName,
            eventId: eventId || null,
            sourceUrl: window.location.href,
            customer,
            fbc,
            fbp,
            externalId,
            testCode,
            site: PAGE_SOURCE
        };
        if (extra.value      !== undefined) payload.value       = extra.value;
        if (extra.currency   !== undefined) payload.currency    = extra.currency;
        if (extra.contentIds !== undefined) payload.contentIds  = extra.contentIds;
        if (extra.contentName!== undefined) payload.contentName = extra.contentName;
        if (extra.contentType!== undefined) payload.contentType = extra.contentType;

        // keepalive garante envio mesmo se página navegar antes de concluir
        fetch(`${API_URL}/api/capi-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
        }).catch(() => {});

    } catch (e) {
        console.warn('[trackCAPI]', e.message);
    }
}
// ─────────────────────────────────────────────────────────────────────────────

async function openCheckout(productId, forceBumps = []) {
    return startCheckoutProcess(productId, forceBumps);
}

// Timer para a Promoção de Elite
let eliteTimerInterval = null;
function startEliteTimer(duration) {
    if (eliteTimerInterval) clearInterval(eliteTimerInterval);

    let timer = duration;
    const display = document.getElementById('elite-timer');

    // Initial display
    if (display) display.textContent = "05:00";

    eliteTimerInterval = setInterval(() => {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;

        if (display) {
            display.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }

        if (--timer < 0) {
            clearInterval(eliteTimerInterval);
            if (display) display.textContent = "0:00";
        }
    }, 1000);
}

// Funções para lidar com o Combo Elite
function acceptEliteCombo() {
    if (eliteTimerInterval) clearInterval(eliteTimerInterval);
    const promoModal = document.getElementById('elite-promo-modal');
    if (promoModal) promoModal.classList.remove('show');
    startCheckoutProcess('combo-plataforma');
}

function declineEliteCombo() {
    if (eliteTimerInterval) clearInterval(eliteTimerInterval);
    const promoModal = document.getElementById('elite-promo-modal');
    if (promoModal) promoModal.classList.remove('show');
    startCheckoutProcess('ebook-doencas');
}

async function startCheckoutProcess(productId, forceBumps = []) {
    window.bypassPixUpsell = false;
    window.acceptedPixUpsell = false;
    console.log('[CHECKOUT] Resetting upsell bypass flags.');
    // trackEvent('checkout_open') modificado: removido o limite de 1 por sessão 
    // e o trackEvent('click') redundante para evitar "Race Conditions" no banco de dados KV
    trackEvent('checkout_open');
    
    sessionStorage.setItem('mura_modal_open', 'true');
    sessionStorage.removeItem('mura_abandon_tracked');
    sessionStorage.removeItem('mura_checkout_paid');
    currentFacebookEventId = generateEventID();
    // InitiateCheckout will be fired in loadCheckoutData once we have the price and name


    if (!checkoutModal) return;

    // --- RESET CHECKOUT STATE ---
    document.getElementById('checkout-main-view').classList.remove('hidden');
    document.getElementById('pix-result').classList.add('hidden');

    if (window.activePixPoll) {
        clearInterval(window.activePixPoll);
        window.activePixPoll = null;
    }

    // START RESERVATION TIMER
    startReservationTimer();

    // RESET PIX BUTTON AND UPSELL STATE
    const btnPix = document.getElementById('btn-pay-pix');
    if (btnPix) {
        btnPix.innerText = 'Finalizar meu acesso.';
        btnPix.disabled = false;
        btnPix.style.opacity = '1';
    }
    midCheckoutUpsellPending = true;
    localStorage.removeItem('active_pix_session');

    const secureOverlay = document.getElementById('secure-loading');
    if (secureOverlay) {
        secureOverlay.classList.add('active');
        document.body.classList.add('modal-open');
    }

    // FALLBACK DATA (Offline Support)
    const fallbackData = {
        'ebook-doencas': {
            title: 'O Segredo das Doenças Avícolas',
            price: 49.90,
            originalPrice: 147.00,
            cover: 'capadasdoencas.webp',
            fullBumps: []
        },
        'ebook-pintinhos': {
            title: 'Manual de Manejo de Pintinhos',
            price: 27.90,
            originalPrice: 129.70,
            cover: 'capadospintinhos.webp',
            fullBumps: []
        },
        'combo-plataforma': {
            title: 'O Segredo das Doenças Avícolas',
            price: 49.90,
            originalPrice: 147.00,
            cover: 'capadasdoencas.webp',
            fullBumps: []
        },
        'combo-elite': {
            title: 'O Segredo das Doenças Avícolas',
            price: 49.90,
            originalPrice: 147.00,
            cover: 'capadasdoencas.webp',
            fullBumps: []
        }
    };

    try {
        let productData = (typeof prefetchedProducts !== 'undefined') ? prefetchedProducts[productId] : null;

        if (!productData) {
            // INSTANT ACCESS: Fallback local imediato sem travamento de rede no celular
            productData = fallbackData[productId] || fallbackData['ebook-doencas'];
            productData.id = productId;
        }

        cart.mainProduct = { ...productData, id: productId };

        // HOTFIX: Force the bumps based on productId (Tabela de Ração e Potencialize a Produção de Ovos)
        if (productId === 'ebook-doencas' || productId === 'combo-plataforma' || productId === 'combo-elite') {
            cart.mainProduct.fullBumps = [
                {
                    id: 'ebook-pintinhos',
                    title: 'MANUAL DE MANEJO DOS PINTINHOS',
                    price: 27.90,
                    priceCard: 27.90,
                    image: 'capadospintinhos.webp',
                    description: 'Passo a passo do nascimento à fase adulta para reduzir a mortalidade e criar pintinhos saudáveis.',
                    tag: 'RECOMENDADO'
                },
                {
                    id: 'bump-6361',
                    title: 'TABELA DE RAÇÃO PRÁTICA',
                    price: 14.90,
                    priceCard: 14.90,
                    image: 'tabela_racao_bump.webp',
                    description: 'Fórmulas balanceadas de postura, engorda e crescimento para economizar até 60% com custo de ração.',
                    tag: 'OFERTA ÚNICA'
                },
                {
                    id: 'bump-ovos',
                    title: 'POTENCIALIZE A PRODUÇÃO DE OVOS',
                    price: 14.90,
                    priceCard: 14.90,
                    image: 'potencialize_ovos_bump.webp',
                    description: 'Multiplique a postura com manejo certo, controle de iluminação e alimentação na hora correta.',
                    tag: 'ALTA POSTURA'
                }
            ];
            productData.fullBumps = cart.mainProduct.fullBumps;
        } else if (productId === 'ebook-pintinhos' || productId === 'ebook-manejo') {
            cart.mainProduct.fullBumps = [
                {
                    id: 'bump-6361',
                    title: 'TABELA DE RAÇÃO PRÁTICA',
                    price: 14.90,
                    priceCard: 14.90,
                    image: 'tabela_racao_bump.webp',
                    description: 'Fórmulas balanceadas de postura, engorda e crescimento para economizar até 60% com custo de ração.',
                    tag: 'OFERTA ÚNICA'
                },
                {
                    id: 'bump-ovos',
                    title: 'POTENCIALIZE A PRODUÇÃO DE OVOS',
                    price: 14.90,
                    priceCard: 14.90,
                    image: 'potencialize_ovos_bump.webp',
                    description: 'Multiplique a postura com manejo certo, controle de iluminação e alimentação na hora correta.',
                    tag: 'ALTA POSTURA'
                }
            ];
            productData.fullBumps = cart.mainProduct.fullBumps;
        } else if (productId === 'combo-plataforma') {
            cart.mainProduct.fullBumps = [];
            productData.fullBumps = [];
        }

        cart.bumps = forceBumps || [];

        // PIXEL + CAPI: InitiateCheckout
        trackPixel('InitiateCheckout', {
            content_ids: [productId],
            content_name: productData.title,
            content_type: 'product',
            value: productData.price,
            currency: 'BRL'
        }, currentFacebookEventId);
        trackCAPI('InitiateCheckout', currentFacebookEventId, {
            value: productData.price, currency: 'BRL',
            contentIds: [productId], contentName: productData.title,
        });

        document.getElementById('checkout-product-name').innerText = productData.title;
        document.getElementById('checkout-product-price-display').innerText = formatBRL(productData.price);
        
        const topCardPriceEl = document.getElementById('top-checkout-card-price');
        const topCardInstEl = document.getElementById('top-checkout-card-installment');
        
        if (productId === 'ebook-pintinhos') {
            if (topCardPriceEl) topCardPriceEl.innerText = 'R$ 129,70';
            if (topCardInstEl) topCardInstEl.innerHTML = `ou 3x de R$ 9,93`;
            document.getElementById('checkout-product-price-display').innerText = 'R$ 27,90';
        } else {
            if (topCardPriceEl) topCardPriceEl.innerText = 'R$ 147,00';
            if (topCardInstEl) topCardInstEl.innerHTML = `ou 4x de R$ 13,29 sem juros`;
            document.getElementById('checkout-product-price-display').innerText = 'R$ 49,90';
        }

        const savingsBadgeEl = document.getElementById('checkout-savings-badge');
        if (savingsBadgeEl) {
            savingsBadgeEl.style.display = 'none';
        }

        const itemListEl = document.getElementById('checkout-item-list');
        if (itemListEl) {
            itemListEl.style.display = 'none';
        }

        const iconContainer = document.getElementById('product-icon-container');
        if (iconContainer) {
            if (productData.cover === 'combo') {
                iconContainer.innerHTML = `
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <img src="capadospintinhos.webp" alt="Manejo" style="width: 25px; height: 35px; object-fit: cover; border-radius: 4px;">
                        <img src="capadasdoencas.webp" alt="Doenças" style="width: 25px; height: 35px; object-fit: cover; border-radius: 4px;">
                        <img src="tabela_racao_bump.webp" alt="Ração" style="width: 25px; height: 35px; object-fit: cover; border-radius: 4px;">
                    </div>`;
            } else {
                iconContainer.innerHTML = `<img src="${productData.cover}" style="width: 50px; height: 65px; object-fit: cover; border-radius: 6px;">`;
            }
        }

        currentPaymentMethod = 'pix';
        if (typeof selectPaymentMethod === 'function') {
            selectPaymentMethod('pix');
        } else if (typeof switchMethod === 'function') {
            switchMethod('pix');
        }

        renderOrderBumps(productData.fullBumps);
        updateTotal();

        const delay = (productData && productData.fullBumps) ? 10 : 250;
        setTimeout(() => {
            if (secureOverlay) secureOverlay.classList.remove('active');
            checkoutModal.style.display = 'block';
            checkoutModal.classList.add('active');
            checkoutModal.scrollTop = 0;
            // document.body.style.overflow = 'hidden'; // Fixed iOS Safari bug
            document.body.classList.add('modal-open');
        }, delay);

    } catch (err) {
        console.error("Critical error opening checkout:", err);
        if (secureOverlay) secureOverlay.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

function renderOrderBumps(bumps) {
    const area = document.getElementById('order-bump-area');
    if (!area) return;

    // Filtra bumps que não devem aparecer
    const filteredBumps = (bumps || []).filter(bump => {
        if (!bump.id) {
            if (bump.title && (bump.title.includes('Pintinhos') || bump.title.includes('Manejo'))) bump.id = 'ebook-manejo';
            else if (bump.title && bump.title.includes('Ração')) bump.id = 'bump-6361';
        }
        if (bump.enabled === false) return false;
        return true;
    });

    if (filteredBumps.length === 0) {
        area.style.display = 'none';
        return;
    }

    area.style.display = 'block';
    area.style.marginTop = '0.5rem';

    const bumpHeader = `
        <div style="text-align: center; margin-bottom: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.08); border-radius: 10px; border: 1px solid rgba(245, 158, 11, 0.25);">
            <p style="color: #fbbf24; font-size: 0.78rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 2px 0; line-height: 1.35;">
                <i class="fa-solid fa-bolt" style="color: #fbbf24; margin-right: 5px;"></i> APROVEITE ESTAS OFERTAS OPCIONAIS COM DESCONTO ESPECIAL
            </p>
            <p style="color: #cbd5e1; font-size: 0.72rem; font-weight: 500; margin: 0; line-height: 1.3;">
                Clique no botão "Adicionar" ao lado apenas se quiser incluir:
            </p>
        </div>
    `;

    const bumpHtml = filteredBumps.map(bump => {
        const isSelected = cart.bumps.includes(bump.id);
        let imgSrc = bump.image || '';
        if (!imgSrc || imgSrc.trim() === '') {
            if (bump.id === 'ebook-doencas' || bump.id === 'bump-doencas') imgSrc = 'capadasdoencas.webp';
            else if (bump.id === 'ebook-manejo' || bump.id === 'bump-manejo') imgSrc = 'capadospintinhos.webp';
            else if (bump.id === 'bump-6361') imgSrc = 'tabela_racao_bump.webp';
            else if (bump.id === 'bump-ovos') imgSrc = 'potencialize_ovos_bump.webp';
            else if (bump.title && (bump.title.includes('Pintinhos') || bump.title.includes('Manejo'))) imgSrc = 'capadospintinhos.webp';
            else if (bump.title && (bump.title.includes('Ração') || bump.title.includes('Racao') || bump.title.includes('Tabela'))) imgSrc = 'tabela_racao_bump.webp';
            else if (bump.title && (bump.title.includes('Ovos') || bump.title.includes('Postura'))) imgSrc = 'potencialize_ovos_bump.webp';
        }

        const isManejo = (bump.id === 'ebook-manejo' || bump.id === 'ebook-pintinhos' || (bump.title && bump.title.includes('Pintinhos')));
        const isDoencas = (bump.id === 'ebook-doencas' || (bump.title && bump.title.includes('Doenças')));
        const isOvos = (bump.id === 'bump-ovos' || (bump.title && (bump.title.includes('Ovos') || bump.title.includes('Postura'))));

        const cleanTitle = isManejo ? 'Manual de Manejo dos Pintinhos' : (isDoencas ? 'Guia Completo das Doenças' : (isOvos ? 'Potencialize Produção de Ovos' : 'Tabela de Ração Prática'));
        const badgeLabel = bump.tag || (isDoencas ? 'Mais Vendido' : (isManejo ? 'Recomendado' : (isOvos ? 'Alta Postura' : 'Economia')));
        const badgeIcon = isDoencas ? 'fa-fire' : (isOvos ? 'fa-egg' : 'fa-bolt');
        const oldPrice = isDoencas ? '89,90' : (isManejo ? '67,00' : '39,90');

        let desc = bump.description;
        if (!desc) {
            desc = isManejo 
                ? 'Passo a passo do nascimento à fase adulta para reduzir a mortalidade.'
                : (isDoencas 
                    ? 'Identifique sintomas e trate mais de 10 doenças comuns em aves. Protocolo de vacinação e vermifugação para blindar suas aves das principais doenças.'
                    : (isOvos
                        ? 'Multiplique a postura com manejo certo, controle de iluminação e alimentação na hora correta.'
                        : 'Fórmulas balanceadas de postura, engorda e crescimento para economizar até 60% com custo de ração.'));
        }

        return `
            <div id="bump-card-${bump.id}" class="order-bump-container ${isSelected ? 'selected' : ''}" style="position:relative!important;display:flex!important;flex-direction:row!important;align-items:stretch!important;justify-content:flex-end!important;width:100%!important;min-height:122px!important;padding:0!important;border-radius:12px!important;background:${isSelected ? '#062e22' : '#0b1120'}!important;border:1.5px solid ${isSelected ? '#10b981' : 'rgba(255,255,255,0.12)'}!important;cursor:default!important;overflow:hidden!important;box-shadow:0 4px 16px rgba(0,0,0,0.45)!important;margin-bottom:12px!important;box-sizing:border-box!important;-webkit-tap-highlight-color:transparent!important;">
                <input type="checkbox" id="bump-chk-${bump.id}" ${isSelected ? 'checked' : ''} style="display: none;">

                <!-- Foto no Fundo (lado esquerdo com fusao suave) -->
                ${imgSrc ? `
                    <div class="bump-bg-photo" style="position:absolute!important;top:0!important;left:0!important;width:36%!important;height:100%!important;z-index:1!important;pointer-events:none!important;overflow:hidden!important;">
                        <img src="${imgSrc}" alt="${cleanTitle}" loading="lazy" style="position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center left!important;display:block!important;opacity:0.95!important;">
                        <div class="bump-bg-overlay" style="position:absolute!important;inset:0!important;background:${isSelected ? 'linear-gradient(to right, rgba(6,46,34,0.05) 0%, rgba(6,46,34,0.48) 45%, rgba(6,46,34,0.92) 75%, #062e22 100%)' : 'linear-gradient(to right, rgba(11,17,32,0) 0%, rgba(11,17,32,0.4) 45%, rgba(11,17,32,0.88) 75%, #0b1120 100%)'}!important;z-index:2!important;"></div>
                    </div>
                ` : ''}

                <!-- Conteúdo no Lado Direito -->
                <div class="bump-content-right" style="position:relative!important;z-index:3!important;width:70%!important;min-width:0!important;margin-left:auto!important;padding:10px 10px 10px 6px!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;box-sizing:border-box!important;text-align:left!important;">
                    <!-- Topo: Apenas Badge (Card não é clicável para evitar seleção acidental) -->
                    <div class="bump-top-row" style="display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;margin-bottom:4px!important;">
                        <span class="bump-badge-tag" style="display:inline-flex!important;align-items:center!important;gap:4px!important;background:${isSelected ? 'rgba(16,185,129,0.22)' : 'rgba(245,158,11,0.18)'}!important;color:${isSelected ? '#34d399' : '#fbbf24'}!important;border:1px solid ${isSelected ? 'rgba(16,185,129,0.45)' : 'rgba(245,158,11,0.4)'}!important;font-size:10px!important;font-weight:800!important;padding:2px 7px!important;border-radius:5px!important;text-transform:uppercase!important;letter-spacing:0.4px!important;line-height:1.1!important;white-space:nowrap!important;">
                            <i class="fa-solid ${badgeIcon}" style="font-size:9.5px;"></i> ${badgeLabel}
                        </span>
                    </div>

                    <!-- Titulo e Descricao Racional sem quebras estranhas -->
                    <div>
                        <div class="bump-title-text" style="color:#ffffff!important;font-size:14px!important;font-weight:800!important;line-height:1.25!important;letter-spacing:-0.2px!important;margin:0 0 3px 0!important;word-break:normal!important;overflow-wrap:break-word!important;white-space:normal!important;text-shadow:0 1px 3px rgba(0,0,0,0.8)!important;">${cleanTitle}</div>
                        <div class="bump-desc-text" style="font-size:11.5px!important;line-height:1.35!important;color:#cbd5e1!important;margin:0 0 7px 0!important;word-break:normal!important;overflow-wrap:break-word!important;white-space:normal!important;text-shadow:0 1px 2px rgba(0,0,0,0.8)!important;">${desc}</div>
                    </div>

                    <!-- Linha Inferior: Preço à esquerda + Botão Adicionar à direita (flex-shrink:0 + flex-wrap impede qualquer sobreposição) -->
                    <div class="bump-pricing-row" style="display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:space-between!important;gap:6px 8px!important;width:100%!important;margin-top:auto!important;padding-top:6px!important;border-top:1px solid rgba(255,255,255,0.08)!important;">
                        <div class="bump-price-col" style="display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important;line-height:1.15!important;flex:0 0 auto!important;flex-shrink:0!important;">
                            <span class="bump-old-price" style="color:#94a3b8!important;font-size:10.5px!important;text-decoration:line-through!important;font-weight:500!important;white-space:nowrap!important;max-width:none!important;">De R$ ${oldPrice}</span>
                            <span class="bump-new-price" style="color:#34d399!important;font-size:14.5px!important;font-weight:900!important;line-height:1.15!important;letter-spacing:-0.2px!important;white-space:nowrap!important;max-width:none!important;">+ R$ ${formatBRL(bump.price).replace('R$ ', '')}</span>
                        </div>
                        <button type="button" class="bump-action-btn" aria-pressed="${isSelected ? 'true' : 'false'}" onclick="event.stopPropagation(); toggleBump('${bump.id}')" style="display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;min-height:32px!important;padding:6px 10px!important;border-radius:7px!important;font-size:11px!important;line-height:1!important;font-weight:800!important;font-family:inherit!important;text-transform:uppercase!important;letter-spacing:0.2px!important;cursor:pointer!important;transition:all 0.2s ease!important;border:1.5px solid #10b981!important;background:${isSelected ? '#10b981' : 'rgba(16,185,129,0.14)'}!important;color:${isSelected ? '#ffffff' : '#34d399'}!important;box-shadow:${isSelected ? '0 3px 10px rgba(16,185,129,0.4)' : 'none'}!important;white-space:nowrap!important;flex:0 0 auto!important;flex-shrink:0!important;margin-left:auto!important;-webkit-tap-highlight-color:transparent!important;">
                            <i class="${isSelected ? 'fa-solid fa-check' : 'fa-solid fa-plus'}" style="font-size:10.5px;pointer-events:none;"></i>
                            <span style="pointer-events:none;">${isSelected ? 'Adicionado' : 'Adicionar'}</span>
                        </button>
                    </div>
                </div>
            </div>`;
    }).join('');

    area.innerHTML = bumpHeader + `
        <div class="order-bump-grid-view" style="display:flex!important;flex-direction:column!important;gap:12px!important;width:100%!important;">
            ${bumpHtml}
        </div>
    `;
}

function toggleBump(bumpId) {
    const idx = cart.bumps.indexOf(bumpId);
    if (idx > -1) {
        cart.bumps.splice(idx, 1);
    } else {
        cart.bumps.push(bumpId);
    }

    const isSelected = cart.bumps.includes(bumpId);
    const chk = document.getElementById(`bump-chk-${bumpId}`);
    if (chk) chk.checked = isSelected;

    const card = document.getElementById(`bump-card-${bumpId}`);
    if (card) {
        if (isSelected) {
            card.classList.add('selected');
            card.style.borderColor = '#10b981';
            card.style.background = '#062e22';
            const overlay = card.querySelector('.bump-bg-overlay');
            if (overlay) overlay.style.background = 'linear-gradient(to right, rgba(6,46,34,0.05) 0%, rgba(6,46,34,0.45) 45%, rgba(6,46,34,0.9) 75%, #062e22 100%)';
        } else {
            card.classList.remove('selected');
            card.style.borderColor = 'rgba(255,255,255,0.12)';
            card.style.background = '#0b1120';
            const overlay = card.querySelector('.bump-bg-overlay');
            if (overlay) overlay.style.background = 'linear-gradient(to right, rgba(11,17,32,0) 0%, rgba(11,17,32,0.35) 45%, rgba(11,17,32,0.85) 75%, #0b1120 100%)';
        }

        const btn = card.querySelector('.bump-action-btn');
        if (btn) {
            btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            if (isSelected) {
                btn.innerHTML = `<i class="fa-solid fa-check" style="font-size:10.5px;pointer-events:none;"></i> <span style="pointer-events:none;">Adicionado</span>`;
                btn.style.background = '#10b981';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#ffffff';
                btn.style.boxShadow = '0 3px 10px rgba(16,185,129,0.4)';
            } else {
                btn.innerHTML = `<i class="fa-solid fa-plus" style="font-size:10.5px;pointer-events:none;"></i> <span style="pointer-events:none;">Adicionar</span>`;
                btn.style.background = 'rgba(16,185,129,0.14)';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#34d399';
                btn.style.boxShadow = 'none';
            }
        }
    }

    updateTotal();
}

function updateTotal() {
    let basePrice = cart.mainProduct.price; // Preço PIX do produto principal
    let baseCardPrice = cart.mainProduct.price; // Preço Cartão 1x
    
    let total = basePrice;
    let baseCardTotal = baseCardPrice;

    // Adiciona Bumps com preços Dinâmicos do banco de dados
    cart.bumps.forEach(id => {
        let bump = cart.mainProduct.fullBumps?.find(b => b.id === id);

        if (!bump && id === 'ebook-doencas') {
            bump = { id: 'ebook-doencas', title: 'Guia Completo das Doenças', price: 49.90, priceCard: 49.90 };
        } else if (!bump && (id === 'ebook-manejo' || id === 'ebook-pintinhos')) {
            bump = { id: id, title: 'Manual de Manejo dos Pintinhos', price: 27.90, priceCard: 27.90 };
        } else if (!bump && id.startsWith('ebook-')) {
            const configData = (window.siteConfig && window.siteConfig.products) ? window.siteConfig.products[id] : prefetchedProducts[id];
            if (configData) {
                bump = { id: id, price: configData.price, priceCard: configData.originalPrice || configData.price };
            } else {
                bump = { id: id, price: 49.90, priceCard: 49.90 };
            }
        }

        if (bump) {
            let bumpPriceForPix = bump.price || 0;
            let bumpPriceForCard = bump.price || 0; // Fixado pelo admin

            if (window.acceptedPixUpsell && (currentPaymentMethod === 'pix' || currentPaymentMethod === 'card' || currentPaymentMethod === 'boleto')) {
                if (cart.mainProduct.id === 'ebook-pintinhos' || cart.mainProduct.id === 'ebook-manejo') {
                    if (bump.id === 'ebook-doencas') {
                        bumpPriceForPix = 49.90;
                        bumpPriceForCard = 49.90;
                    }
                    if (bump.id === 'bump-6361') {
                        bumpPriceForPix = 14.90;
                        bumpPriceForCard = 14.90;
                    }
                    if (bump.id === 'bump-ovos') {
                        bumpPriceForPix = 14.90;
                        bumpPriceForCard = 14.90;
                    }
                } else {
                    if (bump.id === 'ebook-manejo') {
                        bumpPriceForPix = 27.90;
                        bumpPriceForCard = 27.90;
                    }
                    if (bump.id === 'bump-6361') {
                        bumpPriceForPix = 14.90;
                        bumpPriceForCard = 14.90;
                    }
                    if (bump.id === 'bump-ovos') {
                        bumpPriceForPix = 14.90;
                        bumpPriceForCard = 14.90;
                    }
                }
            }

            total += bumpPriceForPix;
            baseCardTotal += bumpPriceForCard;
        }
    });

    document.querySelectorAll('.pix-discount-badge').forEach(b => b.remove());

    let finalDisplayPrice = total;
    let hasSurcharge = false;

    if (currentPaymentMethod === 'card') {
        finalDisplayPrice = baseCardTotal; // Always charge base total, merchant absorbs surcharge fee
        hasSurcharge = false;
    }

    const mainCardPriceForInst = baseCardPrice;

    // Atualiza Resumo Dinâmico do Pedido
    let mainProductTitle = 'Manual de Manejo de Pintinhos';
    let mainProductImg = 'capadospintinhos.webp';

    if (cart.mainProduct) {
        if (cart.mainProduct.id === 'ebook-pintinhos') {
            mainProductTitle = 'Manual de Manejo de Pintinhos';
            mainProductImg = 'capadospintinhos.webp';
        } else if (cart.mainProduct.id === 'ebook-doencas') {
            mainProductTitle = 'O Segredo das Doenças';
            mainProductImg = 'capadasdoencas.webp';
        } else if (cart.mainProduct.id === 'combo-plataforma' || cart.mainProduct.id === 'combo-elite') {
            mainProductTitle = 'Protocolo Elite Completo';
            mainProductImg = 'logo.webp';
        } else {
            mainProductTitle = cart.mainProduct.title || 'Manual de Manejo de Pintinhos';
            mainProductImg = (window.location.pathname.includes('pintinhos') || cart.mainProduct.title?.includes('Pintinhos')) ? 'capadospintinhos.webp' : 'capadasdoencas.webp';
        }
    }

    let summaryHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                <img src="${mainProductImg}" alt="${mainProductTitle}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                <div style="min-width: 0;">
                    <span style="font-weight: 800; color: #ffffff; font-size: 0.85rem; line-height: 1.25; display: block; word-break: break-word;">${mainProductTitle}</span>
                </div>
            </div>
            <div style="text-align: right; line-height: 1.2; flex-shrink: 0;">
                <span style="font-size: 0.95rem; color: #10b981; font-weight: 800;">${formatBRL(basePrice)}</span>
                ${currentPaymentMethod === 'card' 
                    ? `<br><span style="font-size: 0.68rem; color: #cbd5e1;">ou 4x de ${formatBRL(mainCardPriceForInst/4)}</span>` 
                    : ''
                }
            </div>
        </div>
    `;
    
    cart.bumps.forEach(id => {
        let bump = cart.mainProduct.fullBumps?.find(b => b.id === id);
        if (!bump && window.siteConfig) bump = window.siteConfig.products[id];
        if (!bump) bump = prefetchedProducts[id];
        
        let bumpTitle = bump?.title || (id === 'ebook-doencas' ? 'Guia Completo das Doenças' : (id === 'bump-6361' ? 'Tabela de Ração Prática' : (id === 'bump-ovos' ? 'Potencialize a Produção de Ovos' : 'Oferta Adicional')));
        let bumpImg = (id === 'ebook-doencas' || id.includes('doencas')) ? 'capadasdoencas.webp' : ((id === 'bump-6361' || id.includes('racao')) ? 'tabela_racao_bump.webp' : ((id === 'bump-ovos' || id.includes('ovos')) ? 'potencialize_ovos_bump.webp' : 'capadospintinhos.webp'));
        let priceForMethod = bump?.price || (id === 'ebook-doencas' ? 49.90 : ((id === 'ebook-manejo' || id === 'ebook-pintinhos') ? 27.90 : 14.90));
        
        if (window.acceptedPixUpsell && (currentPaymentMethod === 'pix' || currentPaymentMethod === 'card' || currentPaymentMethod === 'boleto')) {
            if (cart.mainProduct.id === 'ebook-pintinhos' || cart.mainProduct.id === 'ebook-manejo') {
                if (id === 'ebook-doencas') priceForMethod = 49.90;
                if (id === 'bump-6361') priceForMethod = 14.90;
                if (id === 'bump-ovos') priceForMethod = 14.90;
            } else {
                if (id === 'ebook-manejo' || id.includes('manejo')) priceForMethod = 27.90;
                if (id === 'bump-6361') priceForMethod = 14.90;
                if (id === 'bump-ovos') priceForMethod = 14.90;
            }
        }

        summaryHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.08);">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <img src="${bumpImg}" alt="${bumpTitle}" style="width: 26px; height: 26px; border-radius: 4px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1);">
                    <span style="color: #34d399; font-weight: 700; font-size: 0.8rem; line-height: 1.2;">+ ${bumpTitle}</span>
                </div>
                <span style="color: #34d399; font-weight: 800; font-size: 0.85rem; flex-shrink: 0;">${formatBRL(priceForMethod)}</span>
            </div>
        `;
    });

    const summaryEl = document.getElementById('checkout-order-summary');
    if (summaryEl) {
        summaryEl.innerHTML = summaryHtml;
    }

    document.querySelectorAll('.checkout-total-display').forEach(el => {
        el.innerText = formatBRL(finalDisplayPrice);
    });

    // Passa o baseCardTotal (preço à vista) para a função construir o dropdown
    updateInstallments(currentPaymentMethod === 'card' ? baseCardTotal : total);
}

function updateInstallments(basePrice) {
    const selector = document.getElementById('installments-select');
    if (!selector) return;

    // Preserva a seleção anterior se possível
    const prevValue = selector.value || '1';
    selector.innerHTML = '';

    // Lógica Premium de Precificação Mura
    // 1x = R$ 89,90 (basePrice)
    // 2x a 4x = R$ 109,90 (Baseado no novo parcelamento)
    
    // Adiciona a opção à vista
    const opt1 = document.createElement('option');
    opt1.value = 1;
    opt1.innerText = `1x de ${formatBRL(basePrice)} (À vista)`;
    opt1.style.background = "#151515";
    opt1.style.color = "#fff";
    selector.appendChild(opt1);

    // Adiciona as opções parceladas baseadas no total
    const installmentTotal = basePrice;
    
    for (let i = 2; i <= 4; i++) {
        let val = installmentTotal / i;
        val = Math.floor(val * 100) / 100; // Força arredondamento para baixo (ex: 27.47)
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `${i}x de ${formatBRL(val)} (Total: ${formatBRL(installmentTotal)})`;
        opt.style.background = "#151515";
        opt.style.color = "#fff";
        selector.appendChild(opt);
    }
    
    // Restaura a seleção anterior se ainda for válida, senão cai para 1
    if (selector.querySelector(`option[value="${prevValue}"]`)) {
        selector.value = prevValue;
    }
}

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

async function renderHomeProducts() {
    const container = document.getElementById('home-products-container');
    if (!container) return;

    showSkeletons(container, 1); // Apenas 1 skeleton para foco único

    try {
        const res = await fetch(`${API_URL}/api/config?t=${Date.now()}`);
        if (!res.ok) throw new Error("Fetch failed");

        const db = await res.json();
        window.siteConfig = db; // EXPOSIÇÃO GLOBAL PARA O UPSELL
        const products = db.products;
        container.innerHTML = '';

        // Foco apenas no produto principal (Doenças) conforme planejado
        const mainId = 'ebook-doencas';
        const p = products[mainId];

        if (!p) {
            container.innerHTML = `<p style="color: #fff; text-align: center;">Produto principal não encontrado.</p>`;
            return;
        }


        const card = document.createElement('div');
        card.className = `price-card featured`;
        card.id = 'offer-focus';

        const featuresHTML = (p.features || []).map(f => `<li><span class="check-icon">✓</span> ${f}</li>`).join('');

        const coverHTML = `<img src="${p.cover}" alt="${p.title}" style="max-width: 140px; margin: 10px auto; display: block; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));">`;
        const isDiscounted = p.originalPrice && (p.originalPrice > p.price);

        // Calculando variáveis dinâmicas
        const discountPercent = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
        const installmentPrice = (p.price / 4).toFixed(2).replace('.', ',');
        const priceStr = p.price.toFixed(2).split('.');
        const priceInt = priceStr[0];
        const priceDec = priceStr[1];

        card.innerHTML = `
            <span class="badge-featured">${p.badge || 'OFERTA ÚNICA'}</span>
            <h3 class="price-title">${p.title}</h3>
            <p>${p.description || ''}</p>
            ${coverHTML}
            
            <div class="price-container" style="margin: 20px 0;">
                <div style="text-decoration: line-through; color: #999; font-size: 0.9rem;">De R$ ${p.originalPrice.toFixed(2).replace('.', ',')} por apenas:</div>
                <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.1;">
                    <span class="price-amount" style="color: var(--color-secondary); font-size: 3.5rem;">
                        R$ ${priceInt}<small>,${priceDec}</small>
                    </span>
                    <span style="font-size: 0.75rem; color: #10b981; font-weight: 800; margin-top: 3px; background: rgba(16, 185, 129, 0.1); padding: 4px 10px; border-radius: 15px;">🔥 ${discountPercent}% DE DESCONTO NO PIX</span>
                    <span style="font-size: 0.9rem; color: var(--color-text-light); margin-top: 5px;">ou até 4x de <strong>R$ ${installmentPrice}</strong> sem juros</span>
                </div>
            </div>

            <ul class="price-features" style="margin-top: 1rem;">
                ${featuresHTML}
            </ul>
            
            <button onclick="openCheckout('${mainId}')" class="btn btn-primary btn-pulse" style="width:100%; font-size: 1.3rem; padding: 1.5rem;">
                QUERO MEU ACESSO AGORA!
            </button>
            <p style="font-size: 0.8rem; opacity: 0.6; margin-top: 15px;"><i class="fa-solid fa-shield-halved"></i> Compra 100% Segura e Acesso Imediato</p>
        `;
        container.appendChild(card);
    } catch (e) {
        console.error("ERRO CARGA OFERTA ÚNICA:", e);
        container.innerHTML = `<p style="color: #fff; text-align: center; padding: 20px;">Não foi possível carregar a oferta principal.</p>`;
    }
}

// --- FUNNEL LOGIC (UPSELL/DOWNSELL) ---

let funnelState = {
    mainId: null,
    upsellAccepted: false,
    downsellActive: false
};

function startFunnel(productId) {
    funnelState.mainId = productId;
    funnelState.upsellAccepted = false;
    funnelState.downsellActive = false;

    showUpsellModal();
}

// --- Skeleton Loader Helper ---
function showSkeletons(container, count = 3) {
    if (!container) return;
    container.innerHTML = Array(count).fill(0).map(() => `
        <div class="price-card skeleton-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-image"></div>
            <div class="skeleton skeleton-price"></div>
            <div class="skeleton skeleton-btn"></div>
        </div>
    `).join('');
}


    // Recalcula o total sempre que o usuário muda a quantidade de parcelas no cartão
    const installmentsSelect = document.getElementById('installments-select');
    if (installmentsSelect) {
        installmentsSelect.addEventListener('change', () => {
            updateTotal();
        });
    }

    // Input masks ------------------------------------------

// --- 3. PAYMENT HANDLING ---

// --- GLOBALS ---
function closeCheckout() {
    if (typeof window.recordCheckoutAbandon === 'function') {
        window.recordCheckoutAbandon('Fechou o checkout no X / Voltar', false);
    }
    const checkoutModal = document.getElementById('checkout-page');
    if (checkoutModal) {
        checkoutModal.classList.remove('active');
        checkoutModal.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // document.body.style.overflow = ''; // Fixed iOS Safari bug
    document.body.classList.remove('modal-open');
    sessionStorage.removeItem('mura_modal_open');
    document.documentElement.style.overflow = '';

    // Esconde qualquer overlay pendente
    const secureOverlay = document.getElementById('secure-loading');
    if (secureOverlay) secureOverlay.classList.remove('active');

    const logoOverlay = document.getElementById('checkout-logo-overlay');
    if (logoOverlay) {
        logoOverlay.classList.remove('active');
        logoOverlay.classList.remove('run-left');
    }

    // RESET STATES ON CLOSE
    const btnPix = document.getElementById('btn-pay-pix');
    if (btnPix) {
        btnPix.innerText = 'Finalizar meu acesso.';
        btnPix.disabled = false;
        btnPix.style.opacity = '1';
    }
}
window.closeCheckout = closeCheckout;
window.attemptCloseCheckout = closeCheckout;

// --- CHECKOUT SINGLE STEP FUNNELS (Previous steps were merged) ---

// --- RESERVATION TIMER (auto-restart) ---
let reservationTimerInterval = null;
function startReservationTimer() {
    if (reservationTimerInterval) clearInterval(reservationTimerInterval);
    let seconds = 600; // 10 minutes
    const display = document.getElementById('checkout-reservation-timer');
    if (!display) return;

    function updateDisplay() {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        display.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    updateDisplay();
    reservationTimerInterval = setInterval(() => {
        seconds--;
        if (seconds < 0) {
            seconds = 600; // restart
        }
        updateDisplay();
    }, 1000);
}

// Alias for white checkout compatibility
function selectPaymentMethod(method) {
    switchMethod(method);
}

function switchMethod(method) {
    // TRACK CHANGE FOR RENDER LOGS
    if (currentPaymentMethod !== method) {
        trackEvent('payment_method_selected', null, null, method);
    }
    currentPaymentMethod = method; // UPDATE STATE

    // Compatibilidade com White Checkout (radio-item)
    const radioItems = document.querySelectorAll('.radio-item');
    if (radioItems.length > 0) {
        radioItems.forEach(i => i.classList.remove('selected'));
        const selected = Array.from(radioItems).find(i => i.querySelector(`input[id="method-${method}"]`));
        if (selected) {
            selected.classList.add('selected');
            selected.querySelector('input').checked = true;
        }
    }

    // Compatibilidade com Dark Checkout (method-btn)
    const btns = document.querySelectorAll('.method-btn');
    if (btns.length > 0) {
        btns.forEach(b => b.classList.remove('active'));
        document.querySelector(`.method-btn[data-method="${method}"]`)?.classList.add('active');
    }

    const pixArea = document.getElementById('pix-area');
    const cardArea = document.getElementById('card-area');
    const btnPix = document.getElementById('btn-pay-pix');
    const btnCard = document.getElementById('btn-pay-card');
    const btnBoleto = document.getElementById('btn-pay-boleto');
    const cardNotice = document.getElementById('card-return-notice');

    if (method === 'pix') {
        if (pixArea) { pixArea.style.display = 'block'; }
        if (cardArea) { cardArea.style.display = 'none'; }
        if (btnPix) btnPix.style.display = 'block';
        if (btnCard) btnCard.style.display = 'none';
        if (btnBoleto) btnBoleto.style.display = 'none';
        if (cardNotice) cardNotice.style.display = 'none';
        const pixFields = document.getElementById('pix-fields');
        if (pixFields) pixFields.style.display = 'block';

    } else if (method === 'card') {
        if (pixArea) { pixArea.style.display = 'none'; }
        if (cardArea) { cardArea.style.display = 'block'; }
        if (btnPix) btnPix.style.display = 'none';
        if (btnCard) btnCard.style.display = 'block';
        if (btnBoleto) btnBoleto.style.display = 'none';
        if (cardNotice) cardNotice.style.display = 'block';
        const pixFields = document.getElementById('pix-fields');
        if (pixFields) pixFields.style.display = 'block'; // KEEP VISIBLE

    } else if (method === 'boleto') {
        if (pixArea) { pixArea.style.display = 'block'; }
        if (cardArea) { cardArea.style.display = 'none'; }
        if (btnPix) btnPix.style.display = 'none';
        if (btnCard) btnCard.style.display = 'none';
        if (btnBoleto) btnBoleto.style.display = 'block';
        if (cardNotice) cardNotice.style.display = 'none';
        const pixFields = document.getElementById('pix-fields');
        if (pixFields) pixFields.style.display = 'block';
    }

    // RECALCULATE TOTAL WHEN SWITCHING
    if (cart.mainProduct) {
        renderOrderBumps(cart.mainProduct.fullBumps);
        updateTotal();
    }
}



window.bypassPixUpsell = false;
window.acceptedPixUpsell = false;

function setupPixUpsellModal(method) {
    const titleEl = document.getElementById('pix-upsell-title');
    const descEl = document.getElementById('pix-upsell-description');
    const priceEl = document.getElementById('pix-upsell-price-offer');
    const subtextEl = document.getElementById('pix-upsell-subtext');
    const listEl = document.getElementById('pix-upsell-list');
    const rejectBtn = document.getElementById('pix-upsell-reject-btn');
    const originalPriceEl = document.getElementById('pix-upsell-original-price');
    const savingsEl = document.getElementById('pix-upsell-savings');
    const imgEl = document.getElementById('pix-upsell-img');
    const prodCategoryEl = document.getElementById('pix-upsell-prod-category');
    const prodTitleEl = document.getElementById('pix-upsell-prod-title');
    const ctaBtnText = document.getElementById('pix-upsell-cta-text');
    const ctaSubText = document.getElementById('pix-upsell-cta-sub');
    const paymentNoteEl = document.getElementById('pix-upsell-payment-note');

    const isPintinhosMain = cart.mainProduct && (cart.mainProduct.id === 'ebook-pintinhos' || cart.mainProduct.id === 'ebook-manejo');

    if (isPintinhosMain) {
        const hasRacao = cart.bumps.includes('bump-6361');
        const hasOvos = cart.bumps.includes('bump-ovos');
        const mainPrice = Number(cart.mainProduct.price) || 27.90;
        const racaoPrice = hasRacao ? 14.90 : 0;
        const ovosPrice = hasOvos ? 14.90 : 0;
        const doencasPrice = 49.90;
        const currentTotal = mainPrice + racaoPrice + ovosPrice;
        const totalWithUpsell = currentTotal + doencasPrice;
        const originalTotal = currentTotal + 117.90;

        const fmtCurrent = currentTotal.toFixed(2).replace('.', ',');
        const fmtTotal = totalWithUpsell.toFixed(2).replace('.', ',');
        const fmtOriginal = originalTotal.toFixed(2).replace('.', ',');

        if (titleEl) titleEl.innerText = '⚠️ ESPERE! NÃO FINALIZE ANTES DE VER ISSO...';
        if (descEl) descEl.innerHTML = 'Adicione o <strong style="color: #fbbf24;">Guia Completo</strong> com mais de 10 doenças que atacam as galinhas, com condição única de oferta imperdível:';
        if (imgEl) {
            imgEl.src = 'capadasdoencas.webp';
            imgEl.alt = 'Guia Completo das Doenças';
        }
        const coverPricingEl = document.getElementById('pix-upsell-cover-pricing');
        if (coverPricingEl) {
            coverPricingEl.innerHTML = `
                <span class="upsell-cover-old">De R$ 117,90</span>
                <span class="upsell-cover-new"><small>por </small>R$ 49,90</span>
            `;
        }
        if (prodCategoryEl) prodCategoryEl.innerText = 'GUIA COMPLETO ADICIONAL';
        if (prodTitleEl) prodTitleEl.innerText = '💊 O Segredo das Doenças';
        if (priceEl) priceEl.innerHTML = '+ R$ 49,90';
        if (originalPriceEl) originalPriceEl.innerText = `De R$ ${fmtOriginal}`;
        if (savingsEl) savingsEl.innerText = '• Economize R$ 68,00';
        if (subtextEl) subtextEl.innerText = 'Adicional com desconto:';

        if (listEl) {
            listEl.innerHTML = `
                <div class="upsell-benefit-item">
                    <span class="upsell-benefit-check">✓</span>
                    <span>Mais de 10 doenças catalogadas</span>
                </div>
                <div class="upsell-benefit-item">
                    <span class="upsell-benefit-check">✓</span>
                    <span>Protocolo de vacinação e vermifugação</span>
                </div>
                <div class="upsell-benefit-item">
                    <span class="upsell-benefit-check">✓</span>
                    <span>Prevenção e biossegurança</span>
                </div>
                <div class="upsell-benefit-item">
                    <span class="upsell-benefit-check">✓</span>
                    <span>Tratamento detalhado com medicamentos que eu mesmo uso no meu criatório</span>
                </div>
            `;
        }

        const summaryBox = document.getElementById('pix-upsell-summary-box');
        if (summaryBox) {
            summaryBox.style.display = 'block';
            summaryBox.innerHTML = `
                <div class="upsell-summary-rows">
                    <div class="upsell-summary-row">
                        <span>🐣 Manejo dos Pintinhos:</span>
                        <strong>R$ ${mainPrice.toFixed(2).replace('.', ',')}</strong>
                    </div>
                    ${hasRacao ? `
                    <div class="upsell-summary-row">
                        <span>🌾 Tabela de Ração Prática:</span>
                        <strong>R$ 14,90</strong>
                    </div>` : ''}
                    ${hasOvos ? `
                    <div class="upsell-summary-row">
                        <span>🥚 Potencialize Produção de Ovos:</span>
                        <strong>R$ 14,90</strong>
                    </div>` : ''}
                    <div class="upsell-summary-row upsell-summary-row-highlight">
                        <span>💊 Guia Completo das Doenças:</span>
                        <strong>+ R$ 49,90</strong>
                    </div>
                </div>
            `;
        }

        const totalValueEl = document.getElementById('pix-upsell-total-value');
        if (totalValueEl) {
            totalValueEl.innerText = `R$ ${fmtTotal}`;
        }

        if (paymentNoteEl) {
            paymentNoteEl.innerText = method === 'boleto' ? 'no Boleto, PIX ou até 4x no cartão' : 'no PIX ou até 4x no cartão';
        }

        if (ctaBtnText) {
            ctaBtnText.innerText = ctaSubText
                ? 'SIM! APRENDER SOBRE AS DOENÇAS'
                : `SIM! APRENDER SOBRE AS DOENÇAS (R$ ${fmtTotal})`;
        }
        if (ctaSubText) {
            ctaSubText.innerText = `Incluir no meu pedido • Total: R$ ${fmtTotal}`;
        }
        if (rejectBtn) {
            rejectBtn.innerText = `Não, levar apenas o que escolhi (R$ ${fmtCurrent})`;
        }
        return;
    }

    const hasRacao = cart.bumps.includes('bump-6361');
    const hasOvos = cart.bumps.includes('bump-ovos');
    const mainPrice = Number(cart.mainProduct?.price) || 49.90;
    const racaoPrice = hasRacao ? 14.90 : 0;
    const ovosPrice = hasOvos ? 14.90 : 0;
    const pintinhosPrice = 27.90;
    const currentTotal = mainPrice + racaoPrice + ovosPrice;
    const totalWithUpsell = currentTotal + pintinhosPrice;
    const originalTotal = currentTotal + 67.00;

    const fmtCurrent = currentTotal.toFixed(2).replace('.', ',');
    const fmtTotal = totalWithUpsell.toFixed(2).replace('.', ',');
    const fmtOriginal = originalTotal.toFixed(2).replace('.', ',');

    if (titleEl) titleEl.innerText = '⚠️ ESPERE! NÃO FINALIZE ANTES DE VER ISSO...';
    if (descEl) descEl.innerHTML = 'Adicione o <strong style="color: #fbbf24;">Manual de Manejo de Pintinhos</strong> com condição única de balcão:';
    if (imgEl) {
        imgEl.src = 'capadospintinhos.webp';
        imgEl.alt = 'Manual de Manejo dos Pintinhos';
    }
    if (prodCategoryEl) prodCategoryEl.innerText = 'MANUAL COMPLETO ADICIONAL';
    if (prodTitleEl) prodTitleEl.innerText = 'Manual de Manejo dos Pintinhos';
    if (priceEl) priceEl.innerHTML = '+ R$ 27,90';
    if (originalPriceEl) originalPriceEl.innerText = `De R$ ${fmtOriginal}`;
    if (savingsEl) savingsEl.innerText = '🔥 Economia de R$ 39,10';
    if (subtextEl) subtextEl.innerText = 'Adicional com desconto:';
    if (listEl) {
        listEl.innerHTML = `
            <div class="upsell-benefit-item">
                <span class="upsell-benefit-check">✓</span>
                <span>Mortalidade Zero no Pinteiro (1º ao 90º dia)</span>
            </div>
            <div class="upsell-benefit-item">
                <span class="upsell-benefit-check">✓</span>
                <span>Tabela Térmica e controle de temperatura</span>
            </div>
            <div class="upsell-benefit-item">
                <span class="upsell-benefit-check">✓</span>
                <span>Prevenção desde as primeiras horas de vida</span>
            </div>
            <div class="upsell-benefit-item">
                <span class="upsell-benefit-check">✓</span>
                <span>Desenvolvimento rápido e ganho de peso</span>
            </div>
        `;
    }

    const summaryBox = document.getElementById('pix-upsell-summary-box');
    if (summaryBox) {
        summaryBox.style.display = 'block';
        summaryBox.innerHTML = `
            <div class="upsell-summary-header">
                📦 O QUE VOCÊ VAI RECEBER:
            </div>
            <div class="upsell-summary-rows">
                <div class="upsell-summary-row">
                    <span>💊 Guia Completo das Doenças:</span>
                    <strong>R$ ${mainPrice.toFixed(2).replace('.', ',')}</strong>
                </div>
                ${hasRacao ? `
                <div class="upsell-summary-row">
                    <span>🌾 Tabela de Ração Prática:</span>
                    <strong>R$ 14,90</strong>
                </div>` : ''}
                ${hasOvos ? `
                <div class="upsell-summary-row">
                    <span>🥚 Potencialize a Produção de Ovos:</span>
                    <strong>R$ 14,90</strong>
                </div>` : ''}
                <div class="upsell-summary-row upsell-summary-row-highlight">
                    <span>🐣 Manual de Manejo dos Pintinhos:</span>
                    <strong>+ R$ 27,90</strong>
                </div>
            </div>
        `;
    }

    const totalValueEl = document.getElementById('pix-upsell-total-value');
    if (totalValueEl) {
        totalValueEl.innerText = `R$ ${fmtTotal}`;
    }

    if (ctaBtnText) {
        ctaBtnText.innerText = ctaSubText
            ? 'SIM! APRENDER MANEJO DE PINTINHOS'
            : `Aprender sobre o manejo de pintinhos (Total: R$ ${fmtTotal})`;
    }
    if (ctaSubText) {
        ctaSubText.innerText = `Incluir no meu pedido • Total: R$ ${fmtTotal}`;
    }
    if (rejectBtn) rejectBtn.innerText = `Não, levar apenas o que escolhi (R$ ${fmtCurrent})`;
}


window.acceptPixUpsell = function() {
    window.bypassPixUpsell = true;
    window.acceptedPixUpsell = true;
    window.originalHadRacao = cart.bumps.includes('bump-6361');
    window.originalHadOvos = cart.bumps.includes('bump-ovos');
    window.originalHadManejo = cart.bumps.includes('ebook-manejo');

    if (cart.mainProduct && (cart.mainProduct.id === 'ebook-pintinhos' || cart.mainProduct.id === 'ebook-manejo')) {
        if (!cart.bumps.includes('ebook-doencas')) cart.bumps.push('ebook-doencas');
    } else {
        if (!cart.bumps.includes('ebook-manejo')) cart.bumps.push('ebook-manejo');
    }

    const upsellModal = document.getElementById('pix-upsell-modal');
    if (upsellModal) upsellModal.classList.add('hidden');
    updateTotal();
    const targetMethod = window._pendingUpsellMethod || currentPaymentMethod;
    handlePayment(targetMethod);
};

window.rejectPixUpsell = function() {
    window.bypassPixUpsell = true;
    window.acceptedPixUpsell = false;
    const upsellModal = document.getElementById('pix-upsell-modal');
    if (upsellModal) upsellModal.classList.add('hidden');
    const targetMethod = window._pendingUpsellMethod || currentPaymentMethod;
    handlePayment(targetMethod);
};

async function handlePayment(method) {
    let customer = {};

    // FIX: Define commonData here to avoid undefined error
    const commonData = {
        email: method === 'card' 
            ? (document.getElementById('card-email')?.value || document.getElementById('payer-email')?.value || '')
            : (document.getElementById('payer-email')?.value || ''),
        phone: method === 'card'
            ? (document.getElementById('card-phone')?.value || document.getElementById('payer-phone')?.value || '').replace(/\D/g, '')
            : (document.getElementById('payer-phone')?.value || '').replace(/\D/g, '')
    };

    if (method === 'pix' || method === 'boleto') {
        customer = {
            ...commonData,
            name: document.getElementById('payer-name').value,
            cpf: document.getElementById('payer-cpf').value ? document.getElementById('payer-cpf').value.replace(/\D/g, '') : ''
        };
    } else {
        // CARD MODE
        customer = {
            ...commonData,
            name: document.getElementById('card-holder').value,
            cpf: (document.getElementById('card-cpf')?.value || document.getElementById('payer-cpf')?.value || '').replace(/\D/g, ''),
            cep: (document.getElementById('card-cep')?.value || '').replace(/\D/g, '')
        };
    }

    const isValid = validateCheckoutInputs(method);
    if (!isValid) return;

    // --- PIX/CARD/BOLETO UPSELL INTERCEPT PARA PINTINHOS -> DOENÇAS ---
    const isPintinhosMain = cart.mainProduct && (cart.mainProduct.id === 'ebook-pintinhos' || cart.mainProduct.id === 'ebook-manejo');
    const shouldShowPixUpsell = !window.bypassPixUpsell && (method === 'pix' || method === 'card' || method === 'boleto') && isPintinhosMain && !cart.bumps.includes('ebook-doencas');

    console.log('[UPSELL DEBUG] bypass:', window.bypassPixUpsell, 'method:', method, 'product:', cart.mainProduct?.id, 'bumps:', cart.bumps, 'shouldShow:', shouldShowPixUpsell);

    if (shouldShowPixUpsell) {
        const upsellModal = document.getElementById('pix-upsell-modal');
        if (upsellModal) {
            window._pendingUpsellMethod = method;
            captureAbandonedLead({
                type: 'upsell_modal_shown',
                reason: 'Abriu formulário e visualizou oferta de Upsell das Doenças'
            });
            setupPixUpsellModal(method);
            upsellModal.classList.remove('hidden');
            upsellModal.scrollTop = 0;
            return; // Pausa a geração do pagamento até o cliente aceitar ou recusar o Upsell
        }
    }


    // ─── META ADVANCED MATCHING ──────────────────────────────────────────────
    // Re-inicializa o Pixel com dados reais do cliente ANTES de disparar eventos.
    // Isso resolve o erro de diagnóstico da Meta e permite atribuição correta.
    updateMetaUserData(customer);

    // PRICING LOGIC FOR API PAYLOAD (Cobrança exata do preço mostrado na tela)
    const mainPrice = cart.mainProduct.price;

    const items = [{ id: cart.mainProduct.id, title: cart.mainProduct.title, price: mainPrice }];

    // Adiciona bumps com preços corretos
    cart.bumps.forEach(id => {
        let b = cart.mainProduct.fullBumps?.find(x => x.id === id);
        
        // CORREÇÃO: Fallback idêntico ao updateTotal para garantir soma correta no PIX/Cartão/Boleto
        if (!b && id === 'ebook-doencas') {
            b = { id: 'ebook-doencas', title: 'Guia Completo das Doenças', price: 49.90, priceCard: 49.90 };
        } else if (!b && (id === 'ebook-manejo' || id === 'ebook-pintinhos')) {
            b = { id: id, title: 'Manual de Manejo dos Pintinhos', price: 27.90, priceCard: 27.90 };
        } else if (!b && id.startsWith('ebook-')) {
            const prod = window.siteConfig?.products?.[id] || prefetchedProducts[id];
            if (prod) {
                b = {
                    id: id,
                    title: prod.title,
                    price: prod.price,
                    priceCard: prod.originalPrice || prod.price
                };
            } else {
                const fallbackPrice = (id === 'ebook-manejo') ? 27.90 : ((id === 'ebook-doencas') ? 49.90 : 14.90);
                b = { 
                    id: id, 
                    title: id === 'ebook-manejo' ? 'Manual de Pintinhos' : (id === 'ebook-doencas' ? 'Guia Completo das Doenças' : (id === 'bump-ovos' ? 'Potencialize a Produção de Ovos' : 'Tabela de Ração Prática')),
                    price: fallbackPrice, 
                    priceCard: fallbackPrice
                };
            }
        }

        if (b) {
            let bumpPrice = b.price; // Fixado pelo admin para não aumentar no cartão
            
            // --- PIX/CARD UPSELL RECAPTURE PRICE OVERRIDE ---
            if (window.acceptedPixUpsell && (method === 'pix' || method === 'card' || method === 'boleto')) {
                if (cart.mainProduct.id === 'ebook-pintinhos' || cart.mainProduct.id === 'ebook-manejo') {
                    if (b.id === 'ebook-doencas') bumpPrice = 49.90;
                    if (b.id === 'bump-6361') bumpPrice = 14.90;
                    if (b.id === 'bump-ovos') bumpPrice = 14.90;
                } else {
                    if (b.id === 'ebook-manejo') bumpPrice = 27.90;
                    if (b.id === 'bump-6361') bumpPrice = 14.90;
                    if (b.id === 'bump-ovos') bumpPrice = 14.90;
                }
            }

            items.push({ id: b.id, title: b.title, price: bumpPrice });
        }
    });

    console.log(`📦 [CHECKOUT] Payload Items (${method}):`, items);

    if (method === 'pix' || method === 'boleto') {
        const isBoleto = method === 'boleto';
        const btn = document.getElementById(isBoleto ? 'btn-pay-boleto' : 'btn-pay-pix');
        const originalText = (btn) ? btn.innerText : (isBoleto ? 'Gerar Boleto' : 'Gerar PIX');

        // --- INSTANT UI FEEDBACK ---
        document.getElementById('checkout-main-view').classList.add('hidden');
        document.getElementById('pix-result').classList.add('hidden');
        const boletoResult = document.getElementById('boleto-result');
        if (boletoResult) boletoResult.classList.add('hidden');

        const resultView = document.getElementById(isBoleto ? 'boleto-result' : 'pix-result');
        resultView.classList.remove('hidden');
        
        // Rolar imediatamente para o topo
        setTimeout(() => { 
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
            const cp = document.getElementById('checkout-page');
            if (cp) cp.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
        
        if (!isBoleto) {
            document.getElementById('qr-loader').classList.remove('hidden');
            document.getElementById('qr-code-img').style.opacity = '0';
            document.getElementById('pix-receiver-info').classList.add('hidden');
            document.getElementById('btn-copy-pix').style.display = 'none';
            const pixNotice = document.getElementById('pix-return-notice');
            if (pixNotice) pixNotice.style.display = 'none';
        } else {
            document.getElementById('boleto-barcode-display').innerText = 'Gerando código...';
            document.getElementById('btn-copy-boleto').style.display = 'none';
            document.getElementById('btn-download-boleto').style.display = 'none';
            const boletoImgLoading = document.getElementById('boleto-img-loading');
            const boletoImgWrap = document.getElementById('boleto-img-wrap');
            const boletoDisplayImg = document.getElementById('boleto-display-img');
            if (boletoDisplayImg) {
                revokeBoletoIllustrationObjectUrl(boletoDisplayImg);
                boletoDisplayImg.removeAttribute('src');
            }
            if (boletoImgWrap) boletoImgWrap.classList.add('hidden');
            if (boletoImgLoading) boletoImgLoading.classList.remove('hidden');
        }

        const totalAmount = items.reduce((acc, item) => acc + Number(item.price), 0);
        const itemIds = items.map(i => i.id).sort().join(',');

        try {
            if (!cart.mainProduct) {
                console.error("Cart Error: No main product selected");
                alert("Houve um erro: produto não selecionado. Por favor, reinicie a compra.");
                document.getElementById('checkout-main-view').classList.remove('hidden');
                resultView.classList.add('hidden');
                return;
            }

            const { fbc, fbp } = getMetaCookies();

            // PIXEL + CAPI: AddPaymentInfo — sinal crucial para o Meta otimizar
            const addPaymentEventId = 'ap_pix_' + Date.now() + '_' + Math.random().toString(16).slice(2, 10);
            trackPixel('AddPaymentInfo', {
                content_ids: items.map(i => i.id),
                content_type: 'product',
                value: totalAmount,
                currency: 'BRL'
            }, addPaymentEventId);
            trackCAPI('AddPaymentInfo', addPaymentEventId, {
                value: totalAmount, currency: 'BRL',
                contentIds: items.map(i => i.id),
            });
            console.log('[TRACKING] AddPaymentInfo PIX disparado. eventId:', addPaymentEventId);

            const endpointVar = isBoleto ? '/api/checkout/boleto' : '/api/checkout/pix';
            const res = await fetch(`${API_URL}${endpointVar}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    items, 
                    customer, 
                    facebookEventId: currentFacebookEventId,
                    fbc: fbc,
                    fbp: fbp,
                    externalId: sessionStorage.getItem('mura_session_id'), // Session ID para match
                    userAgent: navigator.userAgent,
                    site: PAGE_SOURCE
                })
            });

            const data = await res.json();

            if (!isBoleto && data.qr_code) {
                localStorage.setItem('active_pix_session', JSON.stringify({
                    data: data,
                    total: totalAmount,
                    itemIds: itemIds,
                    facebookEventId: currentFacebookEventId,
                    timestamp: Date.now()
                }));
                captureAbandonedLead({ pixGenerated: true, pixId: data.id });
                showPixResult(data, items);

            } else if (isBoleto && (data.barcode || data.external_resource_url)) {
                captureAbandonedLead({ pixGenerated: true, pixId: data.id });
                showBoletoResult(data);
            } else {
                console.error("Payment Error Response:", data);
                alert(data.error || data.message || 'Houve um erro ao processar o pagamento.');
                document.getElementById('checkout-main-view').classList.remove('hidden');
                resultView.classList.add('hidden');
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            }
        } catch (e) {
            console.error("Payment Error:", e);
            alert('Não foi possível processar seu pagamento agora.');
            document.getElementById('checkout-main-view').classList.remove('hidden');
            resultView.classList.add('hidden');
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
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
            console.log("Processando Cartão - CPF Limpo:", cleanCPF);

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
                identificationNumber: cleanCPF
            };
            console.log("Token Params:", { ...cardTokenParams, cardNumber: '***', securityCode: '***' });

            const token = await mp.createCardToken(cardTokenParams);
            console.log("Token MP gerado:", token);

            if (!token || !token.id) {
                console.error("Erro Token MP:", token);
                throw new Error("Não foi possível validar o cartão. Verifique os dados.");
            }

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

            const { fbc, fbp } = getMetaCookies();

            // PIXEL + CAPI: AddPaymentInfo — sinal crucial para o Meta otimizar
            const addPayEventIdCard = 'ap_card_' + Date.now() + '_' + Math.random().toString(16).slice(2, 10);
            trackPixel('AddPaymentInfo', {
                content_ids: items.map(i => i.id),
                content_type: 'product',
                value: items.reduce((acc, i) => acc + Number(i.price), 0),
                currency: 'BRL'
            }, addPayEventIdCard);
            trackCAPI('AddPaymentInfo', addPayEventIdCard, {
                value: items.reduce((acc, i) => acc + Number(i.price), 0),
                currency: 'BRL',
                contentIds: items.map(i => i.id),
            });
            console.log('[TRACKING] AddPaymentInfo Cartão disparado. eventId:', addPayEventIdCard);

            // Dinamicamente identificar a bandeira do cartão via API do Mercado Pago com fallback local
            let paymentMethodId = getPaymentMethodId(cardNumber);
            try {
                const bin = cardNumber.slice(0, 6);
                if (bin.length === 6 && typeof mp !== 'undefined' && mp.getPaymentMethods) {
                    const mpMethods = await mp.getPaymentMethods({ bin });
                    if (mpMethods && mpMethods.results && mpMethods.results.length > 0) {
                        paymentMethodId = mpMethods.results[0].id;
                        console.log("Bandeira obtida via API Mercado Pago:", paymentMethodId);
                    }
                }
            } catch (err) {
                console.warn("Falha ao obter bandeira via API, usando fallback local:", err);
            }

            const payload = {
                items, customer, token: token.id,
                installments: document.getElementById('installments-select')?.value || '1',
                payment_method_id: paymentMethodId,
                issuer_id: null,
                deviceId: (typeof mp !== 'undefined' && mp.getDeviceId) ? mp.getDeviceId() : null,
                facebookEventId: currentFacebookEventId,
                fbc: fbc,
                fbp: fbp,
                externalId: sessionStorage.getItem('mura_session_id'), // Session ID para match
                userAgent: navigator.userAgent,
                site: PAGE_SOURCE
            };
            console.log("Enviando Payload API:", payload);

            const res = await fetch(`${API_URL}/api/checkout/card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            console.log("Resposta API:", result);

            if (result.status === 'approved') {
                sessionStorage.setItem('mura_checkout_paid', 'true');
                sessionStorage.removeItem('mura_modal_open');
                const c = getCurrentCustomerData();
                // Salva dados no sessionStorage para a página de obrigado
                sessionStorage.setItem('obrigado_name', c.name || '');
                sessionStorage.setItem('obrigado_email', c.email || '');
                sessionStorage.setItem('obrigado_cpf', c.cpf || '');
                sessionStorage.setItem('obrigado_senha', result.senha || '');
                sessionStorage.setItem('obrigado_method', 'cartao');
                sessionStorage.setItem('obrigado_items', items.map(i => i.id || i.title).join(','));
                sessionStorage.setItem('obrigado_total', items.reduce((acc, i) => acc + Number(i.price), 0).toFixed(2));
                sessionStorage.setItem('obrigado_evid', currentFacebookEventId);

                setTimeout(() => {
                    window.location.href = 'obrigado.html';
                }, 1500);
            } else if (result.status === 'in_process' || result.status === 'pending') {
                // NOVO: Pagamento em análise - Tela Profissional
                console.log("⏳ Pagamento em análise - Mostrando View Pendente");

                // Hide main checkout and show pending view
                document.getElementById('checkout-main-view').classList.add('hidden');
                document.getElementById('pix-result').classList.add('hidden'); // Ensure pix result is hidden
                document.getElementById('payment-pending-view').classList.remove('hidden');

                btn.disabled = false;
                btn.innerText = originalText;
            } else {
                // Captura abandono por cartão recusado
                captureAbandonedLead({
                    type: 'card_declined',
                    reason: result.status_detail || result.error || 'Cartão Recusado',
                    cpf: customer?.cpf || document.getElementById('card-cpf')?.value,
                    total: items.reduce((acc, i) => acc + Number(i.price), 0)
                });

                let msg = 'Pagamento Recusado.';
                if (result.status_detail) msg += ` Motivo: ${result.status_detail}`;

                // Melhor tratamento para mensagem de erro
                if (result.message && result.message !== 'Payment failed') msg = result.message;
                if (result.error) msg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);

                // Mensagens simplificadas para o cliente
                const map = {
                    'cc_rejected_bad_filled_other': 'CPF inválido. Verifique os dados e tente novamente.',
                    'cc_rejected_bad_filled_card_number': 'Número do cartão inválido.',
                    'cc_rejected_bad_filled_date': 'Data de validade incorreta.',
                    'cc_rejected_bad_filled_security_code': 'Código CVV incorreto.',
                    'cc_rejected_insufficient_amount': 'Saldo insuficiente no cartão.',
                    'cc_rejected_high_risk': 'Cartão recusado por segurança. Tente outro cartão ou pague via PIX.',
                    'cc_rejected_other_reason': 'Cartão recusado pelo banco. Tente outro cartão.',
                    'cc_rejected_call_for_authorize': 'Seu banco precisa autorizar. Ligue para o banco e tente novamente.',
                    'cc_rejected_card_disabled': 'Cartão bloqueado. Entre em contato com seu banco.',
                    'cc_rejected_duplicated_payment': 'Pagamento duplicado. Verifique seu e-mail.',
                    'cc_rejected_max_attempts': 'Muitas tentativas. Aguarde alguns minutos.',
                    'cc_rejected_blacklist': 'Cartão não autorizado. Tente outro cartão.',
                    'cc_rejected_invalid_installments': 'Parcelas inválidas. Escolha outra opção.',
                    'pending_review_manual': 'Pagamento em análise. Aguarde confirmação por e-mail.',
                    'pending_contingency': 'Processando. Aguarde a confirmação.',
                    'rejected': 'Pagamento recusado. Tente outro cartão ou PIX.'
                };

                if (result.status_detail && map[result.status_detail]) {
                    alert(map[result.status_detail] + '\n\n💡 Dica: O PIX tem aprovação instantânea!');
                } else {
                    console.error("Erro detalhado:", result);
                    const errorMsg = result.error || result.message || 'Pagamento não autorizado.';
                    alert(`${errorMsg}\n\nTente usar outro cartão ou pague via PIX para liberação imediata.`);
                }

                // Return to form if failed
                document.getElementById('checkout-main-view').classList.remove('hidden');
                processingView.classList.add('hidden');

                if (qrContainer) qrContainer.style.display = 'block';
                if (copyArea) copyArea.style.display = 'flex';

                btn.disabled = false;
                btn.innerText = originalText;
            }
        } catch (e) {
            console.error("ERRO CRÃ TICO CARTÃO:", e);
            let errDisplay = 'Erro desconhecido';

            if (e && e.message) errDisplay = e.message;
            else if (e && e.cause) errDisplay = JSON.stringify(e.cause);
            else if (typeof e === 'string') errDisplay = e;
            else if (typeof e === 'object') errDisplay = JSON.stringify(e);
            trackEvent('checkout_error', null, null, `Erro Cartão (JS): ${errDisplay}`);
            alert('Houve um erro ao processar seu cartão.\n\nDetalhe técnico: ' + errDisplay + '\n\nTente novamente ou use o PIX.');

            document.getElementById('checkout-main-view').classList.remove('hidden');
            document.getElementById('pix-result').classList.add('hidden');
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

// --- 1. PIX PAYMENT (Simplified) ---
async function startPixPayment(event) {
    if (event) event.preventDefault();
    console.log('🔵 startPixPayment CALLED');

    // Captura IMEDIATA antes de qualquer validação, upsell ou falha
    captureAbandonedLead({
        type: 'checkout_click_pay',
        reason: 'Clicou em Gerar PIX'
    });

    if (!validateCheckoutInputs('pix')) {
        return;
    }

    await processPixPayment();
}

async function processPixPayment() {
    console.log('🔵 processPixPayment CALLED');
    
    if (!validateCheckoutInputs('pix')) {
        return;
    }

    console.log('✅ Validation passed! Proceeding to handlePayment(pix)');
    handlePayment('pix');
}

async function startBoletoPayment(event) {
    if (event) event.preventDefault();
    console.log('🟡 startBoletoPayment CALLED');

    // Captura IMEDIATA
    captureAbandonedLead({
        type: 'checkout_click_pay',
        reason: 'Clicou em Gerar Boleto'
    });

    if (!validateCheckoutInputs('boleto')) {
        return;
    }

    handlePayment('boleto');
}



// --- 2. CARD PAYMENT (Simplified) ---
async function startCardPayment(event) {
    console.log('🔵 startCardPayment CALLED');
    if (event) event.preventDefault();

    // Captura IMEDIATA
    captureAbandonedLead({
        type: 'checkout_click_pay',
        reason: 'Clicou em Pagar com Cartão'
    });

    if (!validateCheckoutInputs('card')) {
        return;
    }

    await processCardPayment();
}


async function processCardPayment() {
    console.log('🔵 processCardPayment CALLED');

    // NEW: Unified Validation instead of manual alerts
    if (!validateCheckoutInputs('card')) {
        console.warn('⚠️ Validation failed in processCardPayment');
        return;
    }

    // If all validations pass, proceed with original handlePayment('card') logic
    console.log('✅ Validation passed! Proceeding to handlePayment(card)');
    handlePayment('card');
}

// --- VALIDATION AND INTERCEPTION FUNCTIONS ---


// getMetaCookies já definido acima no CAPI Engine (linha ~309)

function showToast(title, message, type = 'error') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-card';
    toast.style.cssText = 'background: #ffffff !important; color: #0f172a !important; border-radius: 16px !important; padding: 14px 20px !important; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.1) !important; border: 1px solid rgba(0,0,0,0.08) !important; display: flex !important; align-items: center !important; gap: 14px !important; pointer-events: auto !important; z-index: 999999 !important;';
    
    const bgColor = type === 'success' ? '#10b981' : '#ef4444';
    const iconClass = type === 'success' ? 'fa-check' : 'fa-triangle-exclamation';

    toast.innerHTML = `
        <div style="width: 38px; height: 38px; min-width: 38px; background: ${bgColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="toast-content" style="text-align: left;">
            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a; line-height: 1.2;">${title}</h4>
            <p style="margin: 3px 0 0 0; font-size: 0.82rem; font-weight: 600; color: #475569; line-height: 1.3;">${message}</p>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
}

function validateCheckoutInputs(method) {
    console.log('🔍 [VALIDATE] Inicando validação para:', method);
    
    const isPixOrBoleto = method === 'pix' || method === 'boleto';
    const name = document.getElementById(isPixOrBoleto ? 'payer-name' : 'card-holder');
    const email = document.getElementById('payer-email'); // SEMPRE usa o payer-email
    const phone = document.getElementById('payer-phone'); // SEMPRE usa o payer-phone
    const cpf = document.getElementById(isPixOrBoleto ? 'payer-cpf' : 'card-cpf');

    if (!validateField(name, 'text')) { 
        showToast('Nome incompleto', 'Por favor, informe seu nome completo para emissão da nota.'); 
        name.focus();
        return false; 
    }
    if (!validateField(email, 'email')) { 
        showToast('E-mail inválido', 'Se preenchido, informe um e-mail válido.'); 
        email.focus();
        return false; 
    }
    // O telefone do Pix/Boleto é obrigatório. Do cartão é opcional se estiver vazio.
    const isPhoneRequired = isPixOrBoleto;
    const phoneVal = phone ? phone.value.trim() : '';
    if (isPhoneRequired || phoneVal.length > 0) {
        if (!validateField(phone, 'phone') || phoneVal.replace(/\D/g, '').length < 10) { 
            showToast('Telefone inválido', 'Informe um telefone com DDD para suporte via WhatsApp.'); 
            phone.focus();
            return false; 
        }
    }
    if (!validateField(cpf, 'cpf')) { 
        showToast('CPF Inválido', 'O CPF é obrigatório para processar o pagamento com segurança.'); 
        cpf.focus();
        return false; 
    }

    if (method === 'card') {
        const number = document.getElementById('card-number');
        const expiry = document.getElementById('card-expiration');
        const cvv = document.getElementById('card-cvv');
        const cep = document.getElementById('card-cep');

        if (!validateField(number, 'card')) { showToast('Cartão Inválido', 'Verifique o número do cartão impresso na frente.'); number.focus(); return false; }
        if (!validateField(expiry, 'date')) { showToast('Validade Expirada/Incorreta', 'A validade deve estar no formato MM/AA.'); expiry.focus(); return false; }
        if (!validateField(cvv, 'cvv')) { showToast('Código CVV', 'O código de 3 dígitos atrás do cartão está incorreto.'); cvv.focus(); return false; }
        if (!validateField(cep, 'cep')) { showToast('CEP Inválido', 'Informe o CEP de cobrança do cartão.'); cep.focus(); return false; }
    }

    console.log('✅ [VALIDATE] Tudo certo!');
    return true;
}

function interceptPaymentButton(callback) {
    // Esta função pode ser usada para interceptar o pagamento com upsells
    // Por enquanto, apenas retorna false para permitir o fluxo normal
    return false;
}

function calculateCurrentCartTotal() {
    try {
        if (!cart || !cart.mainProduct) return 89.90;
        let t = Number(cart.mainProduct.price) || 89.90;
        if (Array.isArray(cart.bumps)) {
            cart.bumps.forEach(id => {
                const b = cart.mainProduct.fullBumps?.find(x => x.id === id);
                if (b && b.price) t += Number(b.price);
                else if (id === 'ebook-doencas') t += 49.90;
                else if (id === 'ebook-manejo' || id === 'ebook-pintinhos') t += 27.90;
            });
        }
        return Number(t.toFixed(2));
    } catch (e) {
        return 89.90;
    }
}

let lastAbandonSignature = '';
let lastAbandonTime = 0;

async function captureAbandonedLead(extra = {}) {
    try {
        if (sessionStorage.getItem('mura_checkout_paid') === 'true') return;

        const name = (extra.name || document.getElementById('payer-name')?.value || document.getElementById('card-holder')?.value || document.getElementById('customer-name')?.value || '').trim();
        const email = (extra.email || document.getElementById('payer-email')?.value || document.getElementById('card-email')?.value || document.getElementById('customer-email')?.value || '').trim();
        const rawPhone = (extra.phone || document.getElementById('payer-phone')?.value || document.getElementById('card-phone')?.value || document.getElementById('customer-phone')?.value || '').trim();
        const cleanPhone = rawPhone.replace(/\D/g, '');
        const rawCpf = (extra.cpf || document.getElementById('payer-cpf')?.value || document.getElementById('card-cpf')?.value || document.getElementById('customer-cpf')?.value || '').trim();
        const cleanCpf = rawCpf.replace(/\D/g, '');
        const productId = extra.product || (cart && cart.mainProduct && cart.mainProduct.id) || (cart && cart.id) || (PAGE_SOURCE.startsWith('pintinhos') ? 'ebook-pintinhos' : 'combo-plataforma');
        const total = extra.total || calculateCurrentCartTotal();

        // Só captura lead nominal se tiver telefone (>= 8 dígitos) OU email válido OU CPF (11 dígitos)
        const hasContact = cleanPhone.length >= 8 || (email.length >= 5 && email.includes('@')) || cleanCpf.length >= 11;
        if (!hasContact) return;

        const payload = {
            name: name || 'Cliente',
            email: email || '',
            phone: rawPhone,
            cpf: cleanCpf,
            product: productId,
            total: total,
            pixGenerated: extra.pixGenerated || false,
            pixId: extra.pixId || null,
            type: extra.type || (extra.pixGenerated ? 'pix_pending' : 'checkout_abandon'),
            reason: extra.reason || 'Preencheu dados no checkout',
            site: typeof PAGE_SOURCE !== 'undefined' ? PAGE_SOURCE : 'app'
        };

        const signature = JSON.stringify([payload.name, payload.email, cleanPhone, cleanCpf, payload.product, payload.total, payload.pixGenerated, payload.pixId]);
        const now = Date.now();
        if (!extra.force && !extra.useBeacon && !extra.pixGenerated && signature === lastAbandonSignature && (now - lastAbandonTime) < 2500) {
            return;
        }
        lastAbandonSignature = signature;
        lastAbandonTime = now;

        const payloadStr = JSON.stringify(payload);
        const endpoint = `${API_URL}/api/abandon`;

        // text/plain evita CORS Preflight (OPTIONS) no mobile/Instagram WebView durante fechamento de aba
        if (extra.useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const blob = new Blob([payloadStr], { type: 'text/plain;charset=UTF-8' });
            const queued = navigator.sendBeacon(endpoint, blob);
            if (queued) return;
        }

        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: payloadStr,
            keepalive: true
        }).catch(e => console.warn('Falha ao registrar abandono', e));
    } catch (e) {
        console.warn('Erro ao capturar abandono', e);
    }
}

function recordCheckoutAbandon(reason = 'Saiu do checkout sem finalizar', useBeacon = false) {
    try {
        if (sessionStorage.getItem('mura_checkout_paid') === 'true') return;
        const isModalOpen = sessionStorage.getItem('mura_modal_open') === 'true' ||
            document.getElementById('checkout-page')?.classList.contains('active');
        if (!isModalOpen) return;

        captureAbandonedLead({
            type: 'checkout_abandon',
            reason,
            useBeacon,
            force: true
        });

        if (sessionStorage.getItem('mura_abandon_tracked') !== 'true') {
            sessionStorage.setItem('mura_abandon_tracked', 'true');
            trackEvent('checkout_abandon', null, null, reason, useBeacon);
        }
    } catch (e) {
        console.warn('Erro ao contabilizar abandono:', e);
    }
}
window.recordCheckoutAbandon = recordCheckoutAbandon;

let abandonTrackingInitialized = false;
// Auto-tracking em tempo real nos campos do checkout
function initCheckoutAbandonAutoTracking() {
    if (abandonTrackingInitialized) return;
    abandonTrackingInitialized = true;

    const fields = [
        'payer-name', 'payer-email', 'payer-phone', 'payer-cpf',
        'card-holder', 'card-email', 'card-phone', 'card-cpf'
    ];

    let phoneTimer = null;
    let emailTimer = null;
    let cpfTimer = null;
    let nameTimer = null;

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        // Captura ao sair do campo (blur) e também em Autofill de celular (change)
        const onFieldCommit = () => {
            captureAbandonedLead({
                type: 'checkout_blur',
                reason: 'Preencheu campo no checkout'
            });
        };
        el.addEventListener('blur', onFieldCommit);
        el.addEventListener('change', onFieldCommit);

        // Captura em tempo real no WhatsApp enquanto digita (>= 8 dígitos, debounce 900ms)
        if (id.includes('phone')) {
            el.addEventListener('input', () => {
                clearTimeout(phoneTimer);
                const numbers = el.value.replace(/\D/g, '');
                if (numbers.length >= 8) {
                    phoneTimer = setTimeout(() => {
                        captureAbandonedLead({
                            type: 'checkout_typing',
                            reason: 'Digitou WhatsApp no formulário'
                        });
                    }, 900);
                }
            });
        }

        // Captura em tempo real no Email
        if (id.includes('email')) {
            el.addEventListener('input', () => {
                clearTimeout(emailTimer);
                if (el.value.includes('@') && el.value.includes('.')) {
                    emailTimer = setTimeout(() => {
                        captureAbandonedLead({
                            type: 'checkout_typing',
                            reason: 'Digitou e-mail no formulário'
                        });
                    }, 1100);
                }
            });
        }

        // Captura em tempo real no CPF completo (11 dígitos)
        if (id.includes('cpf')) {
            el.addEventListener('input', () => {
                clearTimeout(cpfTimer);
                const digits = el.value.replace(/\D/g, '');
                if (digits.length === 11) {
                    cpfTimer = setTimeout(() => {
                        captureAbandonedLead({
                            type: 'checkout_typing',
                            reason: 'Digitou CPF no formulário'
                        });
                    }, 900);
                }
            });
        }

        // Atualiza o nome se o cliente preencher ou corrigir depois do telefone/CPF
        if (id.includes('name') || id.includes('holder')) {
            el.addEventListener('input', () => {
                clearTimeout(nameTimer);
                if (el.value.trim().length >= 3) {
                    nameTimer = setTimeout(() => {
                        captureAbandonedLead({
                            type: 'checkout_typing',
                            reason: 'Preencheu nome no formulário'
                        });
                    }, 1200);
                }
            });
        }
    });

    // Mobile: detecta quando minimiza o navegador, troca para outro app ou desliga a tela do celular
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            recordCheckoutAbandon('Minimizou navegador ou desligou tela do celular', true);
        }
    });

    // Mobile/iOS: detecta fechamento da aba / saída de página
    window.addEventListener('pagehide', () => {
        recordCheckoutAbandon('Fechou aba/navegador no celular', true);
    });
}


// Event Listeners with Order Bump Interception
document.getElementById('btn-pay-pix')?.addEventListener('click', startPixPayment);
document.getElementById('btn-pay-boleto')?.addEventListener('click', startBoletoPayment);
document.getElementById('btn-pay-card')?.addEventListener('click', startCardPayment);
document.getElementById('btn-pay-card-direct')?.addEventListener('click', processCardPayment);

document.querySelectorAll('.method-btn').forEach(b => b.addEventListener('click', () => switchMethod(b.dataset.method)));

document.querySelector('.close-modal')?.addEventListener('click', async () => {
    // TRACK ABANDON
    if (sessionStorage.getItem('mura_modal_open') === 'true') {
        recordCheckoutAbandon('Fechou o modal de checkout', false);
        sessionStorage.removeItem('mura_modal_open');
        sessionStorage.removeItem('checkout_started');
    }

    if (checkoutModal) checkoutModal.classList.remove('active');
    document.documentElement.style.overflow = '';

    // RESET BUTTONS STATE (Critical Fix)
    const btnPix = document.getElementById('btn-pay-pix');
    if (btnPix) {
        btnPix.disabled = false;
        btnPix.innerText = 'GERAR PIX AGORA';
    }
    const btnCard = document.getElementById('btn-pay-card');
    if (btnCard) {
        btnCard.disabled = false;
        btnCard.innerText = 'PAGAR COM CARTÃO';
    }
    const btnBoleto = document.getElementById('btn-pay-boleto');
    if (btnBoleto) {
        btnBoleto.disabled = false;
        btnBoleto.innerText = 'GERAR BOLETO';
    }

    // Reset State logic for next open
    setTimeout(() => {
        document.getElementById('checkout-main-view')?.classList.remove('hidden');
        document.getElementById('pix-result')?.classList.add('hidden');
        const boletoResult = document.getElementById('boleto-result');
        if (boletoResult) boletoResult.classList.add('hidden');
        const boletoImg = document.getElementById('boleto-display-img');
        if (boletoImg) revokeBoletoIllustrationObjectUrl(boletoImg);
        const pixNotice = document.getElementById('pix-return-notice');
        if (pixNotice) pixNotice.style.display = 'none';
        const cardNotice = document.getElementById('card-return-notice');
        if (cardNotice) cardNotice.style.display = 'none';
        if (window.activePixPoll) {
            clearInterval(window.activePixPoll);
            window.activePixPoll = null;
        }
    }, 300);
});

// Captura se fechar a aba/janela no desktop/Android
window.addEventListener('beforeunload', () => {
    recordCheckoutAbandon('Fechou a janela do checkout', true);
});

// --- 4. MASKS ---
const masks = {
    cpf: v => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
    phone: v => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'),
    card: v => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})/g, '$1 ').trim(),
    date: v => v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d{2})/, '$1/$2'),
    cvv: v => v.replace(/\D/g, '').slice(0, 4),
    cep: v => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{3})/, '$1-$2')
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
        'payer-phone': 'phone',
        'card-cpf': 'cpf',
        'card-phone': 'phone',
        'card-number': 'card',
        'card-expiration': 'date',
        'card-cvv': 'cvv',
        'card-cep': 'cep'
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
// function validateField was moved and consolidated below.

function showPixResult(data, items) {
    // Scrolla para o topo para garantir que o cliente veja o QRCode
    setTimeout(() => { 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
        const cp = document.getElementById('checkout-page');
        if (cp) cp.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);

    const qrImg = document.getElementById('qr-code-img');
    const qrLoader = document.getElementById('qr-loader');
    const receiverInfo = document.getElementById('pix-receiver-info');
    const copyBtn = document.getElementById('btn-copy-pix');
    
    const nameInput = document.getElementById('payer-name');
    if (nameInput && nameInput.value) {
        const firstName = nameInput.value.trim().split(' ')[0];
        const greetingEl = document.getElementById('pix-greeting');
        if (greetingEl && firstName.length > 1) {
            const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
            greetingEl.innerText = `Quase lá, ${formattedName}!`;
        }
    }

    qrImg.src = `data:image/png;base64,${data.qr_code_base64}`;
    qrImg.classList.remove('hidden');
    qrImg.style.display = 'block';
    qrImg.style.opacity = '1';
    
    document.getElementById('pix-copy-paste').value = data.qr_code;

    // Fallback: Exibir UI imediatamente (evita ficar preso no "Conectando" se a imagem falhar)
    qrLoader.classList.add('hidden');
    qrImg.style.opacity = '1';
    if (receiverInfo) receiverInfo.classList.remove('hidden');
    if (copyBtn) copyBtn.style.display = 'block';
    const pixNotice = document.getElementById('pix-return-notice');
    if (pixNotice) pixNotice.style.display = 'block';

    qrImg.onload = () => {
        // Imagem carregou com sucesso
        qrImg.style.display = 'block';
    };

    if (copyBtn) {
        // Tenta copiar automaticamente
        try {
            navigator.clipboard.writeText(data.qr_code).then(() => {
                // Feedback Discreto (Toast)
                const container = document.getElementById('toast-container');
                if (container) {
                    const toast = document.createElement('div');
                    toast.className = 'toast-card';
                    toast.style.cssText = 'background: #ffffff !important; color: #0f172a !important; border-radius: 16px !important; padding: 14px 20px !important; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.1) !important; border: 1px solid rgba(0,0,0,0.08) !important; display: flex !important; align-items: center !important; gap: 14px !important; pointer-events: auto !important; z-index: 999999 !important;';
                    toast.innerHTML = `
                        <div style="width: 38px; height: 38px; min-width: 38px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1rem; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">
                            <i class="fa-solid fa-check"></i>
                        </div>
                        <div class="toast-content" style="text-align: left;">
                            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a; line-height: 1.2;">Código PIX Copiado!</h4>
                            <p style="margin: 3px 0 0 0; font-size: 0.82rem; font-weight: 600; color: #475569; line-height: 1.3;">Cole no app do seu banco para pagar.</p>
                        </div>
                    `;
                    container.appendChild(toast);
                    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
                }
            }).catch(() => {
                // Silently ignore or log internally
            });
        } catch (err) { console.warn(err); }


        copyBtn.onclick = () => {
            navigator.clipboard.writeText(data.qr_code);
            // Feedback no botão
            const origHtml = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> CÓDIGO PIX COPIADO!';
            copyBtn.style.background = '#10b981';
            setTimeout(() => {
                copyBtn.innerHTML = origHtml;
                copyBtn.style.background = '';
            }, 3000);

            // Feedback Discreto (Toast com fundo branco)
            const container = document.getElementById('toast-container');
            if (container) {
                const toast = document.createElement('div');
                toast.className = 'toast-card';
                toast.style.cssText = 'background: #ffffff !important; color: #0f172a !important; border-radius: 16px !important; padding: 14px 20px !important; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.1) !important; border: 1px solid rgba(0,0,0,0.08) !important; display: flex !important; align-items: center !important; gap: 14px !important; pointer-events: auto !important; z-index: 999999 !important;';
                toast.innerHTML = `
                    <div style="width: 38px; height: 38px; min-width: 38px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1rem; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <div class="toast-content" style="text-align: left;">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a; line-height: 1.2;">Código PIX Copiado!</h4>
                        <p style="margin: 3px 0 0 0; font-size: 0.82rem; font-weight: 600; color: #475569; line-height: 1.3;">Cole no app do seu banco para pagar.</p>
                    </div>
                `;
                container.appendChild(toast);
                setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
            }
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
                sessionStorage.setItem('mura_checkout_paid', 'true');
                sessionStorage.removeItem('mura_modal_open');

                // 🔴 FIX: Marca o abandono como PAGO para não poluir o painel
                try {
                    fetch(`${API_URL}/api/abandon/convert`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pixId: data.id })
                    });
                } catch(e) { /* Silencioso — não bloqueia o redirect */ }

                // Salva dados no sessionStorage para a página de obrigado
                const cust = getCurrentCustomerData();
                sessionStorage.setItem('obrigado_name', cust.name || '');
                sessionStorage.setItem('obrigado_email', cust.email || '');
                sessionStorage.setItem('obrigado_cpf', cust.cpf || '');
                sessionStorage.setItem('obrigado_senha', sd.senha || '');
                sessionStorage.setItem('obrigado_method', 'pix');
                sessionStorage.setItem('obrigado_items', items.map(i => i.id || i.title).join(','));
                sessionStorage.setItem('obrigado_total', items.reduce((acc, i) => acc + Number(i.price), 0).toFixed(2));
                sessionStorage.setItem('obrigado_evid', currentFacebookEventId);

                setTimeout(() => {
                    window.location.href = 'obrigado.html';
                }, 1500);
            } else {
                // If not approved yet, schedule next poll
                attempts++;
                // FIRST 10 SECONDS: poll every 500ms (ULTRA-FAST PERF)
                // Next 20 seconds: poll every 1 second (FAST)
                // After that: poll every 3 seconds (NORMAL)
                let delay = 3000;
                if (attempts < 20) delay = 500; // 0-10s
                else if (attempts < 40) delay = 1000; // 10-30s

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

function normalizeBoletoDigitableLine(data) {
    if (!data || data.barcode == null) return '';
    const b = data.barcode;
    if (typeof b === 'object' && b.content != null) return String(b.content).trim();
    return String(b).trim();
}

async function fetchBoletoIllustrationBlob() {
    const api = `${API_URL.replace(/\/$/, '')}/api/checkout/boleto/safe-preview`;
    try {
        const res = await fetch(api, { cache: 'no-store' });
        if (res.ok) return await res.blob();
    } catch (e) {
        console.warn('[BOLETO] API ilustrativa indisponível, usando fallback local.');
    }
    const fallback = `assets/boleto-ilustrativo.png?t=${Date.now()}`;
    const res2 = await fetch(fallback, { cache: 'no-store' });
    if (!res2.ok) throw new Error('boleto_illustration');
    return res2.blob();
}

function revokeBoletoIllustrationObjectUrl(imgEl) {
    if (imgEl && imgEl._boletoBlobUrl) {
        try {
            URL.revokeObjectURL(imgEl._boletoBlobUrl);
        } catch (e) { /* ignore */ }
        imgEl._boletoBlobUrl = null;
    }
}

function copyPlainTextToClipboard(text) {
    const value = String(text || '');
    if (!value) return Promise.resolve(false);

    const tryLegacy = () => {
        try {
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '0';
            ta.style.left = '0';
            ta.style.width = '2px';
            ta.style.height = '2px';
            ta.style.padding = '0';
            ta.style.border = 'none';
            ta.style.outline = 'none';
            ta.style.boxShadow = 'none';
            ta.style.background = 'transparent';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            ta.setSelectionRange(0, value.length);
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) {
            return false;
        }
    };

    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(value).then(() => true).catch(() => tryLegacy());
    }
    return Promise.resolve(tryLegacy());
}

function showBoletoResult(data) {
    setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const cp = document.getElementById('checkout-page');
        if (cp) cp.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);

    const barcodeEl = document.getElementById('boleto-barcode-display');
    const copyBtn = document.getElementById('btn-copy-boleto');
    const downloadBtn = document.getElementById('btn-download-boleto');
    const imgLoading = document.getElementById('boleto-img-loading');
    const imgWrap = document.getElementById('boleto-img-wrap');
    const displayImg = document.getElementById('boleto-display-img');

    const line = normalizeBoletoDigitableLine(data);
    const badLine = !line || line === 'Código de barras não disponível';
    const pdfUrl = (data.external_resource_url != null && String(data.external_resource_url).trim())
        ? String(data.external_resource_url).trim()
        : '';

    if (displayImg && imgWrap) {
        revokeBoletoIllustrationObjectUrl(displayImg);
        displayImg.removeAttribute('src');
        displayImg.onload = () => {
            if (imgLoading) imgLoading.classList.add('hidden');
            imgWrap.classList.remove('hidden');
        };
        displayImg.onerror = () => {
            if (imgLoading) imgLoading.classList.add('hidden');
            imgWrap.classList.add('hidden');
        };
        fetchBoletoIllustrationBlob()
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                displayImg._boletoBlobUrl = url;
                displayImg.src = url;
                displayImg.alt = 'Ilustração de boleto com dados genéricos (000 / XXXX)';
            })
            .catch(() => {
                if (imgLoading) imgLoading.classList.add('hidden');
                imgWrap.classList.add('hidden');
            });
    } else if (imgLoading) {
        imgLoading.classList.add('hidden');
    }

    if (barcodeEl) {
        if (!badLine) {
            barcodeEl.innerText = line;
        } else if (pdfUrl) {
            barcodeEl.innerText = 'Use o botão Baixar boleto ou o e-mail do Mercado Pago. A linha digitável pode vir no PDF.';
        } else {
            barcodeEl.innerText = 'Consulte o boleto no e-mail enviado pelo Mercado Pago.';
        }
    }

    if (copyBtn) {
        // Usuário solicitou remover a opção de cópia (deixar apenas download)
        copyBtn.style.display = 'none';
        if (!badLine) {
            copyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                copyPlainTextToClipboard(line).then((ok) => {
                    if (ok) {
                        showToast('Copiado!', 'Linha digitável pronta para colar no banco.', 'success');
                        
                        // Feedback visual no botão
                        const oldText = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> CÓDIGO COPIADO!';
                        copyBtn.style.background = '#27ae60';
                        
                        setTimeout(() => {
                            copyBtn.innerHTML = oldText;
                            copyBtn.style.background = '';
                        }, 4000);
                    } else {
                        showToast('Não foi possível copiar', 'Toque e segure no código acima para copiar manualmente.');
                    }
                });
            };
        } else {
            copyBtn.style.display = 'none';
        }
    }

    if (downloadBtn) {
        if (pdfUrl) {
            downloadBtn.style.display = 'block';
            downloadBtn.onclick = (e) => {
                e.preventDefault();
                window.open(pdfUrl, '_blank', 'noopener,noreferrer');
            };
        } else {
            downloadBtn.style.display = 'none';
        }
    }
}



// --- 5. FLOATING TOASTS LOGIC ---
const toastData = [
    { name: 'Ricardo S.', city: 'PR', text: 'Comprei e não me arrependo, conteúdo excelente!', avatar: 'carrosel/ricardo.webp' },
    { name: 'Ana Costa', city: 'GO', text: 'Meus pintinhos pararam de morrer.', avatar: 'carrosel/ana.webp' },
    { name: 'João O.', city: 'BA', text: 'O suporte foi muito atencioso.', avatar: 'carrosel/joao_new.webp' },
    { name: 'Carlos M.', city: 'MG', text: 'Material super completo, valeu a pena.', avatar: 'carrosel/carlos.webp' },
    { name: 'Fernanda L.', city: 'SP', text: 'Recuperei meu galo favorito com o guia!', avatar: 'carrosel/fernanda.webp' },
    { name: 'Roberto J.', city: 'RS', text: 'Entrega imediata, já estou estudando.', avatar: 'https://ui-avatars.com/api/?name=Roberto+J&background=random' },
    { name: 'Maria S.', city: 'SC', text: 'Muito bem explicado, parabéns.', avatar: 'carrosel/maria.webp' }
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

    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5500);
}

function showHelpBubble(input) {
    removeHelpBubbles();
    const msg = HELP_MESSAGES[input.id] || 'Preencha este campo para continuar.';

    const bubble = document.createElement('div');
    bubble.className = 'mura-help-bubble';
    bubble.innerText = msg;

    // Append to the input wrapper
    input.parentElement.appendChild(bubble);
}

function removeHelpBubbles() {
    document.querySelectorAll('.mura-help-bubble').forEach(b => b.remove());
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initHelpBubbles();

    // Hide help bubbles on scroll to prevent "floating" issue (passive for 60 FPS)
    window.addEventListener('scroll', removeHelpBubbles, { passive: true, capture: true });
    // Also scroll on modal container if it's the one scrolling
    const modalContent = document.querySelector('#checkout-modal .modal-content');
    if (modalContent) {
        modalContent.addEventListener('scroll', removeHelpBubbles, { passive: true });
    }

    // Global click to blur inputs (hide mobile keyboard)
    document.addEventListener('click', (e) => {
        if (typeof checkoutModal !== 'undefined' && checkoutModal.classList.contains('active')) {
            if (!e.target.closest('input') && !e.target.closest('select') && !e.target.closest('button') && !e.target.closest('.method-btn')) {
                if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                    document.activeElement.blur();
                }
            }
        }
    });
});


// --- OLD UPSELL LOGIC REMOVED ---

// --- HELPER: DETECT PAYMENT METHOD ---
// --- 5. VALIDATION HELPERS ---
function isValidCPF(cpf) {
    if (!cpf) return false;
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(clean)) return false;
    return true;
}

function validateField(el, type) {
    if (!el) return true;
    const val = el.value.trim();
    let isValid = true;

    if (type === 'email') isValid = val.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    else if (type === 'phone') isValid = val.replace(/\D/g, '').length >= 10;
    else if (type === 'cpf') isValid = isValidCPF(val);
    else if (type === 'card') isValid = val.replace(/\D/g, '').length >= 15;
    else if (type === 'date') isValid = /^\d{2}\/\d{2}$/.test(val);
    else if (type === 'cvv') isValid = val.length >= 3;
    else if (val.length < 3) isValid = false;

    if (!isValid && val.length > 0) {
        setInputError(el);
    } else if (isValid && val.length > 0) {
        setInputSuccess(el);
    } else {
        el.classList.remove('input-error', 'is-invalid', 'input-success', 'is-valid');
    }

    return isValid;
}

function setInputError(el) {
    el.classList.add('input-error', 'is-invalid');
    el.classList.remove('input-success', 'is-valid');
}

function setInputSuccess(el) {
    el.classList.remove('input-error', 'is-invalid');
    el.classList.add('input-success', 'is-valid');
}

function getPaymentMethodId(number) {
    if (!number) return null;
    const n = number.replace(/\D/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'master';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^(4011|4389|4514|4576|5041|5066|5090|6277|6362|6363)/.test(n)) return 'elo';
    if (/^(38|60)/.test(n)) return 'hipercard';
    return 'other';
}

// --- 11. INITIALIZATION HELPERS ---
function initComparisonSlider() {
    const comparisonSlider = document.getElementById('comparison-slider-track');
    const prevButton = document.getElementById('comparison-prev');
    const nextButton = document.getElementById('comparison-next');

    if (comparisonSlider && prevButton && nextButton) {
        const updateArrows = () => {
            const scrollLeft = comparisonSlider.scrollLeft;
            const maxScroll = comparisonSlider.scrollWidth - comparisonSlider.clientWidth;
            prevButton.disabled = scrollLeft <= 0;
            prevButton.style.opacity = scrollLeft <= 0 ? '0.3' : '1';
            nextButton.disabled = scrollLeft >= maxScroll - 1;
            nextButton.style.opacity = scrollLeft >= maxScroll - 1 ? '0.3' : '1';
        };
        updateArrows();
        comparisonSlider.addEventListener('scroll', updateArrows, { passive: true });
        prevButton.addEventListener('click', () => comparisonSlider.scrollBy({ left: -300, behavior: 'smooth' }));
        nextButton.addEventListener('click', () => comparisonSlider.scrollBy({ left: 300, behavior: 'smooth' }));
    }
}

function initHelpBubbles() {
    // Placeholder if logic needs to scale
}

// Global Listener for Input Effects
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.form-input').forEach(input => {
        let idleTimer;
        
        input.addEventListener('focus', () => {
            if (!input.value) {
                idleTimer = setTimeout(() => {
                    const tooltip = input.parentNode.querySelector('.field-tooltip');
                    if (tooltip && !input.value) tooltip.classList.add('active');
                }, 2000);
            }
        });

        input.addEventListener('input', () => {
            clearTimeout(idleTimer);
            const tooltip = input.parentNode.querySelector('.field-tooltip');
            if (tooltip) tooltip.classList.remove('active');

            if (input.classList.contains('input-error') || input.classList.contains('is-invalid')) {
                input.classList.remove('input-error', 'is-invalid');
            }
            
            const type = input.id.includes('email') ? 'email' :
                         (input.id.includes('phone') ? 'phone' :
                         (input.id.includes('cpf') ? 'cpf' :
                         (input.id.includes('number') ? 'card' :
                         (input.id.includes('expiration') ? 'date' :
                         (input.id.includes('cvv') ? 'cvv' : 'text')))));

            if (input.value.trim().length > 0) {
                if (validateField(input, type)) setInputSuccess(input);
                else input.classList.remove('input-success', 'is-valid');
            } else {
                input.classList.remove('input-success', 'input-error', 'is-invalid', 'is-valid');
            }
        });

        input.addEventListener('blur', () => {
            clearTimeout(idleTimer);
            const tooltip = input.parentNode.querySelector('.field-tooltip');
            if (tooltip) tooltip.classList.remove('active');

            const type = input.id.includes('email') ? 'email' :
                         (input.id.includes('phone') ? 'phone' :
                         (input.id.includes('cpf') ? 'cpf' :
                         (input.id.includes('number') ? 'card' :
                         (input.id.includes('expiration') ? 'date' :
                         (input.id.includes('cvv') ? 'cvv' : 'text')))));
            validateField(input, type);
        });
    });

    const cardCpf = document.getElementById('card-cpf');
    if (cardCpf) {
        cardCpf.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 9) e.target.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            else if (v.length > 6) e.target.value = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            else if (v.length > 3) e.target.value = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            else e.target.value = v;
        });
    }
});

// ─── LEAD CAPTURE VERIFICADO ─────────────────────
// Dispara evento 'Lead' apenas quando E-mail E Telefone válidos são preenchidos
(function initLeadCapture() {
    const INPUT_IDS = ['payer-email', 'customer-email', 'payer-phone', 'customer-phone', 'card-email', 'card-phone'];
    const FLAG_KEY  = 'mura_lead_captured';

    function isValidEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }
    
    function isValidPhone(v) {
        const d = v.replace(/\D/g, '');
        return d.length >= 10 && d.length <= 11;
    }

    function onFieldBlur() {
        if (sessionStorage.getItem(FLAG_KEY)) return;
        
        const email = (document.getElementById('payer-email')?.value || document.getElementById('customer-email')?.value || document.getElementById('card-email')?.value || '').trim();
        const phone = (document.getElementById('payer-phone')?.value || document.getElementById('customer-phone')?.value || document.getElementById('card-phone')?.value || '').trim();
        
        if (!email || !isValidEmail(email)) return;
        if (!phone || !isValidPhone(phone)) return;

        sessionStorage.setItem(FLAG_KEY, 'true');

        const leadEventId = generateEventID();

        // Pixel browser-side (deduplicado pelo eventId)
        trackPixel('Lead', {
            content_name: cart.mainProduct?.title || 'Protocolo Elite',
            value: cart.mainProduct?.price || 0,
            currency: 'BRL'
        }, leadEventId);

        trackCAPI('Lead', leadEventId, {
            value: cart.mainProduct?.price || 0,
            currency: 'BRL',
            contentIds: [cart.mainProduct?.id || 'ebook-doencas'],
            contentName: cart.mainProduct?.title || 'Protocolo Elite',
        });

        console.log('📧 [LEAD VERIFICADO] Capturado:', email.replace(/(.{2}).*(@.*)/, '$1***$2'));
    }

    document.addEventListener('focusout', function(e) {
        if (e.target && INPUT_IDS.includes(e.target.id)) {
            onFieldBlur();
        }
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
            window.scrollTo({ left: 0, behavior: 'instant' });
            const cp = document.getElementById('checkout-page');
            if (cp) cp.scrollLeft = 0;
        }
    });
})();

// ─── VIEWCONTENT AUTOMÁTICO (FILTRO 10s) ──────────────
// Dispara ViewContent após 10 segundos na página (Pixel + CAPI Server-Side)
(function initViewContentTracking() {
    const FLAG_KEY = 'mura_viewcontent_fired';
    if (sessionStorage.getItem(FLAG_KEY)) return;

    setTimeout(() => {
        if (sessionStorage.getItem(FLAG_KEY)) return;
        sessionStorage.setItem(FLAG_KEY, 'true');

        const viewEventId = generateEventID();
        const isPintinhos = (typeof PAGE_SOURCE !== 'undefined' && (PAGE_SOURCE === 'pintinhos' || PAGE_SOURCE.startsWith('pintinhos')));
        const mainId = isPintinhos ? 'ebook-pintinhos' : 'ebook-doencas';
        const title = isPintinhos ? 'Manual de Manejo de Pintinhos: 98% de Sobrevivência' : 'Protocolo de Elite - O Segredo das Doenças';
        const price = isPintinhos ? 27.90 : 89.90;

        trackPixel('ViewContent', {
            content_ids: [mainId],
            content_name: title,
            content_type: 'product',
            value: price,
            currency: 'BRL'
        }, viewEventId);

        trackCAPI('ViewContent', viewEventId, {
            value: price,
            currency: 'BRL',
            contentIds: [mainId],
            contentName: title,
        });

        console.log('👁️ [VIEWCONTENT] Disparado com sucesso após 10s (Pixel + CAPI Server-Side)!');
    }, 10000);
})();

