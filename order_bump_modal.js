// Order Bump Modal Logic
let orderBumpShown = false;
let orderBumpAccepted = false;
let pendingPaymentAction = null;

// Intercept payment button clicks
function interceptPaymentButton(callback) {
    if (!orderBumpShown && !orderBumpAccepted) {
        // Store the payment action to execute after bump decision
        pendingPaymentAction = callback;
        showOrderBumpModal();
        return true; // Intercepted
    }
    return false; // Not intercepted, proceed normally
}

function showOrderBumpModal() {
    const modal = document.getElementById('order-bump-modal');
    if (modal && !orderBumpShown) {
        modal.classList.add('show');
        orderBumpShown = true;
    }
}

function closeOrderBumpModal() {
    const modal = document.getElementById('order-bump-modal');
    if (modal) {
        modal.classList.remove('show');
    }

    // Execute pending payment action after closing
    if (pendingPaymentAction) {
        setTimeout(() => {
            pendingPaymentAction();
            pendingPaymentAction = null;
        }, 300); // Wait for modal close animation
    }
}

function acceptOrderBump() {
    // Add the order bump to cart
    const bumpId = 'bump-6361'; // ID do order bump da tabela de ração

    if (!cart.bumps.includes(bumpId)) {
        cart.bumps.push(bumpId);
        orderBumpAccepted = true;
        updateTotal();
    }

    closeOrderBumpModal();

    // Show success feedback
    const feedback = document.createElement('div');
    feedback.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: var(--color-secondary); color: #000; padding: 1rem 2rem; border-radius: 10px; font-weight: 700; z-index: 10002;';
    feedback.innerHTML = '<i class="fa-solid fa-check"></i> Tabela de Ração adicionada!';
    document.body.appendChild(feedback);

    setTimeout(() => {
        feedback.remove();
    }, 2000);
}
