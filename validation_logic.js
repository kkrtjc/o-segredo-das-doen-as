
// --- VALIDATION LOGIC ---

function validateCheckoutInputs(method) {
    let isValid = true;
    const inputsToValidate = [
        'payer-name',
        'payer-email',
        'payer-cpf',
        'payer-phone'
    ];

    if (method === 'card') {
        inputsToValidate.push('card-number', 'card-expiration', 'card-cvv', 'card-holder', 'card-cpf');
        // Remove payer-cpf validation if it's card mode (we use card-cpf instead, or keeping both if backend needs it)
        // User said: "quando for cartao esse CPF tem quee ser CPF DO TITULAR". 
        // We still need payer-cpf for the account creation/invoice maybe? 
        // Let's validate BOTH as they are both in the form and required.
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
});
