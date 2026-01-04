document.addEventListener('DOMContentLoaded', () => {

    // --- 1. FAQ Accordion Logic ---
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            const isOpen = item.classList.contains('active');

            // Close all others
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                otherItem.classList.remove('active');
            });

            // Toggle current if it wasn't open
            if (!isOpen) {
                item.classList.add('active');
            }
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
                    top: targetElement.offsetTop - 80, // Offset for fixed header
                    behavior: 'smooth'
                });
            }
        });
    });

    // --- 3. Header Transparency ---
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.background = 'rgba(0, 0, 0, 0.98)';
            header.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
        } else {
            header.style.background = 'rgba(0, 0, 0, 0.8)';
            header.style.boxShadow = 'none';
        }
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

    function createTestimonialCard(t) {
        const starsHTML = '<i class="fa-solid fa-star" style="color: #FFD700;"></i>'.repeat(t.stars);
        const card = document.createElement('div');
        card.className = 'testimonial-card-original';
        // Fixed width for carousel items ensures smooth animation
        card.style.minWidth = '300px';
        card.style.maxWidth = '300px';
        card.style.textAlign = 'left';
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
                    <div style="margin-top: 0.2rem; font-size: 0.7rem; color: #FFD700;">
                        ${starsHTML}
                    </div>
                </div>
            </div>
        `;
        return card;
    }

    if (testimonialsTrack) {
        // Double the array to create seamless loop
        const loopContent = [...testimonials, ...testimonials, ...testimonials]; // Triple to be safe for wide screens

        loopContent.forEach(t => {
            testimonialsTrack.appendChild(createTestimonialCard(t));
        });
    }

    // --- 4.1 Floating Testimonials & Sales Notifications ---
    const toastContainer = document.getElementById('toast-container');



    // --- 6. Sticky CTA Logic ---
    const stickyCta = document.querySelector('.sticky-cta-bar');
    const heroSection = document.querySelector('.hero');

    if (stickyCta && heroSection) {
        window.addEventListener('scroll', () => {
            const triggerPoint = heroSection.offsetHeight - 200; // Show a bit before hero ends
            if (window.scrollY > triggerPoint) {
                stickyCta.classList.add('visible');
            } else {
                stickyCta.classList.remove('visible');
            }
        });
    }





    // A) Track "InitiateCheckout" on all Buy Buttons
    const buyButtons = document.querySelectorAll('a[href*="kiwify"]');
    buyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Facebook
            if (typeof fbq === 'function') {
                fbq('track', 'InitiateCheckout');
            }
            // TikTok
            if (typeof ttq === 'object') {
                ttq.track('ClickButton');
                ttq.track('InitiateCheckout');
            }
        });
    });

    // B) Track "Time on Page: 15 Seconds"
    setTimeout(() => {
        if (typeof fbq === 'function') {
            fbq('trackCustom', 'TimeSpent_15s');
            fbq('track', 'ViewContent');
        }
    }, 15000);

});

