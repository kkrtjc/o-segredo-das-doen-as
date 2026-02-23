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
    // 1. UNIQUE VISITOR TRACKING
    const today = new Date().toISOString().split('T')[0];
    const lastVisit = localStorage.getItem('mura_visita_hoje');
    if (lastVisit !== today) {
        trackEvent('unique_visit');
        localStorage.setItem('mura_visita_hoje', today);
    }

    // 2. CTA CLICK TRACKING
    document.querySelectorAll('a[href^="#offer"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const ctaId = btn.getAttribute('data-cta') || 'generic_cta';
            trackEvent('cta_click', null, ctaId);
            // Prepare for lead capture on hover or click if we have info
        });
    });

    // --- REAL-TIME LEAD CAPTURE ---
    let captureTimeout = null;
    const captureLostLead = () => {
        clearTimeout(captureTimeout);
        captureTimeout = setTimeout(async () => {
            const name = document.getElementById('payer-name')?.value?.trim();
            const email = document.getElementById('payer-email')?.value?.trim();
            const phone = document.getElementById('payer-phone')?.value?.trim();
            const product = cart.mainProduct ? (prefetchedProducts[cart.mainProduct]?.title || cart.mainProduct) : 'N/A';

            if (!phone || phone.length < 8) return;

            try {
                await fetch(`${API_URL}/api/leads/lost`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, phone, product })
                });
                console.log("📥 [LEAD] Captura em tempo real enviada.");
            } catch (e) {
                console.warn("[LEAD] Erro na captura em tempo real", e);
            }
        }, 1500); // Wait 1.5s after last input
    };

    // Listen to checkout inputs
    ['payer-name', 'payer-email', 'payer-phone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', captureLostLead);
    });

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
                        window.location.href = `downloads.html?items=${session.itemIds}&total=${session.total.toFixed(2)}`;
                    } else {
                        localStorage.removeItem('active_pix_session');
                    }
                } catch (e) { console.warn("Background check failed", e); }
            } else {
                localStorage.removeItem('active_pix_session');
            }
        } catch (e) {
            localStorage.removeItem('active_pix_session');
        }
    }

    // --- 5. DYNAMIC PRE-FETCH (Instant Checkout) ---
    try {
        const response = await fetch(`${API_URL}/api/config`);
        if (response.ok) {
            const config = await response.json();
            // Merge both products and orderBumps into prefetchedProducts for easy access
            Object.assign(prefetchedProducts, config.products, config.orderBumps);
            console.log('🚀 [PREFETCH] Configuração completa carregada (Produtos + Bumps)');

            // Update specific price elements if they exist
            const mainP = prefetchedProducts['ebook-doencas'];
            const priceElement = document.getElementById('display-price-value');
            if (priceElement && mainP && mainP.price) {
                priceElement.innerText = mainP.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            }
        }
    } catch (e) {
        console.warn('[PREFETCH] Falha ao carregar configuração global', e);
    }

    // 3. LAZY VIDEO LOADING (Intersection Observer)
    const lazyVideo = document.getElementById('vsl-video') || document.querySelector('.square-video-wrapper video');
    if (lazyVideo) {
        let tracked = false;
        lazyVideo.addEventListener('play', () => {
            if (!tracked) {
                trackEvent('video_play');
                tracked = true;
                console.log("🎥 [VIDEO] Play Tracked");
            }
        });

        if ('IntersectionObserver' in window) {
            const videoObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const source = lazyVideo.querySelector('source');
                        if (source && source.dataset.src) {
                            source.src = source.dataset.src;
                            lazyVideo.load();
                            console.log("🎥 [VIDEO] Lazy Source Loaded");
                        }
                        observer.unobserve(lazyVideo);
                    }
                });
            }, { rootMargin: '200px' });
            videoObserver.observe(lazyVideo);
        }
    }
});

function toggleVSL() {
    const video = document.getElementById('vsl-video-player');
    const overlay = document.getElementById('vsl-overlay');
    if (!video) return;

    if (video.paused) {
        video.play().then(() => {
            if (overlay) overlay.style.display = 'none';
        }).catch(err => {
            console.error("Video play failed:", err);
            // Fallback: try to play muted if it's a browser restriction
            video.muted = true;
            video.play();
            if (overlay) overlay.style.display = 'none';
        });
    } else {
        video.pause();
        if (overlay) overlay.style.display = 'flex';
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. FAQ Accordion Logic ---
    document.querySelectorAll('.faq-question').forEach(question => {
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
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            e.preventDefault();
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Se o alvo for a seção de ofertas, tenta focar no Combo Elite
                if (targetId === '#offer-focus' || targetId === '#offers') {
                    const comboCard = document.querySelector('.price-card.featured');
                    if (comboCard) {
                        comboCard.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'center'
                        });
                        return;
                    }
                }

                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            } else if (targetId === '#offer-focus') {
                // Fallback for when current card isn't loaded yet
                const pricingSection = document.getElementById('offers');
                if (pricingSection) {
                    window.scrollTo({
                        top: pricingSection.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });





    // --- 5. Comparison Slider (Results) ---
    const sliderTrack = document.getElementById('comparison-slider-track');
    if (sliderTrack) {
        const nextBtn = document.getElementById('comparison-next');
        const prevBtn = document.getElementById('comparison-prev');
        if (nextBtn && prevBtn) {
            nextBtn.addEventListener('click', () => {
                sliderTrack.scrollBy({ left: 300, behavior: 'smooth' });
            });
            prevBtn.addEventListener('click', () => {
                sliderTrack.scrollBy({ left: -300, behavior: 'smooth' });
            });
        }
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

    // --- 7. Lazy Loading & Layout Stability ---
    if ('IntersectionObserver' in window) {
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
            if (img.src) {
                // If it already has src, just mark as loaded
                img.classList.add('loaded');
            } else {
                imageObserver.observe(img);
            }
        });
    }

    // --- 8. Smooth Image Transitions ---
    document.querySelectorAll('img').forEach(img => {
        img.style.transition = 'opacity 0.4s ease-in-out';
        img.onload = () => img.style.opacity = '1';
        if (!img.complete) img.style.opacity = '0';
    });

    // --- 9. Mobile Vh Fix ---
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    window.addEventListener('resize', () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
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

// mp is initialized in index.html to avoid duplicate declaration errors
const checkoutModal = document.getElementById('checkout-modal');

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

// Interceptador para Promoção de Elite (Pré-Checkout)
async function openCheckout(productId, forceBumps = []) {
    // Se for o guia de doenças, mostra a oferta do combo primeiro
    if (productId === 'ebook-doencas') {
        const promoModal = document.getElementById('elite-promo-modal');
        if (promoModal) {
            promoModal.classList.add('show');
            startEliteTimer(300); // 5 minutos
            return;
        }
    }

    // Caso contrário (ou se o modal não existir), segue o fluxo original
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
    trackEvent('checkout_open');
    trackEvent('click');
    sessionStorage.setItem('mura_modal_open', 'true');
    if (typeof fbq === 'function') fbq('track', 'InitiateCheckout');

    if (!checkoutModal) return;

    // --- RESET CHECKOUT STATE ---
    document.getElementById('checkout-main-view').classList.remove('hidden');
    document.getElementById('pix-result').classList.add('hidden');

    if (window.activePixPoll) {
        clearInterval(window.activePixPoll);
        window.activePixPoll = null;
    }

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

        console.log('💠 [CHECKOUT] Abrindo para:', productId);
        console.log('💠 [CHECKOUT] Bumps vinculados no DB:', cart.mainProduct.orderBumps);

        // Ensure fullBumps exist even if prefetched
        if ((!cart.mainProduct.fullBumps || cart.mainProduct.fullBumps.length === 0) && cart.mainProduct.orderBumps) {
            console.log('💠 [CHECKOUT] Reconstruindo fullBumps do cache local...');
            cart.mainProduct.fullBumps = cart.mainProduct.orderBumps
                .map(id => {
                    const found = prefetchedProducts[id];
                    if (found) return { ...found, id: id }; // Garante que o ID esteja presente
                    return null;
                })
                .filter(b => b);
        }

        console.log('💠 [CHECKOUT] Full Bumps Finais:', cart.mainProduct.fullBumps);

        cart.bumps = forceBumps || [];

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

        renderOrderBumps(cart.mainProduct.fullBumps);
        updateTotal();

        const delay = (productData && productData.fullBumps) ? 10 : 250;
        setTimeout(() => {
            if (secureOverlay) secureOverlay.classList.remove('active');
            checkoutModal.classList.add('active');
            document.body.classList.add('modal-open');

            // Reforçar disparo do Pixel ao abrir definitivamente
            if (typeof fbq === 'function') fbq('track', 'InitiateCheckout');
        }, delay);

    } catch (err) {
        console.error("Critical error opening checkout:", err);
        if (secureOverlay) secureOverlay.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

function closeCheckout() {
    const modal = document.getElementById('checkout-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
    sessionStorage.removeItem('mura_modal_open');
}

function renderOrderBumps(bumps) {
    // ORDER BUMP DESATIVADO POR SOLICITAÇÃO DO USUÁRIO
    const area = document.getElementById('order-bump-area');
    if (area) area.innerHTML = '';
    return;
}

function legacy_renderOrderBumps(bumps) {
    const filteredBumps = (bumps || []).filter(bump => {
        // Remove Manual de Pintinhos do checkout (deve ser upsell posterior)
        if (bump.id === 'ebook-manejo' || bump.id === 'bump-manejo') return false;
        // Mantém a Tabela de Ração no checkout
        return true;
    });

    area.innerHTML = filteredBumps.map(bump => {
        let imgSrc = bump.image;
        if (!imgSrc) {
            if (bump.id === 'ebook-doencas' || bump.id === 'bump-doencas') imgSrc = 'capadasdoencas.jpg';
            else if (bump.id === 'ebook-manejo' || bump.id === 'bump-manejo') imgSrc = 'capadospintinhos.jpg';
            else if (bump.id === 'bump-6361') imgSrc = 'tabela_racao_bump.jpg';
        }

        return `
            <div class="order-bump-container" onclick="toggleBump('${bump.id}')" 
                style="margin-top: 1rem; position: relative; overflow: hidden; border: 2px solid #d97706; border-radius: 12px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; min-height: 120px; display: flex;">
                
                <!-- Imagem de Fundo Preenchendo Tudo -->
                ${imgSrc ? `<img src="${imgSrc}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">` : ''}
                
                <!-- Overlay Gradiente para Legibilidade -->
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.3) 100%); z-index: 1;"></div>

                <!-- Conteúdo por cima do fundo -->
                <div style="position: relative; z-index: 2; display: flex; align-items: center; gap: 15px; padding: 15px; width: 100%;">
                    <input type="checkbox" class="order-bump-checkbox" id="bump-chk-${bump.id}" ${cart.bumps.includes(bump.id) ? 'checked' : ''} 
                        style="width: 24px; height: 24px; cursor: pointer; accent-color: #fbbf24; flex-shrink: 0; filter: drop-shadow(0 0 5px rgba(0,0,0,0.5));">
                    
                    <div class="order-bump-content" style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <span class="order-bump-tag" style="background: #ef4444; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${bump.tag || 'OFERTA ÚNICA'}</span>
                        </div>
                        <strong class="order-bump-title" style="display: block; color: #fff; font-size: 1.05rem; margin-top: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${bump.title}</strong>
                        <span class="order-bump-description" style="display: block; color: rgba(255,255,255,0.9); font-size: 0.85rem; margin-top: 4px; line-height: 1.3; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${bump.description}</span>
                        <div style="display: flex; align-items: baseline; gap: 10px; margin-top: 8px;">
                            <span class="order-bump-price" style="color: #fbbf24; font-weight: 900; font-size: 1.2rem; text-shadow: 0 2px 5px rgba(0,0,0,0.5);">+ ${formatBRL(currentPaymentMethod === 'pix' ? bump.price : (bump.priceCard || bump.price))}</span>
                        </div>
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

        console.log('ðŸ” DEBUG updateTotal - Bump ID:', id, 'Encontrado:', bump);

        if (bump) {
            // Usa o preço do banco de dados
            const bumpPriceForPix = bump.price || 0;
            const bumpPriceForCard = bump.priceCard || bump.price || 0;

            console.log('💰 Preços do bump:', { pix: bumpPriceForPix, card: bumpPriceForCard });


            // Usa preços do banco de dados (sem regras especiais)
            total += bumpPriceForPix;
            cardTotal += bumpPriceForCard;
        } else {
            console.error('âŒ Bump não encontrado em fullBumps:', id);
        }
    });

    document.querySelectorAll('.pix-discount-badge').forEach(b => b.remove());

    const finalDisplayPrice = currentPaymentMethod === 'pix' ? total : cardTotal;

    // Adiciona badge de desconto se PIX estiver selecionado e houver desconto
    if (currentPaymentMethod === 'pix' && cardTotal > total) {
        const discountPercent = Math.round(((cardTotal - total) / cardTotal) * 100);
        const topPriceDisplay = document.getElementById('checkout-product-price-display');
        if (topPriceDisplay && topPriceDisplay.parentElement) {
            const discountBadge = document.createElement('span');
            discountBadge.className = 'pix-discount-badge';
            discountBadge.style.cssText = 'display: inline-block; margin-left: 8px; font-size: 0.7rem; color: #10b981; font-weight: 800; background: rgba(16, 185, 129, 0.1); padding: 3px 8px; border-radius: 12px;';
            discountBadge.innerHTML = `🔥 ${discountPercent}% OFF`;
            topPriceDisplay.parentElement.appendChild(discountBadge);
        }
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

        const card = document.createElement('div');
        card.className = `price-card featured`;
        card.id = 'offer-focus';

        const featuresHTML = (p.features || []).map(f => `<li><span class="check-icon">✓</span> ${f}</li>`).join('');

        const coverHTML = `<img src="${p.cover}" alt="${p.title}" style="max-width: 140px; margin: 10px auto; display: block; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));">`;
        const isDiscounted = p.originalPrice && (p.originalPrice > p.price);

        card.innerHTML = `
            <span class="badge-featured">${p.badge || 'OFERTA ÚNICA'}</span>
            <h3 class="price-title">${p.title}</h3>
            <p>${p.description || ''}</p>
            ${coverHTML}
            
            <div class="price-container" style="margin: 20px 0;">
                <div style="text-decoration: line-through; color: #999; font-size: 0.9rem;">De R$ ${p.originalPrice.toFixed(2).replace('.', ',')} por apenas:</div>
                <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.1;">
                    <span class="price-amount" style="color: var(--color-secondary); font-size: 3.5rem;">
                        R$ 109<small>,90</small>
                    </span>
                    <span style="font-size: 0.75rem; color: #10b981; font-weight: 800; margin-top: 3px; background: rgba(16, 185, 129, 0.1); padding: 4px 10px; border-radius: 15px;">🔥 27% DE DESCONTO NO PIX</span>
                    <span style="font-size: 0.9rem; color: var(--color-text-light); margin-top: 5px;">ou até 4x de <strong>R$ 37,47</strong> s/ juros</span>
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

function showSlideInUpsell(method) {
    const obModal = document.getElementById('order-bump-modal');
    if (!obModal) return;

    // Inicia o timer de 5 minutos
    let duration = 300; // 5 minutos em segundos
    const timerInterval = setInterval(() => {
        const timerEl = document.getElementById('upsell-timer');
        if (!timerEl) {
            clearInterval(timerInterval);
            return;
        }

        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        timerEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

        if (--duration < 0) {
            clearInterval(timerInterval);
            timerEl.textContent = "0:00";
        }
    }, 1000);

    obModal.innerHTML = `
        <div class="order-bump-slide-content" style="border-top: 3px solid #fbbf24; background: #1a1a1a; box-shadow: 0 -10px 40px rgba(0,0,0,0.8);">
            <button class="order-bump-close" onclick="declineSlideUpsell('${method}')" style="background: rgba(255,255,255,0.1); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; top: 5px; right: 5px;">
                <i class="fa-solid fa-xmark" style="font-size: 0.8rem;"></i>
            </button>

            <div class="order-bump-header" style="text-align: center; padding: 5px 0;">
                <div style="display: inline-block; background: #e74c3c; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 900; font-size: 0.65rem; margin-bottom: 4px; letter-spacing: 1px;">PROMOÇÃO RELÂMPAGO</div>
                <h3 style="margin-top: 2px; font-size: 1.05rem; color: #fbbf24; text-transform: uppercase; line-height: 1.1;">
                    APENAS AGORA<br>
                    <span style="font-size: 0.8rem; color: #fff; font-weight: 400; opacity: 0.8;">MANUAL DE PINTINHOS DE ELITE</span>
                </h3>
            </div>

            <div style="background: rgba(251,191,36,0.1); border: 1px dashed #fbbf24; border-radius: 8px; padding: 6px; margin: 6px 0; text-align: center;">
                <span style="color: #fff; font-size: 0.75rem;">Expira em: </span>
                <span id="upsell-timer" style="color: #fbbf24; font-weight: 900; font-size: 1.1rem; font-family: monospace;">05:00</span>
            </div>

            <div class="order-bump-body" style="text-align: center; padding: 0 5px;">
                <p style="color: #fff; font-size: 0.8rem; margin-bottom: 0.75rem; line-height: 1.3; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px;">
                    <strong style="color: #e74c3c;">8 A CADA 10 PINTINHOS MORREM</strong> POR ERRO DE MANEJO. APRENDA COMO CRIAR PINTINHOS E SE LIVRE DE DOENÇA DESDE O NASCIMENTO.<br>
                    <strong style="color: #fbbf24; display: block; margin-top: 4px;">SE TORNE O CRIADOR COMPLETO</strong>
                </p>
                
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 0.75rem; text-align: left;">
                    <div style="position: relative;">
                         <img src="capadospintinhos.jpg" style="width: 75px; border-radius: 12px; border: 1.5px solid #fbbf24; box-shadow: 0 0 10px rgba(251, 191, 36, 0.3);">
                         <div style="position: absolute; top: -5px; right: -5px; background: #e74c3c; color: #fff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 900; transform: rotate(15deg); border: 1.5px solid #fff;">-35%</div>
                    </div>
                    <ul style="color: #fff; font-size: 0.7rem; padding: 0; margin: 0; list-style: none; line-height: 1.3;">
                        <li style="margin-bottom: 2px;"><i class="fa-solid fa-check" style="color: #fbbf24; margin-right: 4px;"></i> Sobrevivência de até 90%</li>
                        <li style="margin-bottom: 2px;"><i class="fa-solid fa-check" style="color: #fbbf24; margin-right: 4px;"></i> Crescimento mais rápido</li>
                        <li style="margin-bottom: 2px;"><i class="fa-solid fa-check" style="color: #fbbf24; margin-right: 4px;"></i> Ambiente 100% adequado</li>
                        <li style="margin-bottom: 2px;"><i class="fa-solid fa-check" style="color: #fbbf24; margin-right: 4px;"></i> As principais doenças em pintinhos e como tratar.</li>
                    </ul>
                </div>

                <div class="order-bump-price-tag" style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="color: rgba(255,255,255,0.4); text-decoration: line-through; font-size: 0.75rem;">De R$ 69,90 no cartão</div>
                    <div style="color: #fbbf24; font-size: 1.8rem; font-weight: 900; line-height: 1;">R$ 49<span style="font-size: 1rem;">,90 no pix</span></div>
                </div>
            </div>

            <div class="order-bump-actions" style="padding: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                <button class="btn-accept-bump" onclick="confirmSlideUpsell('${method}')" style="background: #fbbf24; color: #000; width: 100%; border: none; padding: 12px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 0.9rem; text-transform: uppercase;">
                    QUERO SALVAR MEUS PINTINHOS
                </button>
                <button class="btn-decline-bump" onclick="declineSlideUpsell('${method}')" style="background: none; border: none; color: rgba(255,255,255,0.4); text-decoration: underline; margin-top: 8px; cursor: pointer; display: block; width: 100%; font-size: 0.75rem;">
                    Não, obrigado.
                </button>
            </div>
        </div>
    `;

    obModal.classList.add('show');
}

function confirmSlideUpsell(method) {
    console.log('✅ User ACCEPTED upsell');
    midCheckoutUpsellPending = false;

    // Add upsell to cart
    if (!cart.bumps.includes('ebook-manejo')) {
        cart.bumps.push('ebook-manejo');
        updateTotal();
    }

    // Hide modal
    const obModal = document.getElementById('order-bump-modal');
    if (obModal) obModal.classList.remove('show');

    // NOW generate the PIX/Card payment
    if (method === 'pix') {
        console.log('🔵 Proceeding to PIX generation after upsell acceptance');
        processPixPayment();
    } else {
        console.log('🔵 Proceeding to Card payment after upsell acceptance');
        processCardPayment();
    }
}

function declineSlideUpsell(method) {
    console.log('❌ User DECLINED upsell');
    midCheckoutUpsellPending = false;

    // Hide modal
    const obModal = document.getElementById('order-bump-modal');
    if (obModal) obModal.classList.remove('show');

    // Generate PIX/Card payment WITHOUT upsell
    if (method === 'pix') {
        console.log('🔵 Proceeding to PIX generation after upsell decline');
        processPixPayment();
    } else {
        console.log('🔵 Proceeding to Card payment after upsell decline');
        processCardPayment();
    }
}

function acceptUpsell() {
    closeFunnelModal();
    // Adiciona Pintinhos como Bump e abre checkout de Doenças
    funnelState.upsellAccepted = true;
    openCheckout(funnelState.mainId, ['ebook-manejo']);
}

function acceptDownsell() {
    closeFunnelModal();
    // Abre checkout direto do Combo
    openCheckout('combo-elite');
}

function rejectFunnel() {
    closeFunnelModal();
    // Abre checkout apenas do produto principal
    openCheckout(funnelState.mainId);
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

        // Esconder CPF para PIX (CPF fallback no backend)
        const cpfContainer = document.getElementById('cpf-container');
        if (cpfContainer) cpfContainer.style.display = 'none';

    } else if (method === 'card') {
        if (pixArea) { pixArea.style.display = 'none'; }
        if (cardArea) { cardArea.style.display = 'block'; }
        if (btnPix) btnPix.style.display = 'none';
        if (btnCard) btnCard.style.display = 'block';

        // Mostrar CPF para Cartão
        const cpfContainer = document.getElementById('cpf-container');
        if (cpfContainer) cpfContainer.style.display = 'block';
    }

    // RECALCULATE TOTAL WHEN SWITCHING
    if (cart.mainProduct) {
        renderOrderBumps(cart.mainProduct.fullBumps);
        updateTotal();
    }
}


let midCheckoutUpsellPending = true;

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
        // CARD MODE: Use Cardholder Data as Customer Data
        // CPF now comes from common field (payer-cpf)
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

    // Adiciona bumps com preços corretos baseados no método de pagamento
    cart.bumps.forEach(id => {
        let b = cart.mainProduct.fullBumps?.find(x => x.id === id);

        // FALLBACK: Se não encontrou em fullBumps, pode ser um produto (upsell)
        if (!b && id.startsWith('ebook-')) {
            b = {
                id: id,
                title: id === 'ebook-manejo' ? 'Manual de Manejo de Pintinhos' : 'Ebook',
                price: id === 'ebook-manejo' ? 49.90 : 59.90, // UPSSELL EXCLUSIVO PIX
                priceCard: id === 'ebook-manejo' ? 49.90 : 59.90
            };
        }

        if (b) {
            let bumpPrice = b.price;

            // Aplica preços específicos baseados no método de pagamento
            if (method === 'card' && b.priceCard) {
                // Se tiver preços específicos para cartão, usa ele
                bumpPrice = b.priceCard;
            }

            items.push({ id: b.id, title: b.title, price: bumpPrice });
        }
    });

    if (method === 'pix') {
        const btn = document.getElementById('btn-pay-pix');
        const originalText = btn.innerText;

        // --- ðŸ›¡ï¸ PIX LOGIC (ALWAYS NEW) ---
        // We removed the "Reuse Only" logic to fix the "Stuck" issue.
        // Logic fix: Calculate total again or rely on updateTotal? 
        // Ideally rely on the calculated values, but for safety lets reclac logic briefly

        let finalPrice = cart.mainProduct.price; // PIX = Discount Price

        const totalAmount = items.reduce((acc, item) => {
            // If item is main product, ensure we use correct price, but for PIX it IS the base price
            // Actually items array was built using cart.mainProduct.price which IS the discounted one
            // So this reduce is correct for PIX.
            return acc + Number(item.price);
        }, 0);
        const itemIds = items.map(i => i.id).sort().join(',');

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GERANDO SEU PIX...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            // SET A HEARTBEAT / TIMEOUT for UI safety
            const timeout = setTimeout(() => {
                if (btn.innerText === 'Gerando Pix...') {
                    btn.disabled = false;
                    btn.innerText = 'Tentar Novamente';
                    alert('O servidor está demorando para responder. Tente clicar novamente ou verifique se sua internet está estável.');
                }
            }, 15000);

            const res = await fetch(`${API_URL}/api/checkout/pix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, customer })
            });

            clearTimeout(timeout);
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

                // UPSELL PÓS-PIX: DESATIVADO
                /*
                setTimeout(() => {
                    if (midCheckoutUpsellPending && !cart.bumps.includes('ebook-manejo') && cart.mainProduct.id !== 'combo-elite' && cart.mainProduct.id !== 'ebook-manejo') {
                        showSlideInUpsell('pix');
                    }
                }, 2000);
                */
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
                    alert(`Pagamento não autorizado.\n\nDetalhe: ${msg}\n\nTente usar outro cartão ou PIX.`);
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

// --- 1. PIX PAYMENT (MODIFIED FOR UPSELL INTERCEPTION) ---
async function startPixPayment(event) {
    console.log('🔵 startPixPayment CALLED');
    if (event) event.preventDefault();

    // VALIDAÇÃO
    if (!validateCheckoutInputs('pix')) {
        console.warn('⚠️ Validation failed before pix');
        return;
    }

    try {
        // UPSELL DESATIVADO: Proceed directly to generate PIX
        console.log('✅ Proceeding directly to PIX generation (Upsells disabled)');
        await processPixPayment();
    } catch (error) {
        console.error('❌ Error in startPixPayment:', error);
        alert('Erro ao processar pagamento PIX: ' + error.message);
    }
}

async function processPixPayment() {
    console.log('✅ processPixPayment: Proceeding to handlePayment');
    await handlePayment('pix');
}

// --- 2. CARD PAYMENT (MODIFIED FOR UPSELL INTERCEPTION) ---
async function startCardPayment(event) {
    console.log('🔵 startCardPayment CALLED');
    if (event) event.preventDefault();

    // VALIDAÇÃO
    if (!validateCheckoutInputs('card')) {
        console.warn('⚠️ Validation failed before card');
        return;
    }

    try {
        // UPSELL DESATIVADO: Proceed directly to process payment
        console.log('✅ Proceeding directly to Card payment (Upsells disabled)');
        await processCardPayment();
    } catch (error) {
        console.error('❌ Error in startCardPayment:', error);
        alert('Erro ao processar pagamento com cartão: ' + error.message);
    }
}

async function processCardPayment() {
    console.log('✅ processCardPayment: Proceeding to handlePayment');
    await handlePayment('card');
}

// --- VALIDATION AND INTERCEPTION FUNCTIONS ---

// function validateCheckoutInputs(method) removed as it was a duplicate and replaced by the one at the bottom of the file

function interceptPaymentButton(callback) {
    // Esta função pode ser usada para interceptar o pagamento com upsells
    // Por enquanto, apenas retorna false para permitir o fluxo normal
    return false;
}

// Event Listeners with Order Bump Interception
document.getElementById('btn-pay-pix')?.addEventListener('click', startPixPayment);
document.getElementById('btn-pay-card')?.addEventListener('click', startCardPayment);
document.querySelectorAll('.method-btn').forEach(b => b.addEventListener('click', () => switchMethod(b.dataset.method)));
document.querySelector('.close-modal')?.addEventListener('click', () => {
    // TRACK ABANDON
    if (sessionStorage.getItem('mura_modal_open') === 'true') {
        trackEvent('checkout_abandon');
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
    document.getElementById('checkout-main-view').classList.add('hidden');
    document.getElementById('pix-result').classList.remove('hidden');
    document.getElementById('qr-code-img').src = `data:image/png;base64,${data.qr_code_base64}`;
    document.getElementById('pix-copy-paste').value = data.qr_code;

    // Auto-copy PIX code
    if (data.qr_code && navigator.clipboard) {
        navigator.clipboard.writeText(data.qr_code).then(() => {
            console.log('✅ PIX code auto-copied');
            // Show Success Notification
            const container = document.getElementById('toast-container') || document.body;
            const toast = document.createElement('div');
            toast.className = 'toast-card';
            toast.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #16a34a; color: white; padding: 15px 25px; border-radius: 10px; z-index: 10000; box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-weight: bold;";
            toast.innerHTML = `<i class="fa-solid fa-check-double"></i> codigo pix copiado com seucesso`;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }).catch(err => {
            console.warn('❌ Auto-copy failed:', err);
        });
    }

    const copyBtn = document.getElementById('btn-copy-pix');
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(data.qr_code).then(() => {
                // Show Success Notification
                const container = document.getElementById('toast-container') || document.body;
                const toast = document.createElement('div');
                toast.className = 'toast-card';
                toast.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #16a34a; color: white; padding: 15px 25px; border-radius: 10px; z-index: 10000; box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-weight: bold;";
                toast.innerHTML = `<i class="fa-solid fa-check-double"></i> codigo pix copiado com seucesso`;
                container.appendChild(toast);
                setTimeout(() => toast.remove(), 4000);
            });
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

    // Remove logic handled by CSS animation mainly, but cleanup DOM
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5500); // wait for animation end (5s) + buffer
}

// Redundant code block (validation, help bubbles, global listeners) removed for consolidation.

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
// Comparison Slider Navigation Logic with Boundary Detection
const comparisonSlider = document.getElementById('comparison-slider-track');
const prevButton = document.getElementById('comparison-prev');
const nextButton = document.getElementById('comparison-next');

if (comparisonSlider && prevButton && nextButton) {

    // Function to update arrow states based on scroll position
    function updateArrowStates() {
        const scrollLeft = comparisonSlider.scrollLeft;
        const maxScroll = comparisonSlider.scrollWidth - comparisonSlider.clientWidth;

        // Disable/enable left arrow
        if (scrollLeft <= 0) {
            prevButton.disabled = true;
            prevButton.style.opacity = '0.3';
            prevButton.style.cursor = 'not-allowed';
        } else {
            prevButton.disabled = false;
            prevButton.style.opacity = '1';
            prevButton.style.cursor = 'pointer';
        }

        // Disable/enable right arrow
        if (scrollLeft >= maxScroll - 1) { // -1 for rounding tolerance
            nextButton.disabled = true;
            nextButton.style.opacity = '0.3';
            nextButton.style.cursor = 'not-allowed';
        } else {
            nextButton.disabled = false;
            nextButton.style.opacity = '1';
            nextButton.style.cursor = 'pointer';
        }
    }

    // Initial state check
    updateArrowStates();

    // Update on scroll
    comparisonSlider.addEventListener('scroll', updateArrowStates);

    // Click handlers
    prevButton.addEventListener('click', () => {
        if (!prevButton.disabled) {
            const slideWidth = comparisonSlider.querySelector('.comparison-slide').offsetWidth;
            comparisonSlider.scrollBy({
                left: -slideWidth,
                behavior: 'smooth'
            });
        }
    });

    nextButton.addEventListener('click', () => {
        if (!nextButton.disabled) {
            const slideWidth = comparisonSlider.querySelector('.comparison-slide').offsetWidth;
            comparisonSlider.scrollBy({
                left: slideWidth,
                behavior: 'smooth'
            });
        }
    });
}
// Mobile Checkout Modal Fix - Apply body class to prevent background scroll
(function () {
    // Get any modal elements
    const modalElements = document.querySelectorAll('[id*="modal"], [id*="checkout"]');

    // Create a MutationObserver to watch for modal display changes
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                const display = window.getComputedStyle(target).display;

                if (display === 'flex' || display === 'block') {
                    // Modal is opening
                    document.body.classList.add('modal-open');
                } else if (display === 'none') {
                    // Modal is closing
                    document.body.classList.remove('modal-open');
                }
            }
        });
    });

    // Observe each modal for style changes
    modalElements.forEach(function (modal) {
        observer.observe(modal, {
            attributes: true,
            attributeFilter: ['style']
        });
    });
})();


// --- VALIDATION LOGIC ---

function validateCheckoutInputs(method) {
    let isValid = true;
    const inputsToValidate = [
        'payer-name',
        'payer-email',
        'payer-phone'
    ];

    // CPF é obrigatório apenas para cartão ou se o usuário preencher (para PIX é opcional no frontend devido ao fallback)
    if (method !== 'pix') {
        inputsToValidate.push('payer-cpf');
    }

    if (method === 'card') {
        inputsToValidate.push('card-number', 'card-expiration', 'card-cvv', 'card-holder', 'card-cpf');
    }

    inputsToValidate.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            const isFieldValid = validateField(input);
            if (!isFieldValid) isValid = false;
        }
    });

    if (!isValid) {
        // Find first invalid input and focus
        const firstInvalid = document.querySelector('.input-error');
        if (firstInvalid) firstInvalid.focus();
    }

    return isValid;
}

function validateField(input) {
    const val = input.value.trim();
    let valid = true;

    // Basic validation: not empty
    if (val.length === 0) valid = false;

    // Specific validations
    if (input.id.includes('email') && !val.includes('@')) valid = false;
    if (input.id.includes('cpf') && val.length < 11) valid = false;
    if (input.id.includes('phone') && val.length < 10) valid = false;
    if (input.id.includes('card-number') && val.length < 13) valid = false;
    if (input.id.includes('expiration') && val.length < 4) valid = false;
    if (input.id.includes('cvv') && val.length < 3) valid = false;

    // UI Feedback
    if (!valid) {
        setInputError(input);
    } else {
        setInputSuccess(input);
    }

    return valid;
}

function setInputError(input) {
    input.classList.add('input-error');
    input.classList.remove('input-success');

    // Check if message exists
    let msg = input.parentElement.querySelector('.error-message');
    if (!msg) {
        msg = document.createElement('span');
        msg.className = 'error-message';
        msg.innerText = 'ops esse campo esta errado';
        input.parentElement.appendChild(msg);
    }
}

function setInputSuccess(input) {
    input.classList.remove('input-error');
    input.classList.add('input-success');

    const msg = input.parentElement.querySelector('.error-message');
    if (msg) msg.remove();
}

// Attach listeners for real-time validation removal/success
document.addEventListener('DOMContentLoaded', () => {
    const allInputs = document.querySelectorAll('.form-input');
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            // Remove error immediately when typing starts
            if (input.classList.contains('input-error')) {
                input.classList.remove('input-error');
                const msg = input.parentElement.querySelector('.error-message');
                if (msg) msg.remove();
            }

            // Optional: validate on the fly for green border?
            // "quadno o cliente começar a esrever de novo, o aviso some" - Done above.
            // "se o campo estiveer correto, borda verde" - We can check this on blur or debounce.
            // Let's check on input but maybe less strict? Or just stick to "remove error".
            // User asked "se o campo estiveer correto, borda verde".

            if (input.value.trim().length > 0) {
                // Simple validation for green border during typing might be annoying if it flickers.
                // Let's do it on blur OR if it meets length criteria.
                // For now, let's keep it simple: clear error on input. Validate fully on blur.
            }
        });

        input.addEventListener('blur', () => {
            if (input.value.trim().length > 0) {
                validateField(input);
            } else {
                // If empty on blur, maybe don't show red yet unless form submitted? 
                // Or user wants immediate feedback? "ops esse campo esta errado" implies feedback.
                // Let's show error on blur if empty? Maybe too aggressive.
                // Re-reading: "adicione log de erros no checkout... como o campo ficar vermelho se nao estiver correto"
                // Usually this means after attempted submission OR on blur if invalid.
                // I will add it to the validateCheckoutInputs function mainly, and maybe blur for green.
                validateField(input);
            }
        });
    });

    // Also setup the new card-cpf mask in smart_fields logic if needed, 
    // but I can add a simple listener here for the new field mask
    const cardCpf = document.getElementById('card-cpf');
    if (cardCpf) {
        cardCpf.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            e.target.value = v;
        });
    }

    // --- 10. VSL Live Counter Dynamism ---
    const vslCounter = document.getElementById('vsl-counter');
    if (vslCounter) {
        let count = parseInt(vslCounter.innerText) || 247;

        function fluctuateCounter() {
            // Randomly add or subtract between 1 and 3 people
            const variation = Math.floor(Math.random() * 7) - 3; // -3 to +3
            count += variation;

            // Keep it in a realistic range for this stage
            if (count < 180) count += 5;
            if (count > 350) count -= 5;

            vslCounter.innerText = count;

            // Next fluctuation in 3 to 10 seconds
            const nextTime = Math.floor(Math.random() * 7000) + 3000;
            setTimeout(fluctuateCounter, nextTime);
        }

        // Start after a short delay
        setTimeout(fluctuateCounter, 3000);
    }
});


// --- 6. LIGHTBOX SYSTEM ---
function openLightbox(src) {
    const overlay = document.getElementById('lightbox-overlay');
    const img = document.getElementById('lightbox-img');
    if (overlay && img) {
        img.src = src;
        overlay.classList.add('active');
        // Não prendemos o scroll aqui para não bugar com o modal aberto embaixo
    }
}

function closeLightbox() {
    const overlay = document.getElementById('lightbox-overlay');
    if (overlay) overlay.classList.remove('active');
}

// Fechar com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLightbox();
        // Não fechamos o checkout no ESC por segurança na conversão, apenas o lightbox
    }
});
