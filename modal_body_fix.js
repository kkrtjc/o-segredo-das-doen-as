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
