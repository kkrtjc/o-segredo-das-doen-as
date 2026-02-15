
// --- SMART FIELDS LOGIC ---
function setupSmartFields() {
    const inputs = document.querySelectorAll('.form-input');

    inputs.forEach(input => {
        let idleTimer = null;
        const tooltipText = input.getAttribute('data-tip');

        // Se não tiver tooltip configurado no HTML, ignora
        if (!tooltipText) return;

        // Encontra ou cria o elemento tooltip irmão
        // (Já criamos no HTML, mas vamos garantir a referência)
        const tooltipEl = input.parentElement.querySelector('.field-tooltip');

        if (!tooltipEl) return; // Segurança

        const showTooltip = () => {
            tooltipEl.classList.add('active');
        };

        const hideTooltip = () => {
            tooltipEl.classList.remove('active');
        };

        const resetTimer = () => {
            hideTooltip();
            clearTimeout(idleTimer);
            if (document.activeElement === input && input.value.length === 0) {
                // Só inicia o timer se o campo estiver vazio ou incompleto
                // O usuário pediu: "se clicar e ficar 3s sem preencher"
                idleTimer = setTimeout(showTooltip, 3000);
            }
        };

        // Eventos
        input.addEventListener('focus', resetTimer);

        input.addEventListener('input', (e) => {
            resetTimer();
            // Validações específicas em tempo real
            validateInputRealTime(e.target);
        });

        input.addEventListener('blur', () => {
            clearTimeout(idleTimer);
            hideTooltip();
        });
    });
}

function validateInputRealTime(input) {
    const id = input.id;
    let val = input.value;

    if (id === 'payer-cpf') {
        // Apenas números
        val = val.replace(/\D/g, '');
        // Máscara CPF: 000.000.000-00
        if (val.length > 11) val = val.slice(0, 11);

        if (val.length > 9) val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        else if (val.length > 6) val = val.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        else if (val.length > 3) val = val.replace(/(\d{3})(\d{1,3})/, '$1.$2');

        input.value = val;
    }
    else if (id === 'payer-phone') {
        // Apenas números
        val = val.replace(/\D/g, '');
        // Máscara Tel: (00) 00000-0000
        if (val.length > 11) val = val.slice(0, 11);

        if (val.length > 10) val = val.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        else if (val.length > 6) val = val.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        else if (val.length > 2) val = val.replace(/(\d{2})(\d{0,5})/, '($1) $2');

        input.value = val;
    }
    else if (id === 'card-number') {
        val = val.replace(/\D/g, '');
        // Máscara Cartão: 0000 0000 0000 0000
        val = val.replace(/(\d{4})(?=\d)/g, '$1 ');
        if (val.length > 19) val = val.slice(0, 19);
        input.value = val;
    }
    else if (id === 'card-expiration') {
        val = val.replace(/\D/g, '');
        if (val.length > 4) val = val.slice(0, 4);
        if (val.length > 2) val = val.replace(/(\d{2})(\d{1,2})/, '$1/$2');
        input.value = val;
    }
    else if (id === 'card-cvv') {
        val = val.replace(/\D/g, '');
        if (val.length > 4) val = val.slice(0, 4);
        input.value = val;
    }
    else if (id === 'card-cep') {
        val = val.replace(/\D/g, '');
        if (val.length > 8) val = val.slice(0, 8);
        if (val.length > 5) val = val.replace(/(\d{5})(\d{1,3})/, '$1-$2');
        input.value = val;
    }
    // Para nome e email, deixamos livre mas poderiamos barrar caracteres estranhos se necessário
}

// Inicializa
document.addEventListener('DOMContentLoaded', () => {
    setupSmartFields();
});
