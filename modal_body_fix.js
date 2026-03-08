// Mobile Checkout Modal Fix - Apply body class to prevent background scroll
(function () {
    let scrollPos = 0;

    function lockScroll() {
        scrollPos = window.pageYOffset;
        document.body.style.top = `-${scrollPos}px`;
        document.body.classList.add('modal-open');
        document.documentElement.classList.add('modal-open');
    }

    function unlockScroll() {
        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
        document.body.style.top = '';
        window.scrollTo(0, scrollPos);
    }

    // Get all modal elements
    const modalElements = document.querySelectorAll('.modal-overlay, [id*="modal"], [id*="checkout"]');

    // Create a MutationObserver to watch for modal display changes
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                const isActive = target.classList.contains('active') || target.classList.contains('show');

                if (isActive) {
                    lockScroll();
                } else {
                    // Check if ANY other modal is still open before unlocking
                    const anyModalOpen = Array.from(modalElements).some(m => 
                        m.classList.contains('active') || m.classList.contains('show')
                    );
                    if (!anyModalOpen) {
                        unlockScroll();
                    }
                }
            }
        });
    });

    // Observe each modal for class changes
    modalElements.forEach(function (modal) {
        observer.observe(modal, {
            attributes: true,
            attributeFilter: ['class']
        });
    });
})();
