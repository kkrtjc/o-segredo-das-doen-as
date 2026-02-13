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
        });
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

    // 3. LAZY VIDEO LOADING (Intersection Observer)
    const lazyVideo = document.getElementById('vsl-video');
    if (lazyVideo && 'IntersectionObserver' in window) {
        const videoObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const source = lazyVideo.querySelector('source');
                    if (source && source.dataset.src) {
                        source.src = source.dataset.src;
                        lazyVideo.load();
                        console.log("📹 [VIDEO] Lazy Source Loaded");
                    }
                    observer.unobserve(lazyVideo);
                }
            });
        }, { rootMargin: '200px' });
        videoObserver.observe(lazyVideo);
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



    // --- 4. Testimonials (Infinite Carousel) ---
    // UPDATED: More impactful testimonials & +1600 students proof
    const testimonials = [
        { text: 'Meu galo tava com o olho fechado e a cara inchada. Vi o vídeo no insta e resolvi comprar, no mesmo dia já melhorou bastante.', author: 'Carlos Silva', location: 'Minas Gerais', stars: 5, avatar: 'carrosel/carlos.png' },
        { text: 'Tava perdendo pintinho toda semana, não sabia o que fazer. Apliquei o protocolo e hoje não morre mais nenhum.', author: 'Maria Santos', location: 'São Paulo', stars: 5, avatar: 'carrosel/maria.PNG' },
        { text: 'Tinha uma galinha que não comia, só ficava no canto. Segui o passo a passo e em 2 dias ela voltou ao normal.', author: 'João Oliveira', location: 'Bahia', stars: 5, avatar: 'carrosel/joao_new.jpg' },
        { text: 'Meu galo tava morrendo de coriza, olho espumando e cheirando mal. Fiz o tratamento e salvei ele.', author: 'Ana Costa', location: 'Goiás', stars: 5, avatar: 'carrosel/ana.png' },
        { text: 'Gastava uma fortuna em remédio e as galinhas continuavam morrendo. Descobri que tava errando no básico.', author: 'Ricardo Lima', location: 'Paraná', stars: 5, avatar: 'carrosel/ricardo.jpeg' },
        { text: 'Pintinhos nasciam e morriam com 3 dias. Apliquei o manejo de elite e agora todos sobrevivem.', author: 'Pedro Almeida', location: 'Bahia', stars: 5, avatar: 'carrosel/pedro.png' },
        { text: 'Meus frangos eram raquíticos, magros demais. Arrumei a ração conforme o ebook e explodiram de tamanho.', author: 'Camila Rocha', location: 'Espirito Santo', stars: 5, avatar: 'carrosel/camila.jpeg' },
        { text: 'Galinha parou de botar e tava com a crista caída. Segui o protocolo e voltou a produzir normal.', author: 'Lucas Ferreira', location: 'Mato Grosso', stars: 5, avatar: 'carrosel/lucas.jpeg' },
        { text: 'Tinha galo com a perna torta, achei que ia morrer. O tratamento salvou e hoje ele tá perfeito.', author: 'Isabella Lima', location: 'Santa Catarina', stars: 5, avatar: 'carrosel/isabella.jpeg' },
        { text: 'Perdi 15 aves em um mês antes de comprar. Depois que aprendi o manejo certo, zerou a mortalidade.', author: 'Juliana Freitas', location: 'Goiás', stars: 5, avatar: 'carrosel/juliana.jpeg' }
    ];

    const testimonialsTrack = document.getElementById('testimonials-track');
    if (testimonialsTrack) {
        // Clear existing content
        testimonialsTrack.innerHTML = '';

        // Render all testimonials but hide them initially (except first)
        testimonials.forEach((t, index) => {
            const starsHTML = '<i class="fa-solid fa-star" style="color: #FFD700;"></i>'.repeat(t.stars);
            const card = document.createElement('div');
            card.className = 'testimonial-card-single'; // New class for single display
            // Style for single focused card
            card.style.opacity = index === 0 ? '1' : '0';
            card.style.position = 'absolute';
            card.style.top = '0';
            card.style.left = index === 0 ? '0' : '100%'; // Start off-screen right
            card.style.width = '100%';
            card.style.height = '100%';
            card.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.transform = index === 0 ? 'translateX(0)' : 'translateX(50px)'; // Helper for fade in

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="width: 50px; height: 50px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0;">
                        <img src="${t.avatar}" alt="${t.author}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${t.author}&background=random&color=fff'">
                    </div>
                    <div>
                        <strong style="display: block; color: #fff; font-size: 0.95rem; line-height: 1.2;">${t.author}</strong>
                        <small style="color: rgba(255,255,255,0.5); font-size: 0.75rem;"><i class="fa-solid fa-location-dot" style="margin-right: 4px;"></i> ${t.location}</small>
                        <div style="font-size: 0.7rem; color: #FFD700; margin-top: 2px;">${starsHTML}</div>
                    </div>
                </div>
                <p style="font-style: normal; margin: 0; color: rgba(255,255,255,0.8); font-size: 0.85rem; line-height: 1.5;">"${t.text}"</p>
            `;
            testimonialsTrack.appendChild(card);
        });

        let currentIdx = 0;

        function nextSlide() {
            const cards = document.querySelectorAll('.testimonial-card-single');
            const total = cards.length;

            // Current card moves OUT to LEFT
            const current = cards[currentIdx];
            current.style.opacity = '0';
            current.style.left = '-100%';
            current.style.transform = 'translateX(-50px)';

            // Wait briefly then reset it to RIGHT side for next cycle
            setTimeout(() => {
                current.style.transition = 'none'; // Disable transition for instant move
                current.style.left = '100%';
                setTimeout(() => {
                    current.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'; // Re-enable
                }, 50);
            }, 800); // Wait for exit animation

            // Next card moves IN from RIGHT
            currentIdx = (currentIdx + 1) % total;
            const next = cards[currentIdx];

            // Ensure next is ready at start position
            next.style.left = '0';
            next.style.opacity = '1';
            next.style.transform = 'translateX(0)';
        }

        // Change slide every 5 seconds
        setInterval(nextSlide, 5000);
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

const mp = new MercadoPago('APP_USR-2502a3c7-5f59-45b0-8365-1cfcad7b0fa5');
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

async function openCheckout(productId, forceBumps = []) {
    trackEvent('checkout_open');
    trackEvent('click');
    sessionStorage.setItem('mura_modal_open', 'true');
    // Pixel Tracking
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
    const lockScroll = () => {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    };

    if (secureOverlay) {
        secureOverlay.classList.add('active');
        lockScroll();
    }

    try {
        const response = await fetch(`${API_URL}/api/products/${productId}?t=${Date.now()}`);
        const productData = await response.json();

        cart.mainProduct = { ...productData, id: productId };
        cart.bumps = forceBumps || []; // Adiciona os bumps forçados pelo funil (ex: Upsell)

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

        // Define Pix como padrão E aplica a filtragem correta desde o início
        currentPaymentMethod = 'pix';
        switchMethod('pix'); // Garante UI state

        renderOrderBumps(productData.fullBumps);
        updateTotal();

        // --- Guided Animation Sequence ---
        setTimeout(() => {
            if (secureOverlay) secureOverlay.classList.remove('active');

            const logoOverlay = document.getElementById('checkout-logo-overlay');
            if (logoOverlay) {
                logoOverlay.classList.add('active');
                setTimeout(() => {
                    logoOverlay.classList.add('run-left');
                    checkoutModal.classList.add('active');
                    setTimeout(() => {
                        logoOverlay.classList.remove('active', 'run-left');
                    }, 800); // Logo transition time
                }, 100); // INSTANT: Reduced from 800 to 100
            } else {
                checkoutModal.classList.add('active');
            }
        }, 800); // Time for the Secure Lock to stay visible (Reduced from 1500)

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

    // Filtra bumps que não devem aparecer (Ex: Tabela no Pix)
    const filteredBumps = (bumps || []).filter(bump => {
        if (currentPaymentMethod === 'pix' && bump.id === 'bump-6361') return false;
        return true;
    });

    area.innerHTML = filteredBumps.map(bump => {
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
    // PRICING LOGIC DEFINIDA PELO USUÁRIO:
    // Doenças: 119.90 (Pix) | 10x 19.90 (Card)
    // Pintinhos: + 59.90 (Pix) | 10x 9.90 (Card)
    // Combo: 129.90 (Pix) | 10x 29.90 (Card)
    // Tabela: R$ 0 (Pix) | R$ 19.90 (Card)

    let basePrice = cart.mainProduct.price; // Pix: 119.90
    let cardPrice = cart.mainProduct.originalPrice || 139.90; // Card: 139.90

    // Se for combo, manter valores anteriores ou ajustar?
    // User pediu 139.90 e 119.90 especificamente para o fluxo principal.

    let total = basePrice;
    let cardTotal = cardPrice;

    // Adiciona Bumps
    cart.bumps.forEach(id => {
        if (id === 'ebook-manejo') {
            total += 39.9; // PREÇO PROMOCIONAL ATUALIZADO (39.90)
            cardTotal += 59.9; // Mantendo preço cheio no cartão ou ajusta também? User disse "preço do ebook dos pintinhos pode colocar de 69,90 apenas agora por 39,90". Provavelmente vale para ambos ou só Pix?
            // Assumindo oferta geral de 39.90 para ser agressivo
            cardTotal = cardTotal - 59.9 + 39.9;
        } else if (id === 'bump-6361') {
            total += 0; // Tabela Grátis no Pix
            cardTotal += 19.9;
        }
    });

    document.querySelectorAll('.pix-discount-badge').forEach(b => b.remove());

    const finalDisplayPrice = currentPaymentMethod === 'pix' ? total : cardTotal;

    // Mostrar Bônus Pix de forma clara
    const bonusDisplay = document.getElementById('pix-bonus-status');
    if (bonusDisplay) {
        if (currentPaymentMethod === 'pix') {
            bonusDisplay.innerHTML = '<span style="color: #32bcad; font-weight: 800;"><i class="fa-solid fa-gift"></i> TABELA DE RAÇÃO INCLUÍDA (BÔNUS)</span>';
            bonusDisplay.style.display = 'block';
        } else {
            bonusDisplay.style.display = 'none';
        }
    }

    document.querySelectorAll('.checkout-total-display').forEach(el => {
        el.innerText = formatBRL(finalDisplayPrice);

        if (currentPaymentMethod === 'pix') {
            const badge = document.createElement('span');
            badge.className = 'pix-discount-badge';
            badge.style.cssText = 'font-size: 0.75rem; color: #32bcad; background: rgba(50, 188, 173, 0.1); padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: 700; border: 1px solid rgba(50, 188, 173, 0.2);';
            badge.innerText = 'TABELA GRÁTIS';
            el.appendChild(badge);
        }
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

    // De 1x até 4x (Regra: Atá 4x de 34,97 sem juros baseados no 139,90)
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
                        R$ 119<small>,90</small>
                    </span>
                    <span style="font-size: 0.9rem; color: var(--color-text-light); margin-top: 5px;">ou até 4x de <strong>R$ 34,97</strong> s/ juros</span>
                </div>
            </div>

            <ul class="price-features" style="margin-top: 1rem;">
                ${featuresHTML}
                <li style="color: #32bcad; font-weight: 800;"><span class="check-icon">✓</span> + TABELA DE RAÇÃO (GRÁTIS NO PIX)</li>
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

    const price = method === 'pix' ? '39,90' : '39,90';

    // Inicia o timer de 10 minutos
    let duration = 600; // 10 minutos em segundos
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
        <div class="order-bump-slide-content">
            <button class="order-bump-close" onclick="declineUpsell('${method}')">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <div class="order-bump-header" style="text-align: center;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.8rem; color: #e74c3c;"></i>
                <h3 style="margin-top: 10px; font-size: 1.1rem; color: #fff; text-transform: uppercase;">
                    OFERTA EXCLUSIVA APENAS AGORA<br>
                    <span style="font-size: 0.9rem; color: #aaa; font-weight: 400;">VOCÊ NÃO VAI VER ISSO DE NOVO</span>
                </h3>
            </div>

            <div style="background: rgba(231,76,60,0.2); border: 1px solid #e74c3c; border-radius: 6px; padding: 8px; margin: 10px 0; text-align: center;">
                <span style="color: #fff; font-size: 0.9rem;">Expira em: </span>
                <span id="upsell-timer" style="color: #fbbf24; font-weight: 800; font-size: 1.1rem;">10:00</span>
            </div>

            <div class="order-bump-body" style="text-align: center;">
                <p style="color: #fff; font-size: 0.95rem; margin-bottom: 1rem; line-height: 1.4;">
                    <strong>8 de cada 10 pintinhos</strong> morrem nos primeiros 30 dias por erros de manejo.
                    Não jogue seu dinheiro fora!
                </p>
                
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 1rem; text-align: left;">
                    <img src="capadospintinhos.png" style="width: 90px; border-radius: 8px; border: 2px solid #fbbf24; flex-shrink: 0;">
                    <ul style="color: #fff; font-size: 0.8rem; padding: 0; margin: 0; list-style: none; line-height: 1.3;">
                        <li style="margin-bottom: 4px;"><i class="fa-solid fa-check" style="color: #fbbf24; margin-right: 4px;"></i> Diminuir taxa de mortalidade</li>
                        <li style="margin-bottom: 4px;"><i class="fa-solid fa-check" style="color: #fbbf24; margin-right: 4px;"></i> Ambiente adequado p/ evitar doenças</li>
                        <li style="margin-bottom: 4px;"><i class="fa-solid fa-check" style="color: #fbbf24; margin-right: 4px;"></i> Alimentação para crescimento rápido</li>
                        <li><i class="fa-solid fa-check" style="color: #fbbf24; margin-right: 4px;"></i> Aumente seu lucro com o Ebook</li>
                    </ul>
                </div>

                <div class="order-bump-price-tag">
                    <div style="color: #888; text-decoration: line-through; font-size: 0.9rem; margin-bottom: 5px;">De R$ 69,90</div>
                    <div style="color: #fff; font-size: 0.8rem; margin-bottom: 2px;">TUDO ISSO POR APENAS</div>
                    <span style="color: #fbbf24; font-size: 1.6rem; font-weight: 900;">R$ ${price}</span>
                </div>
            </div>

            <div class="order-bump-actions" style="margin-top: 1rem;">
                <button class="btn-accept-bump" onclick="confirmUpsell('${method}')" style="background: #fbbf24; color: #000; width: 100%; border: none; padding: 12px; border-radius: 8px; font-weight: 800; cursor: pointer;">
                    SIM! PROTEGER MEUS PINTINHOS
                </button>
                <button class="btn-decline-bump" onclick="declineUpsell('${method}')" style="background: none; border: none; color: #888; text-decoration: underline; margin-top: 10px; cursor: pointer; display: block; width: 100%;">
                    Não, prefiro arriscar a vida deles.
                </button>
            </div>
        </div>
    `;

    obModal.classList.add('show');
}

function confirmUpsell(method) {
    midCheckoutUpsellPending = false;
    cart.bumps.push('ebook-manejo');
    updateTotal();
    const obModal = document.getElementById('order-bump-modal');
    if (obModal) obModal.classList.remove('show');
    handlePayment(method);
}

function declineUpsell(method) {
    midCheckoutUpsellPending = false;
    const obModal = document.getElementById('order-bump-modal');
    if (obModal) obModal.classList.remove('show');
    handlePayment(method);
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

function switchMethod(method) {
    // TRACK CHANGE FOR RENDER LOGS
    if (currentPaymentMethod !== method) {
        trackEvent('payment_method_selected', null, null, method);
    }
    currentPaymentMethod = method; // UPDATE STATE

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

        // CORREÇÃO: Placeholder do CPF para PIX
        const cpfInput = document.getElementById('payer-cpf');
        if (cpfInput) cpfInput.placeholder = 'Seu CPF';

    } else {
        if (cardArea) { cardArea.style.display = 'block'; setTimeout(() => cardArea.style.opacity = '1', 50); }
        if (pixIdentity) { pixIdentity.style.display = 'none'; }
        if (pixArea) { pixArea.style.opacity = '0'; setTimeout(() => pixArea.style.display = 'none', 300); }

        // CORREÇÃO: Placeholder do CPF para Cartão
        const cpfInput = document.getElementById('payer-cpf');
        if (cpfInput) cpfInput.placeholder = 'CPF do Titular do Cartão';
    }

    // RECALCULATE TOTAL WHEN SWITCHING
    if (cart.mainProduct) {
        renderOrderBumps(cart.mainProduct.fullBumps);
        updateTotal();
    }
}


let midCheckoutUpsellPending = true;

async function handlePayment(method) {
    // Interceptação para Upsell Mid-Checkout (Slide-in)
    if (midCheckoutUpsellPending && !cart.bumps.includes('ebook-manejo')) {
        showSlideInUpsell(method);
        return;
    }

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
            cpf: document.getElementById('payer-cpf').value ? document.getElementById('payer-cpf').value.replace(/\D/g, '') : '',
            cep: document.getElementById('card-cep').value ? document.getElementById('card-cep').value.replace(/\D/g, '') : ''
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
    cart.bumps.forEach(id => {
        const b = cart.mainProduct.fullBumps.find(x => x.id === id);
        if (b) items.push({ id: b.id, title: b.title, price: b.price });
    });

    if (method === 'pix') {
        const btn = document.getElementById('btn-pay-pix');
        const originalText = btn.innerText;

        // --- 🛡️ PIX LOGIC (ALWAYS NEW) ---
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
                deviceId: (mp && typeof mp.getDeviceId === 'function') ? mp.getDeviceId() : null
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
                // NOVO: Pagamento em análise - tratar como sucesso parcial
                alert('✅ Seu pagamento está sendo processado!\n\nVocê receberá a confirmação por e-mail em até 2 dias úteis.\n\nSe precisar de ajuda, entre em contato pelo WhatsApp.');
                checkoutModal.classList.remove('active');
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
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
            console.error("ERRO CRÍTICO CARTÃO:", e);
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

// Event Listeners with Order Bump Interception
document.getElementById('btn-pay-pix')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!validateCheckoutInputs('pix')) return;

    const intercepted = interceptPaymentButton(() => handlePayment('pix'));
    if (!intercepted) handlePayment('pix');
});

document.getElementById('btn-pay-card')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!validateCheckoutInputs('card')) return;

    const intercepted = interceptPaymentButton(() => handlePayment('card'));
    if (!intercepted) handlePayment('card');
});
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

    const copyBtn = document.getElementById('btn-copy-pix');
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
                        <p>Cole no app do seu banco para pagar.</p>
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

// --- 4. CHECKOUT COMPACTION & UX UTILS ---

function validateCheckoutInputs(method) {
    const email = document.getElementById('payer-email');
    const phone = document.getElementById('payer-phone');
    const name = (method === 'pix') ? document.getElementById('payer-name') : document.getElementById('card-holder');
    const cpf = document.getElementById('payer-cpf');
    const cep = (method === 'card') ? document.getElementById('card-cep') : null;

    let isValid = true;

    // Reset visual states
    const fields = [email, phone, name, cpf];
    if (cep) fields.push(cep);

    fields.forEach(el => el.classList.remove('is-invalid'));

    if (!email.value || !email.value.includes('@')) { email.classList.add('is-invalid'); isValid = false; }
    if (!phone.value || phone.value.replace(/\D/g, '').length < 10) { phone.classList.add('is-invalid'); isValid = false; }
    if (!name.value || name.value.trim().length < 3) { name.classList.add('is-invalid'); isValid = false; }
    if (!cpf.value || cpf.value.replace(/\D/g, '').length < 11) { cpf.classList.add('is-invalid'); isValid = false; }
    if (cep && (!cep.value || cep.value.replace(/\D/g, '').length < 8)) { cep.classList.add('is-invalid'); isValid = false; }

    if (!isValid) {
        // Log which fields failed validation
        const invalidFields = [];
        if (email.classList.contains('is-invalid')) invalidFields.push('email');
        if (phone.classList.contains('is-invalid')) invalidFields.push('phone');
        if (name.classList.contains('is-invalid')) invalidFields.push('name');
        if (cpf.classList.contains('is-invalid')) invalidFields.push('cpf');
        if (cep && cep.classList.contains('is-invalid')) invalidFields.push('cep');

        trackEvent('ui_error', null, null, `Erro Validação Frontend: ${invalidFields.join(', ')}`);

        fields.forEach(el => validateField(el, null, true));
        const firstError = document.querySelector('.is-invalid');
        if (firstError) firstError.focus();
    }

    return isValid;
}

// ⏳ Tooltip / Help Bubble Logic (5s Idle)
let helpTimer = null;
const HELP_MESSAGES = {
    'payer-email': 'Insira seu melhor e-mail para receber o acesso.',
    'payer-phone': 'Precisamos do seu WhatsApp para suporte técnico.',
    'payer-name': 'Digite seu nome completo conforme documento.',
    'payer-cpf': 'O CPF é necessário para emissão da sua nota fiscal.',
    'card-holder': 'Nome exatamente como está escrito no seu cartão.',
    'card-number': 'Digite os 16 números da frente do seu cartão.',
    'card-cep': 'CEP da sua residência para validação de segurança.'
};

function initHelpBubbles() {
    const inputs = document.querySelectorAll('.checkout-form input');

    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            clearTimeout(helpTimer);
            if (!input.value) {
                // Diminuído para 3 segundos conforme solicitado
                helpTimer = setTimeout(() => showHelpBubble(input), 3000);
            }
        });

        input.addEventListener('input', () => {
            clearTimeout(helpTimer);
            removeHelpBubbles();
        });

        input.addEventListener('blur', () => {
            clearTimeout(helpTimer);
            removeHelpBubbles();
            // Show error if empty OR invalid on blur
            validateField(input, null, true);
        });
    });
}

/**
 * Consolidated Validation Logic
 * Only shows error if field is not empty or if submission attempted.
 */
function validateField(input, type = null, forceShowError = false) {
    const id = input.id;
    const val = input.value.trim();
    const cleanVal = val.replace(/\D/g, '');
    let isValid = true;

    // Use explicit type if provided, otherwise infer from ID
    const validationType = type || (id.includes('cpf') ? 'cpf' : id.includes('phone') ? 'phone' : id.includes('email') ? 'email' : id.includes('number') ? 'card' : id.includes('expiration') ? 'date' : id.includes('cvv') ? 'cvv' : id.includes('cep') ? 'cep' : 'name');

    if (validationType === 'email') isValid = val.includes('@') && val.length > 5;
    else if (validationType === 'phone') isValid = cleanVal.length >= 10;
    else if (validationType === 'cpf') isValid = cleanVal.length === 11;
    else if (validationType === 'card') isValid = cleanVal.length >= 13 && cleanVal.length <= 16;
    else if (validationType === 'date') isValid = /^\d{2}\/\d{2}$/.test(val);
    else if (validationType === 'cvv') isValid = cleanVal.length >= 3;
    else if (validationType === 'cep') isValid = cleanVal.length === 8;
    else if (validationType === 'name' || id === 'card-holder') isValid = val.length >= 3;

    // UI Feedback logic
    if (val.length === 0 && !forceShowError) {
        input.classList.remove('is-valid', 'is-invalid');
    } else if (isValid) {
        input.classList.add('is-valid');
        input.classList.remove('is-invalid');
    } else if (forceShowError || val.length > 0) {
        // Only show invalid if there is content OR forceShowError (blur/submit)
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
    }
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
    if (rev != parseInt(cpf.charAt(9)))
        return false;
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

    const errorId = `error-${el.id}`;
    const errorEl = document.getElementById(errorId);

    if (!isValid && val.length > 0) {
        el.classList.add('input-error');
        if (errorEl) errorEl.style.display = 'block';
    } else {
        el.classList.remove('input-error');
        if (errorEl) errorEl.style.display = 'none';
    }

    return isValid;
}

function validateCheckoutInputs(method) {
    let allValid = true;
    const fields = ['payer-email', 'payer-phone'];

    if (method === 'pix') {
        fields.push('payer-name', 'payer-cpf');
    } else {
        fields.push('card-holder', 'payer-cpf', 'card-number', 'card-expiration', 'card-cvv');
    }

    fields.forEach(id => {
        const el = document.getElementById(id);
        const type = id.includes('email') ? 'email' : (id.includes('phone') ? 'phone' : (id.includes('cpf') ? 'cpf' : (id.includes('number') ? 'card' : (id.includes('expiration') ? 'date' : (id.includes('cvv') ? 'cvv' : 'text')))));
        if (!validateField(el, type)) allValid = false;
    });

    if (!allValid) {
        const container = document.getElementById('toast-container');
        if (container) {
            const toast = document.createElement('div');
            toast.className = 'toast-card';
            toast.style.borderColor = '#e74c3c';
            toast.innerHTML = `
                <div style="width: 40px; height: 40px; background: #e74c3c; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff;">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div class="toast-content">
                    <strong>Ops! Quase lá...</strong>
                    <p>Por favor, preencha corretamente todos os campos destacados em vermelho.</p>
                </div>
            `;
            container.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 4000);
        }
    }

    return allValid;
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
