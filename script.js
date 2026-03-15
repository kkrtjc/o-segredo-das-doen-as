// --- 1. GLOBAL CONFIG & STATE ---
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
    ? 'http://localhost:10000'
    : 'https://teste-m1kq.onrender.com';

let cart = {
    mainProduct: null,
    bumps: [] // IDs of selected bumps
};

// GLOBAL PAYMENT STATE
let currentPaymentMethod = 'pix'; // Default

// --- PERFORMANCE: PRE-FETCHING ---
const prefetchedProducts = {};

// --- INIT: CHECK PENDING PIX (Recover Logic) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. UNIQUE VISITOR + SESSÃO TRACKING
    const today = new Date().toISOString().split('T')[0];
    const lastVisit = localStorage.getItem('mura_visita_hoje');

    trackEvent('session_start');

    if (lastVisit !== today) {
        trackEvent('unique_visit');
        localStorage.setItem('mura_visita_hoje', today);
    }

    // 2. CTA CLICK TRACKING
    document.querySelectorAll('a[href^="#offer"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const ctaId = btn.getAttribute('data-cta') || 'generic_cta';
            trackEvent('cta_click', null, ctaId);
        });
    });

    // 3. PIX RECOVERY
    const cached = localStorage.getItem('active_pix_session');
    if (cached) {
        try {
            const session = JSON.parse(cached);
            if ((Date.now() - session.timestamp) < 60 * 60 * 1000) {
                try {
                    const s = await fetch(`${API_URL}/api/payment/${session.data.id}`);
                    const sd = await s.json();
                    if (sd.status === 'approved') {
                        trackPixel('Purchase', {
                            value: session.total || 0,
                            currency: 'BRL',
                            content_name: 'Combo Elite / Produtos',
                            content_ids: session.itemIds ? session.itemIds.split(',') : []
                        });
                        localStorage.removeItem('active_pix_session');
                        window.location.href = `downloads.html?items=${session.itemIds}&total=${session.total.toFixed(2)}`;
                    } else {
                        localStorage.removeItem('active_pix_session');
                    }
                } catch (e) { /* Recover silently */ }
            } else {
                localStorage.removeItem('active_pix_session');
            }
        } catch (e) { localStorage.removeItem('active_pix_session'); }
    }

    // 4. PRE-FETCH
    const productsToPreload = ['ebook-doencas', 'combo-elite', 'ebook-manejo'];
    productsToPreload.forEach(async (id) => {
        try {
            const response = await fetch(`${API_URL}/api/products/${id}`);
            if (response.ok) {
                prefetchedProducts[id] = await response.json();
                
                if (id === 'ebook-doencas') {
                    const resp = prefetchedProducts[id];
                    const priceElement = document.getElementById('display-price-value');
                    if (priceElement && resp.price) {
                        priceElement.innerText = resp.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    }

                    trackPixel('ViewContent', {
                        content_ids: [id], content_name: resp.title, content_type: 'product',
                        value: resp.price, currency: 'BRL'
                    });
                }
            }
        } catch (e) { console.warn(`[PREFETCH] Failed: ${id}`); }
    });

    // 5. COMPONENTS INIT
    initFAQ();
    initSmoothScroll();
    initComparisonSlider();
    initStickyCTA();
    initLazyLoading();
    initImageTransitions();
    initHelpBubbles();
    setupFields();
    renderHomeProducts();

    // 6. LAZY VIDEO
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

    // 7. GLOBAL MOBILE FIXES
    initMobileFixes();
});

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
        window.addEventListener('scroll', () => {
            const triggerPoint = heroSection.offsetHeight - 200;
            if (window.scrollY > triggerPoint) stickyCta.classList.add('visible');
            else stickyCta.classList.remove('visible');
        });
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
        if (document.body.classList.contains('modal-open')) {
            const modal = document.querySelector('.modal-overlay');
            if (modal && !modal.contains(e.target)) {
                e.preventDefault();
            }
        }
    }, { passive: false });
}

// --- 2. CHECKOUT & API LOGIC ---

// mp is initialized in index.html to avoid duplicate declaration errors
const checkoutModal = document.getElementById('checkout-modal');

// --- TRACKING ENGINE ---
async function trackEvent(type, isMobileManual = null, ctaId = null, details = null) {
    const isMobile = isMobileManual !== null ? isMobileManual : (
        window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );

    const body = JSON.stringify({ type, isMobile, ctaId, details });

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const resp = await fetch(`${API_URL}/api/track`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body, signal: AbortSignal.timeout(5000)
            });
            if (resp.ok) return;
        } catch (e) {
            if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
        }
    }
}

function trackPixel(eventName, params = {}) {
    if (typeof fbq === 'function') {
        fbq('track', eventName, params);
    } else {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (typeof fbq === 'function') {
                fbq('track', eventName, params);
                clearInterval(interval);
            } else if (attempts >= 10) clearInterval(interval);
        }, 500);
    }
}

// Interceptador para Promoção de Elite (Pré-Checkout) - REMOVIDO PARA USAR MURA ENGINE DIRETO
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
    startCheckoutProcess('combo-elite');
}

function declineEliteCombo() {
    if (eliteTimerInterval) clearInterval(eliteTimerInterval);
    const promoModal = document.getElementById('elite-promo-modal');
    if (promoModal) promoModal.classList.remove('show');
    startCheckoutProcess('ebook-doencas');
}

async function startCheckoutProcess(productId, forceBumps = []) {
    if (!sessionStorage.getItem('mura_checkout_opened')) {
        trackEvent('checkout_open');
        sessionStorage.setItem('mura_checkout_opened', 'true');
    }
    
    trackEvent('click');
    sessionStorage.setItem('mura_modal_open', 'true');
    // InitiateCheckout will be fired in loadCheckoutData once we have the price and name


    if (!checkoutModal) return;

    // --- RESET CHECKOUT STATE ---
    document.getElementById('checkout-main-view').classList.remove('hidden');
    document.getElementById('pix-result').classList.add('hidden');

    if (window.activePixPoll) {
        clearInterval(window.activePixPoll);
        window.activePixPoll = null;
    }

    // RESET PIX BUTTON AND UPSELL STATE
    const btnPix = document.getElementById('btn-pay-pix');
    if (btnPix) {
        btnPix.innerText = 'Gerar PIX';
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
            title: 'Protocolo Elite: A Cura das Aves',
            price: 109.90,
            originalPrice: 149.90,
            cover: 'capadasdoencas.jpg',
            fullBumps: [
                { id: 'ebook-manejo', title: 'Manual de Pintinhos', price: 49.90, priceCard: 49.90, image: 'capadospintinhos.jpg', description: 'Crie pintinhos fortes e saudáveis.' },
                { id: 'bump-6361', title: 'Tabela de Ração', price: 19.90, priceCard: 19.90, image: 'tabela_racao_bump.jpg', description: 'Alimentaçao correta em todas as fases da sua criaçao. Economize na raçao e acelere o crescimento das suas aves com o balanceamento ideal.', tag: 'OFERTA ÚNICA' }
            ]
        },
        'combo-elite': {
            title: 'Combo Elite (Doenças + Manual)',
            price: 147.00,
            originalPrice: 169.80,
            cover: 'combo',
            fullBumps: [
                { id: 'bump-6361', title: 'Tabela de Ração', price: 14.90, priceCard: 19.90, image: 'tabela_racao_bump.jpg', description: 'Alimentação correta em todas as fases da sua criação.', tag: 'OFERTA ÚNICA' }
            ]
        }
    };

    try {
        let productData = (typeof prefetchedProducts !== 'undefined') ? prefetchedProducts[productId] : null;

        if (!productData) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500);
                const response = await fetch(`${API_URL}/api/products/${productId}?t=${Date.now()}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error("API Error");
                productData = await response.json();
            } catch (fetchErr) {
                console.warn("[CHECKOUT] API Fetch failed, using fallback.", fetchErr);
                productData = fallbackData[productId] || fallbackData['ebook-doencas'];
                productData.id = productId;
            }
        }

        cart.mainProduct = { ...productData, id: productId };
        cart.bumps = forceBumps || [];

        // PIXEL: InitiateCheckout (Now with real data)
        trackPixel('InitiateCheckout', {
            content_ids: [productId],
            content_name: productData.title,
            content_type: 'product',
            value: productData.price,
            currency: 'BRL'
        });

        document.getElementById('checkout-product-name').innerText = productData.title;
        document.getElementById('checkout-product-price-display').innerText = formatBRL(productData.price);

        const iconContainer = document.getElementById('product-icon-container');
        if (iconContainer) {
            if (productData.cover === 'combo') {
                iconContainer.innerHTML = `
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <img src="capadospintinhos.jpg" alt="Manejo" style="width: 30px; height: 40px; object-fit: cover; border-radius: 4px;">
                        <img src="capadasdoencas.jpg" alt="Doenças" style="width: 30px; height: 40px; object-fit: cover; border-radius: 4px;">
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
            checkoutModal.classList.add('active');
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

    // Global check removed to support individual toggles
    // if (window.siteConfig && window.siteConfig.settings && window.siteConfig.settings.enableOrderBump === false) {
    //     area.innerHTML = '';
    // }

    // Filtra bumps que não devem aparecer
    let manualPresent = false;
    (bumps || []).forEach(b => {
        if (b.id === 'ebook-manejo' || b.title?.includes('Pintinhos')) manualPresent = true;
    });

    const filteredBumps = (bumps || []).filter(bump => {
        if (!bump.id) {
            if (bump.title?.includes('Pintinhos') || bump.title?.includes('Manejo')) bump.id = 'ebook-manejo';
            else if (bump.title?.includes('Ração')) bump.id = 'bump-6361';
        }
        
        // Se o Manual está presente, escondemos a Tabela individual para forçar o Combo
        if (manualPresent && bump.id === 'bump-6361') return false;

        if (bump.enabled === false) return false;
        return true;
    });

    // Configura o container para grid se houver mais de um bump
    area.style.display = 'block'; // Usar block para gerenciar o título em cima
    area.style.marginTop = '1.5rem';
    area.style.padding = '0.5rem';
    area.style.background = 'rgba(251, 191, 36, 0.05)';
    area.style.borderRadius = '12px';
    area.style.border = '1px solid rgba(251, 191, 36, 0.1)';

    const bumpHeader = `
        <div style="text-align: center; margin-bottom: 12px; padding: 0 5px;">
            <p style="color: #d97706; font-size: 0.75rem; font-weight: 900; line-height: 1.3; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
                ⚠️ OFERTAS EXCLUSIVAS PARA CLIENTES<br>
                <span style="color: #475569; font-weight: 500; font-size: 0.65rem;">VOCÊ NÃO ENCONTRARÁ ESSES VALORES EM OUTRO LUGAR.</span>
            </p>
        </div>
    `;

    const gridLayout = `
        <div style="display: grid; grid-template-columns: ${filteredBumps.length > 1 ? '1fr 1fr' : '1fr'}; gap: 8px;">
            ${filteredBumps.map(bump => {
                let imgSrc = bump.image;
                if (!imgSrc) {
                    if (bump.id === 'ebook-doencas' || bump.id === 'bump-doencas') imgSrc = 'capadasdoencas.jpg';
                    else if (bump.id === 'ebook-manejo' || bump.id === 'bump-manejo') imgSrc = 'capadospintinhos.jpg';
                    else if (bump.id === 'bump-6361') imgSrc = 'tabela_racao_bump.jpg';
                }

                return `
                    <div class="order-bump-container" onclick="toggleBump('${bump.id}')" 
                        style="position: relative; overflow: hidden; border: 2px solid #d97706; border-radius: 10px; cursor: pointer; transition: transform 0.2s; min-height: 110px; display: flex;">
                        
                        <!-- Imagem de Fundo -->
                        ${imgSrc ? `<img src="${imgSrc}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">` : ''}
                        
                        <!-- Overlay -->
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.85) 100%); z-index: 1;"></div>

                        <!-- Conteúdo -->
                        <div style="position: relative; z-index: 2; display: flex; flex-direction: column; justify-content: flex-end; padding: 8px; width: 100%;">
                            <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
                                <input type="checkbox" class="order-bump-checkbox" id="bump-chk-${bump.id}" ${cart.bumps.includes(bump.id) ? 'checked' : ''} 
                                    style="width: 18px; height: 18px; cursor: pointer; accent-color: #fbbf24; flex-shrink: 0; margin-top: 2px;">
                                <span class="order-bump-tag" style="background: #ef4444; color: #fff; padding: 1px 4px; border-radius: 3px; font-size: 0.55rem; font-weight: 900; text-transform: uppercase;">PROMO</span>
                            </div>
                            <strong class="order-bump-title" style="display: block; color: #fff; font-size: 0.8rem; text-shadow: 0 1px 2px rgba(0,0,0,0.8); line-height: 1.1; margin-bottom: 2px;">
                                ${bump.id === 'ebook-manejo' ? 'COMBO: MANUAL DE PINTINHOS + TABELA 🎁' : bump.title}
                            </strong>
                            <p style="color: rgba(255,255,255,0.85); font-size: 0.65rem; line-height: 1.2; margin: 2px 0 4px 0; text-shadow: 0 1px 1px rgba(0,0,0,0.5); font-weight: 700;">
                                ${bump.id === 'ebook-manejo' ? '🐣 <span style="color: #fca5a5;"><strong>90% das mortes</strong></span> em pintinhos é por manejo errado. <span style="color: #4ade80;"><strong>Garanta 95% de sobrevivência</strong></span> com o manejo correto. E leve <span style="color: #fbbf24;"><strong>DE GRAÇA</strong></span> nosso conteúdo (R$ 19,90) para economizar <span style="color: #fbbf24;"><strong>até 70%</strong></span> na alimentação.' : '🌾 Economize até 70% na alimentação produzindo sua própria ração.'}
                            </p>
                            <span class="order-bump-price" style="color: #fbbf24; font-weight: 900; font-size: 0.95rem; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">+ ${formatBRL(currentPaymentMethod === 'pix' ? bump.price : (bump.priceCard || bump.price))}</span>
                        </div>
                    </div>`;
            }).join('')}
        </div>
    `;

    area.innerHTML = bumpHeader + gridLayout;
}

function toggleBump(bumpId) {
    const idx = cart.bumps.indexOf(bumpId);
    if (idx > -1) {
        cart.bumps.splice(idx, 1);
        // Se remover o manual, remove a tabela automática do combo
        if (bumpId === 'ebook-manejo') {
            const tableIdx = cart.bumps.indexOf('bump-6361');
            if (tableIdx > -1) cart.bumps.splice(tableIdx, 1);
        }
    } else {
        cart.bumps.push(bumpId);
        // Se adicionar o manual, adiciona a tabela automática como parte do combo
        if (bumpId === 'ebook-manejo') {
            if (!cart.bumps.includes('bump-6361')) cart.bumps.push('bump-6361');
        }
    }

    const chk = document.getElementById(`bump-chk-${bumpId}`);
    if (chk) chk.checked = cart.bumps.includes(bumpId);
    updateTotal();
}

function updateTotal() {
    let basePrice = cart.mainProduct.price; // Preço PIX do produto principal
    let cardPrice = cart.mainProduct.originalPrice || cart.mainProduct.price; // Preço Cartão

    let total = basePrice;
    let cardTotal = cardPrice;

    // Adiciona Bumps com preços Dinâmicos do banco de dados
    cart.bumps.forEach(id => {
        // Busca o bump no array fullBumps do produto
        let bump = cart.mainProduct.fullBumps?.find(b => b.id === id);

        // FALLBACK: Se não encontrou em fullBumps, busca na config global (se carregada) ou prefetched
        if (!bump && id.startsWith('ebook-')) {
            const configData = (window.siteConfig && window.siteConfig.products) ? window.siteConfig.products[id] : prefetchedProducts[id];

            if (configData) {
                bump = {
                    id: id,
                    price: configData.price, // Preço PIX do banco
                    priceCard: configData.originalPrice || configData.price // Preço Cartão do banco (ou fallback)
                };
            } else {
                // Fallback de emergência (caso config não tenha carregado) - EVITAR SE POSSÍVEL
                bump = { id: id, price: id === 'ebook-manejo' ? 49.9 : 59.9, priceCard: id === 'ebook-manejo' ? 49.9 : 99.0 };
            }
        }

        if (bump) {
            // Regra Especial de Combo: Se o Manual estiver no carrinho, a Tabela é grátis (R$ 0)
            let isFreeGift = (id === 'bump-6361' && cart.bumps.includes('ebook-manejo'));
            
            const bumpPriceForPix = isFreeGift ? 0 : (bump.price || 0);
            const bumpPriceForCard = isFreeGift ? 0 : (bump.priceCard || bump.price || 0);

            console.log(`💰 Preços do bump (${id}):`, { pix: bumpPriceForPix, card: bumpPriceForCard, isFree: isFreeGift });

            total += bumpPriceForPix;
            cardTotal += bumpPriceForCard;
        } else {
            console.error('❌ Bump não encontrado em fullBumps:', id);
        }
    });

    document.querySelectorAll('.pix-discount-badge').forEach(b => b.remove());

    const finalDisplayPrice = currentPaymentMethod === 'pix' ? total : cardTotal;

    // Adiciona badge de desconto se PIX estiver selecionado e houver desconto
    if (currentPaymentMethod === 'pix' && cardTotal > total) {
        document.querySelectorAll('.checkout-total-display').forEach(el => {
            if (el.parentElement) {
                const discountBadge = document.createElement('span');
                discountBadge.className = 'pix-discount-badge';
                discountBadge.style.cssText = 'display: inline-block; margin-left: 8px; font-size: 0.6rem; color: #10b981; font-weight: 900; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 20px; text-transform: uppercase; vertical-align: middle;';
                discountBadge.innerHTML = `🔥 27% DE DESCONTO NO PIX`;
                el.parentElement.appendChild(discountBadge);
            }
        });
    }

    document.querySelectorAll('.checkout-total-display').forEach(el => {
        el.innerText = formatBRL(finalDisplayPrice);
    });

    const topPriceDisplay = document.getElementById('checkout-product-price-display');
    if (topPriceDisplay) {
        topPriceDisplay.innerText = formatBRL(finalDisplayPrice);
    }

    updateInstallments(finalDisplayPrice);
}

function updateInstallments(total) {
    const selector = document.getElementById('installments-select');
    if (!selector) return;

    selector.innerHTML = '';

    // De 1x até 4x (Regra: Até 4x de 34,97 sem juros baseados no 139,90)
    for (let i = 1; i <= 4; i++) {
        const val = total / i;
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `${i}x de ${formatBRL(val)} ${i > 1 ? 'sem juros' : '(À vista)'}`;
        opt.style.background = "#151515";
        opt.style.color = "#fff";
        selector.appendChild(opt);
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

        // PIXEL: ViewContent
        trackPixel('ViewContent', {
            content_ids: [mainId],
            content_name: p.title,
            content_type: 'product',
            value: p.price,
            currency: 'BRL'
        });

        const card = document.createElement('div');
        card.className = `price-card featured`;
        card.id = 'offer-focus';

        const featuresHTML = (p.features || []).map(f => `<li><span class="check-icon">✓</span> ${f}</li>`).join('');

        const coverHTML = `<img src="${p.cover}" alt="${p.title}" style="max-width: 140px; margin: 10px auto; display: block; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));">`;
        const isDiscounted = p.originalPrice && (p.originalPrice > p.price);

        // Calculando variáveis dinâmicas
        const discountPercent = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
        const installmentPrice = (p.originalPrice / 4).toFixed(2).replace('.', ',');
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
                    <span style="font-size: 0.9rem; color: var(--color-text-light); margin-top: 5px;">ou até 4x de <strong>R$ ${installmentPrice}</strong> s/ juros</span>
                </div>
            </div>

            <ul class="price-features" style="margin-top: 1rem;">
                ${featuresHTML}
                <li style="color: #32bcad; font-weight: 800;"><span class="check-icon">✓</span> + TABELA DE RAÇÃO (OFERTA ÚNICA)</li>
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


// --- 3. PAYMENT HANDLING ---

// --- GLOBALS ---
function closeCheckout() {
    const checkoutModal = document.getElementById('checkout-modal');
    if (checkoutModal) checkoutModal.classList.remove('active');
    document.body.style.overflow = '';
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
        btnPix.innerText = 'Gerar PIX';
        btnPix.disabled = false;
        btnPix.style.opacity = '1';
    }
    midCheckoutUpsellPending = true;
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

    if (method === 'pix') {
        if (pixArea) { pixArea.style.display = 'block'; }
        if (cardArea) { cardArea.style.display = 'none'; }
        if (btnPix) btnPix.style.display = 'block';
        if (btnCard) btnCard.style.display = 'none';

    } else if (method === 'card') {
        if (pixArea) { pixArea.style.display = 'none'; }
        if (cardArea) { cardArea.style.display = 'block'; }
        if (btnPix) btnPix.style.display = 'none';
        if (btnCard) btnCard.style.display = 'block';
    }

    // RECALCULATE TOTAL WHEN SWITCHING
    if (cart.mainProduct) {
        renderOrderBumps(cart.mainProduct.fullBumps);
        updateTotal();
    }
}



async function handlePayment(method) {
    // UPSELL REMOVIDO: Fluxo direto para pagamento
    let customer = {};

    // FIX: Define commonData here to avoid undefined error
    const commonData = {
        email: document.getElementById('payer-email').value,
        phone: document.getElementById('payer-phone').value ? document.getElementById('payer-phone').value.replace(/\D/g, '') : ''
    };

    if (method === 'pix') {
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
            cpf: (document.getElementById('payer-cpf')?.value || '').replace(/\D/g, ''),
            cep: (document.getElementById('card-cep')?.value || '').replace(/\D/g, '')
        };
    }

    const isValid = validateCheckoutInputs(method);
    if (!isValid) return;

    // PRICING LOGIC FOR API PAYLOAD
    let mainPrice = cart.mainProduct.price;
    if (method === 'card' && cart.mainProduct.originalPrice) {
        mainPrice = cart.mainProduct.originalPrice;
    }

    const items = [{ id: cart.mainProduct.id, title: cart.mainProduct.title, price: mainPrice }];

    // Adiciona bumps com preços corretos
    cart.bumps.forEach(id => {
        let b = cart.mainProduct.fullBumps?.find(x => x.id === id);
        
        // CORREÇÃO: Fallback idêntico ao updateTotal para garantir soma correta no PIX
        if (!b && id.startsWith('ebook-')) {
            const prod = window.siteConfig?.products?.[id] || prefetchedProducts[id];
            if (prod) {
                b = {
                    id: id,
                    title: prod.title,
                    price: prod.price,
                    priceCard: prod.originalPrice || prod.price
                };
            } else {
                // Fallback de emergência (mesmo do updateTotal)
                const fallbackPrice = id === 'ebook-manejo' ? 49.9 : 59.9;
                b = { 
                    id: id, 
                    title: id === 'ebook-manejo' ? 'Manual de Pintinhos' : 'Ebook Adicional',
                    price: fallbackPrice, 
                    priceCard: id === 'ebook-manejo' ? 49.9 : 99.0 
                };
            }
        }

        if (b) {
            // Regra Especial de Combo: Se o Manual estiver no carrinho, a Tabela é grátis (R$ 0)
            let isFreeGift = (id === 'bump-6361' && cart.bumps.includes('ebook-manejo'));
            
            let bumpPrice = isFreeGift ? 0 : ((method === 'card' && b.priceCard) ? b.priceCard : b.price);
            items.push({ id: b.id, title: b.title, price: bumpPrice });
        }
    });

    console.log(`📦 [CHECKOUT] Payload Items (${method}):`, items);

    if (method === 'pix') {
        const btn = document.getElementById('btn-pay-pix');
        const originalText = (btn) ? btn.innerText : 'Gerar PIX';

        // --- INSTANT UI FEEDBACK ---
        document.getElementById('checkout-main-view').classList.add('hidden');
        const pixResult = document.getElementById('pix-result');
        pixResult.classList.remove('hidden');
        
        // Show loader and hide content until ready
        document.getElementById('qr-loader').classList.remove('hidden');
        document.getElementById('qr-code-img').style.opacity = '0';
        document.getElementById('pix-receiver-info').classList.add('hidden');
        document.getElementById('btn-copy-pix').style.display = 'none';

        const totalAmount = items.reduce((acc, item) => acc + Number(item.price), 0);
        const itemIds = items.map(i => i.id).sort().join(',');

        try {
            if (!cart.mainProduct) {
                console.error("Cart Error: No main product selected");
                alert("Houve um erro: produto não selecionado. Por favor, reinicie a compra.");
                document.getElementById('checkout-main-view').classList.remove('hidden');
                pixResult.classList.add('hidden');
                return;
            }

            const res = await fetch(`${API_URL}/api/checkout/pix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, customer }),
                signal: AbortSignal.timeout(20000) 
            });

            const data = await res.json();

            if (data.qr_code) {
                localStorage.setItem('active_pix_session', JSON.stringify({
                    data: data,
                    total: totalAmount,
                    itemIds: itemIds,
                    timestamp: Date.now()
                }));

                captureAbandonedLead({ pixGenerated: true, pixId: data.id });
                showPixResult(data, items);

            } else {
                console.error("Pix Error Response:", data);
                alert(data.error || data.message || 'Houve um erro ao gerar o PIX.');
                document.getElementById('checkout-main-view').classList.remove('hidden');
                pixResult.classList.add('hidden');
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            }
        } catch (e) {
            console.error("Pix Error:", e);
            alert('Não foi possível gerar o seu PIX agora.');
            document.getElementById('checkout-main-view').classList.remove('hidden');
            pixResult.classList.add('hidden');
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

            const payload = {
                items, customer, token: token.id,
                installments: document.getElementById('installments-select')?.value || '1',
                payment_method_id: getPaymentMethodId(cardNumber),
                issuer_id: null,
                deviceId: (typeof mp !== 'undefined' && mp.getDeviceId) ? mp.getDeviceId() : null
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
                const totalVal = document.querySelector('.checkout-total-display').innerText.replace(/[^\d,]/g, '').replace(',', '.');
                
                // PIXEL: Purchase (Card Approval)
                trackPixel('Purchase', {
                    value: Number(totalVal) || cart.total || 0,
                    currency: 'BRL',
                    content_name: cart.mainProduct ? cart.mainProduct.title : 'Checkout',
                    content_ids: items.map(i => i.id)
                });

                window.location.href = `downloads.html?items=${items.map(i => i.id).join(',')}&total=${totalVal}`;
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
            console.error("ERRO CRÃTICO CARTÃO:", e);
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

// --- 2. CARD PAYMENT (Simplified) ---
async function startCardPayment(event) {
    console.log('🔵 startCardPayment CALLED');
    if (event) event.preventDefault();

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


function showToast(title, message, type = 'error') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-card';
    if (type === 'success') toast.style.borderColor = '#2ecc71';
    
    toast.innerHTML = `
        <div style="width: 40px; height: 40px; background: ${type === 'success' ? '#2ecc71' : '#ef4444'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff;">
            <i class="fa-solid ${type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}"></i>
        </div>
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
}

function validateCheckoutInputs(method) {
    console.log('🔍 [VALIDATE] Inicando validação para:', method);
    
    const name = document.getElementById(method === 'pix' ? 'payer-name' : 'card-holder');
    const email = document.getElementById('payer-email');
    const phone = document.getElementById('payer-phone');
    const cpf = document.getElementById('payer-cpf');

    if (!validateField(name, 'text')) { 
        showToast('Nome incompleto', 'Por favor, informe seu nome completo para emissão da nota.'); 
        name.focus();
        return false; 
    }
    if (!validateField(email, 'email')) { 
        showToast('E-mail inválido', 'Precisamos de um e-mail válido para enviar seu acesso.'); 
        email.focus();
        return false; 
    }
    if (!validateField(phone, 'phone')) { 
        showToast('Telefone inválido', 'Informe um telefone com DDD para suporte via WhatsApp.'); 
        phone.focus();
        return false; 
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

async function captureAbandonedLead(extra = {}) {
    const name = document.getElementById('payer-name')?.value?.trim();
    const email = document.getElementById('payer-email')?.value?.trim();
    const phone = document.getElementById('payer-phone')?.value?.trim();
    const productId = (cart && cart.id) || (cart && cart.mainProduct && cart.mainProduct.id) || 'unknown';

    // Só captura se tiver pelo menos o telefone ou e-mail preenchido
    if ((phone && phone.length > 5) || (email && email.length > 5)) {
        console.log("🛒 [ABANDON] Capturando lead abandonado...", extra.pixGenerated ? '(PIX gerado)' : '(saída do modal)');
        try {
            await fetch(`${API_URL}/api/abandon`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    phone,
                    product: productId,
                    pixGenerated: extra.pixGenerated || false,
                    pixId: extra.pixId || null
                })
            });
        } catch (e) {
            console.warn("Falha ao registrar abandono", e);
        }
    }
}

// Event Listeners with Order Bump Interception
document.getElementById('btn-pay-pix')?.addEventListener('click', startPixPayment);
document.getElementById('btn-pay-card')?.addEventListener('click', startCardPayment);
document.getElementById('btn-pay-card-direct')?.addEventListener('click', processCardPayment);

document.querySelectorAll('.method-btn').forEach(b => b.addEventListener('click', () => switchMethod(b.dataset.method)));

document.querySelector('.close-modal')?.addEventListener('click', async () => {
    // TRACK ABANDON
    if (sessionStorage.getItem('mura_modal_open') === 'true') {
        trackEvent('checkout_abandon');
        await captureAbandonedLead(); // Captura os dados antes de fechar
        sessionStorage.removeItem('mura_modal_open');
        sessionStorage.removeItem('checkout_started');
    }

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

// Captura se fechar a aba/janela
window.addEventListener('beforeunload', () => {
    if (sessionStorage.getItem('mura_modal_open') === 'true') {
        captureAbandonedLead();
    }
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
    const qrImg = document.getElementById('qr-code-img');
    const qrLoader = document.getElementById('qr-loader');
    const receiverInfo = document.getElementById('pix-receiver-info');
    const copyBtn = document.getElementById('btn-copy-pix');

    qrImg.src = `data:image/png;base64,${data.qr_code_base64}`;
    document.getElementById('pix-copy-paste').value = data.qr_code;

    qrImg.onload = () => {
        qrLoader.classList.add('hidden');
        qrImg.style.opacity = '1';
        if (receiverInfo) receiverInfo.classList.remove('hidden');
        if (copyBtn) copyBtn.style.display = 'block';
    };

    if (copyBtn) {
        // Tenta copiar automaticamente
        try {
            navigator.clipboard.writeText(data.qr_code).then(() => {
                // Feedback Discreto (Toast)
                const container = document.getElementById('toast-container');
                const toast = document.createElement('div');
                toast.className = 'toast-card';
                toast.style.borderColor = '#2ecc71'; // Green border for success
                toast.innerHTML = `
                    <div style="width: 40px; height: 40px; background: #2ecc71; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff;">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <div class="toast-content">
                        <h4>Código PIX Copiado!</h4>
                        <p>Código copiado com sucesso.</p>
                    </div>
                `;
                container.appendChild(toast);
                setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
            }).catch(() => {
                // Silently ignore or log internally
            });
        } catch (err) { console.warn(err); }


        copyBtn.onclick = () => {
            navigator.clipboard.writeText(data.qr_code);
            // Feedback Discreto (Toast)
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = 'toast-card';
            toast.style.borderColor = '#2ecc71';
            toast.innerHTML = `
                <div style="width: 40px; height: 40px; background: #2ecc71; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff;">
                    <i class="fa-solid fa-check"></i>
                </div>
                <div class="toast-content">
                    <h4>Código PIX Copiado!</h4>
                    <p>Cole no app do seu banco para pagar.</p>
                </div>
            `;
            container.appendChild(toast);
            setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
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

                // 🔴 FIX: Marca o abandono como PAGO para não poluir o painel
                try {
                    fetch(`${API_URL}/api/abandon/convert`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pixId: data.id })
                    });
                } catch(e) { /* Silencioso — não bloqueia o redirect */ }

                const totalVal = document.querySelector('.checkout-total-display').innerText.replace(/[^\d,]/g, '').replace(',', '.');

                // PIXEL: Purchase (PIX Poll Success)
                trackPixel('Purchase', {
                    value: Number(totalVal) || cart.total || 0,
                    currency: 'BRL',
                    content_name: cart.mainProduct ? cart.mainProduct.title : 'Checkout',
                    content_ids: items.map(i => i.id)
                });

                window.location.href = `downloads.html?items=${items.map(i => i.id).join(',')}&total=${totalVal}`;
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


// --- 5. FLOATING TOASTS LOGIC ---
const toastData = [
    { name: 'Ricardo S.', city: 'PR', text: 'Comprei e não me arrependo, conteúdo excelente!', avatar: 'carrosel/ricardo.jpg' },
    { name: 'Ana Costa', city: 'GO', text: 'Meus pintinhos pararam de morrer.', avatar: 'carrosel/ana.jpg' },
    { name: 'João O.', city: 'BA', text: 'O suporte foi muito atencioso.', avatar: 'carrosel/joao_new.jpg' },
    { name: 'Carlos M.', city: 'MG', text: 'Material super completo, valeu a pena.', avatar: 'carrosel/carlos.jpg' },
    { name: 'Fernanda L.', city: 'SP', text: 'Recuperei meu galo favorito com o guia!', avatar: 'carrosel/fernanda.jpg' },
    { name: 'Roberto J.', city: 'RS', text: 'Entrega imediata, já estou estudando.', avatar: 'https://ui-avatars.com/api/?name=Roberto+J&background=random' },
    { name: 'Maria S.', city: 'SC', text: 'Muito bem explicado, parabéns.', avatar: 'carrosel/maria.jpg' }
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

    // Hide help bubbles on scroll to prevent "floating" issue
    window.addEventListener('scroll', removeHelpBubbles, true);
    // Also scroll on modal container if it's the one scrolling
    const modalContent = document.querySelector('#checkout-modal .modal-content');
    if (modalContent) {
        modalContent.addEventListener('scroll', removeHelpBubbles);
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
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '') return false;
    // Elimina CPFs invalidos conhecidos
    if (cpf.length != 11 ||
        cpf == "00000000000" ||
        cpf == "11111111111" ||
        cpf == "22222222222" ||
        cpf == "33333333333" ||
        cpf == "44444444444" ||
        cpf == "55555555555" ||
        cpf == "66666666666" ||
        cpf == "77777777777" ||
        cpf == "88888888888" ||
        cpf == "99999999999")
        return false;
    // Valida 1o digito
    let add = 0;
    for (let i = 0; i < 9; i++)
        add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev == 10 || rev == 11)
        rev = 0;
    // Valida 2o digito
    add = 0;
    for (let i = 0; i < 10; i++)
        add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev == 10 || rev == 11)
        rev = 0;
    if (rev != parseInt(cpf.charAt(10)))
        return false;
    return true;
}

function validateField(el, type) {
    if (!el) return true;
    const val = el.value.trim();
    let isValid = true;

    if (type === 'email') isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
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
        comparisonSlider.addEventListener('scroll', updateArrows);
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
        input.addEventListener('input', () => {
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

