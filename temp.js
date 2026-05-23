
        let currentPass = '';
        let currentTab = 'dashboard';
        let configDataCache = null;
        let globalAnalytics = null;
        let globalHistory = null;

        const WORKER_URL = 'https://mura-api.joaopaulojaguar.workers.dev';

        // Init
        window.addEventListener('DOMContentLoaded', () => {
            const savedPass = localStorage.getItem('mura_admin_pass') || '';
            
            // Enter key on login
            document.getElementById('admin-pass').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') doLogin();
            });

            if (savedPass) {
                currentPass = savedPass;
                validateFastLogin();
            }
        });

        function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 2500);
        }

        async function doLogin() {
            const passInput = document.getElementById('admin-pass');
            const btn = passInput.nextElementSibling;
            const pass = passInput.value.trim();
            if (!pass) { alert('Digite a senha.'); return; }

            currentPass = pass;
            if (btn) { btn.textContent = 'Entrando...'; btn.disabled = true; }

            try {
                const res = await fetch(`${WORKER_URL}/api/history`, {
                    headers: { 'x-admin-password': currentPass }
                });
                if (res.ok) {
                    localStorage.setItem('mura_admin_pass', currentPass);
                    activateApp();
                } else {
                    localStorage.removeItem('mura_admin_pass');
                    currentPass = '';
                    alert('Senha incorreta. Tente novamente.');
                }
            } catch (e) {
                alert('Erro de conexão com o servidor. Verifique sua internet.');
                console.error('Login error:', e);
            } finally {
                if (btn) { btn.textContent = 'Entrar'; btn.disabled = false; }
            }
        }

        async function validateFastLogin() {
            try {
                const res = await fetch(`${WORKER_URL}/api/history?limit=1`, {
                    headers: { 'x-admin-password': currentPass }
                });
                if (res.ok) {
                    activateApp();
                } else {
                    localStorage.removeItem('mura_admin_pass');
                    currentPass = '';
                }
            } catch (e) {
                // Offline ou timeout — deixa o usuário logar manualmente
                localStorage.removeItem('mura_admin_pass');
                currentPass = '';
            }
        }

        function activateApp() {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-header').style.display = 'flex';
            document.getElementById('app-main').style.display = 'block';
            document.getElementById('app-nav').style.display = 'flex';
            loadCurrentTab();
        }

        function toggleCustomDate(selectId, rowId) {
            const select = document.getElementById(selectId);
            const row = document.getElementById(rowId);
            if (select.value === 'custom') {
                row.style.display = 'block';
            } else {
                row.style.display = 'none';
            }
        }

        function logout() {
            localStorage.removeItem('mura_admin_pass');
            location.reload();
        }

        function switchTab(tabId, el, title) {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            if(el) el.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            
            document.getElementById('header-title').textContent = title;
            currentTab = tabId;
            loadCurrentTab();
            window.scrollTo(0, 0);
        }

        function loadCurrentTab() {
            if(currentTab === 'dashboard') loadDashboard();
            if(currentTab === 'amazon') loadDashboard();
            if(currentTab === 'amazon') renderAmazonStats();
            if(currentTab === 'vsl') renderVslStats();
            if(currentTab === 'abandons') loadAbandons();
            if(currentTab === 'pix') loadPixHistory();
            if(currentTab === 'products') loadProducts();
        }

        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
        const parsePhone = (raw) => {
            if(!raw) return '';
            let n = raw.replace(/\D/g, '');
            if(n.length === 11 || n.length === 10) return `55${n}`;
            return n;
        };

        async function loadDashboard() {
            const refreshBtn = document.querySelector('.refresh-btn');
            if (refreshBtn) refreshBtn.classList.add('spinning');
            
            try {
                // Cache busting with timestamp
                const ts = Date.now();
                const [resA, resH] = await Promise.all([
                    fetch(`${WORKER_URL}/api/analytics?t=${ts}`, { headers: { 'x-admin-password': currentPass } }),
                    fetch(`${WORKER_URL}/api/history?t=${ts}`, { headers: { 'x-admin-password': currentPass } })
                ]);
                
                if (!resA.ok || !resH.ok) throw new Error("Falha ao carregar dados do servidor");
                
                globalAnalytics = await resA.json();
                globalHistory = await resH.json();
                
                renderDashboardStats();
                if (currentTab === 'amazon') renderAmazonStats();
                if (currentTab === 'vsl') renderVslStats();
                
                if (refreshBtn) {
                    setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
                }
            } catch(e) {
                console.error("Dashboard error", e);
                showToast("Erro ao sincronizar dados");
                if (refreshBtn) refreshBtn.classList.remove('spinning');
            }
        }

        function renderDashboardStats() {
            try {
                if(!globalAnalytics || !globalHistory) return;
                
                const filter = document.getElementById('period-filter').value;
                let agg = { visits: 0, checkouts: 0, sales: 0, abandons: 0, revenue: 0 };

                if(filter === 'all') {
                    agg.visits = (globalAnalytics.totals?.uniqueVisits || 0) + (globalAnalytics.totals?.uniqueVisits_app || 0);
                    agg.checkouts = (globalAnalytics.totals?.checkoutOpens || 0) + (globalAnalytics.totals?.checkoutOpens_app || 0);
                    agg.abandons = (globalAnalytics.totals?.checkoutAbandons || 0) + (globalAnalytics.totals?.checkoutAbandons_app || 0);
                    
                    const validHistory = Array.isArray(globalHistory) ? globalHistory.filter(h => h && h.total > 0 && !(h.items || []).some(i => i.includes('[AMZ]')) && (h.site === 'app' || h.site === 'text' || !h.site) && h.site !== 'vsl') : [];
                    agg.sales = validHistory.length;
                    agg.revenue = validHistory.reduce((a, s) => a + Number(s.total), 0);
                } else {
                    const datesToKeep = [];
                    const now = new Date();
                    
                    const getLocalDate = (d) => {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    };
                    
                    if (filter === 'today') {
                        datesToKeep.push(getLocalDate(now));
                    } else if (filter === 'yesterday') {
                        const y = new Date(now);
                        y.setDate(now.getDate() - 1);
                        datesToKeep.push(getLocalDate(y));
                    } else if (filter === '7days') {
                        for(let i=0; i<7; i++) {
                            const d = new Date(now);
                            d.setDate(now.getDate() - i);
                            datesToKeep.push(getLocalDate(d));
                        }
                    } else if (filter === 'custom') {
                        const start = document.getElementById('date-start').value;
                        const end = document.getElementById('date-end').value;
                        if (start && end) {
                            const d1 = new Date(start + 'T00:00:00');
                            const d2 = new Date(end + 'T23:59:59');
                            let current = new Date(d1);
                            while(current <= d2) {
                                datesToKeep.push(getLocalDate(current));
                                current.setDate(current.getDate() + 1);
                            }
                        }
                    }

                    const daily = globalAnalytics.daily || {};
                    datesToKeep.forEach(dStr => {
                        if (daily[dStr]) {
                            agg.visits += (daily[dStr].uniqueVisits || daily[dStr].pageViews || 0) + (daily[dStr].uniqueVisits_app || 0);
                            agg.checkouts += (daily[dStr].checkoutOpens || daily[dStr].checkoutStarts || 0) + (daily[dStr].checkoutOpens_app || 0);
                            agg.abandons += (daily[dStr].checkoutAbandons || 0) + (daily[dStr].checkoutAbandons_app || 0);
                        }
                    });

                    // Compute sales and revenue from history arrays (including 'app' and excluding Amazon/VSL)
                    const validHistory = Array.isArray(globalHistory) ? globalHistory.filter(h => h && h.total > 0 && !(h.items || []).some(i => i.includes('[AMZ]')) && (h.site === 'app' || h.site === 'text' || !h.site) && h.site !== 'vsl') : [];
                    validHistory.forEach(sale => {
                        const saleDateObj = new Date(sale.date || Date.now());
                        const saleLocalDate = getLocalDate(saleDateObj);
                        
                        if(datesToKeep.includes(saleLocalDate)) {
                            agg.sales++;
                            agg.revenue += (Number(sale.total) || 0);
                        }
                    });
                }

                document.getElementById('val-visits').textContent = agg.visits;
                document.getElementById('val-checkouts').textContent = agg.checkouts;
                document.getElementById('val-sales').textContent = agg.sales;
                document.getElementById('val-abandons').textContent = agg.abandons;
                document.getElementById('val-revenue').textContent = formatBRL(agg.revenue);
                
                if (currentTab === 'amazon') renderAmazonStats();
                if (currentTab === 'vsl') renderVslStats();
            } catch(e) {
                console.error("Render stats error:", e);
            }
        }

        async function renderAmazonStats() {
            try {
                if(!globalAnalytics || !globalHistory) return;
                
                const filter = document.getElementById('period-filter-amazon').value;
                let agg = { visits: 0, checkouts: 0, sales: 0, abandons: 0, revenue: 0 };
                let amazonSalesList = [];

                if(filter === 'all') {
                    agg.visits = globalAnalytics.totals?.uniqueVisits_amazon || 0;
                    agg.checkouts = globalAnalytics.totals?.checkoutOpens_amazon || 0;
                    agg.abandons = globalAnalytics.totals?.checkoutAbandons_amazon || 0;
                    
                    const validHistory = Array.isArray(globalHistory) ? globalHistory.filter(h => h && h.total > 0 && (h.items || []).some(i => i.includes('[AMZ]'))) : [];
                    agg.sales = validHistory.length;
                    agg.revenue = validHistory.reduce((a, s) => a + Number(s.total), 0);
                    amazonSalesList = validHistory;
                } else {
                    const datesToKeep = [];
                    const now = new Date();
                    
                    const getLocalDate = (d) => {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    };
                    
                    if (filter === 'today') {
                        datesToKeep.push(getLocalDate(now));
                    } else if (filter === 'yesterday') {
                        const y = new Date(now);
                        y.setDate(now.getDate() - 1);
                        datesToKeep.push(getLocalDate(y));
                    } else if (filter === '7days') {
                        for(let i=0; i<7; i++) {
                            const d = new Date(now);
                            d.setDate(now.getDate() - i);
                            datesToKeep.push(getLocalDate(d));
                        }
                    } else if (filter === 'custom') {
                        const start = document.getElementById('date-start-amz').value;
                        const end = document.getElementById('date-end-amz').value;
                        if (start && end) {
                            const d1 = new Date(start + 'T00:00:00');
                            const d2 = new Date(end + 'T23:59:59');
                            let current = new Date(d1);
                            while(current <= d2) {
                                datesToKeep.push(getLocalDate(current));
                                current.setDate(current.getDate() + 1);
                            }
                        }
                    }

                    const daily = globalAnalytics.daily || {};
                    datesToKeep.forEach(dStr => {
                        if (daily[dStr]) {
                            agg.visits += daily[dStr].uniqueVisits_amazon || 0;
                            agg.checkouts += daily[dStr].checkoutOpens_amazon || 0;
                            agg.abandons += daily[dStr].checkoutAbandons_amazon || 0;
                        }
                    });

                    // Compute sales and revenue from history arrays (only Amazon)
                    const validHistory = Array.isArray(globalHistory) ? globalHistory.filter(h => h && h.total > 0 && (h.items || []).some(i => i.includes('[AMZ]'))) : [];
                    validHistory.forEach(sale => {
                        const saleDateObj = new Date(sale.date || Date.now());
                        const saleLocalDate = getLocalDate(saleDateObj);
                        
                        if(datesToKeep.includes(saleLocalDate)) {
                            agg.sales++;
                            agg.revenue += (Number(sale.total) || 0);
                            amazonSalesList.push(sale);
                        }
                    });
                }

                document.getElementById('val-visits-amz').textContent = agg.visits;
                document.getElementById('val-checkouts-amz').textContent = agg.checkouts;
                document.getElementById('val-sales-amz').textContent = agg.sales;
                document.getElementById('val-abandons-amz').textContent = agg.abandons;
                document.getElementById('val-revenue-amz').textContent = formatBRL(agg.revenue);

                // Render sales list
                const listEl = document.getElementById('amazon-sales-list');
                if(amazonSalesList.length === 0) {
                    listEl.innerHTML = '<div class="empty-state">Nenhuma venda da Amazon neste período.</div>';
                } else {
                    amazonSalesList.sort((a,b) => new Date(b.date) - new Date(a.date));
                    let html = '';
                    amazonSalesList.forEach(sale => {
                        const isPix = sale.method === 'pix';
                        const methodStr = isPix ? 'PIX' : 'Cartão';
                        const methodColor = isPix ? 'var(--ios-green)' : 'var(--ios-blue)';
                        const dataObj = new Date(sale.date || Date.now());
                        const dStr = dataObj.toLocaleDateString() + ' ' + dataObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        
                        const phone = sale.phone || sale.customer?.phone || '';
                        const cleanPhone = parsePhone(phone);
                        const groupMsg = encodeURIComponent('Olá! Parabéns pela sua compra. Acesse o nosso grupo VIP exclusivo aqui: https://chat.whatsapp.com/JXkGitHbLd3AeY8LqiLdYB');

                        html += `
                        <div class="list-item">
                            <div class="list-item-title">${sale.name || sale.customer?.name || 'Sem Nome'} <span style="font-size: 11px; background: ${methodColor}; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">${methodStr}</span></div>
                            <div class="list-item-sub"><i class="fa-regular fa-envelope"></i> ${sale.email || sale.customer?.email || 'Sem email'}</div>
                            <div class="list-item-sub"><i class="fa-solid fa-phone"></i> ${phone || 'Sem celular'}</div>
                            <div class="list-item-right" style="color:var(--ios-text);">${formatBRL(sale.total)}</div>
                            <div class="list-item-sub" style="margin-top: 4px; font-size:11px;">Data: ${dStr}</div>
                            <div class="list-item-sub" style="font-size:11px; color: var(--ios-blue);">Produtos: ${sale.items?.join(', ') || 'N/A'}</div>
                            <div class="action-row">
                                ${cleanPhone ? \`<a href="https://wa.me/\${cleanPhone}?text=\${groupMsg}" target="_blank" class="btn-small btn-green"><i class="fa-brands fa-whatsapp"></i> Adicionar ao Grupo</a>\` : ''}
                            </div>
                        </div>`;
                    });
                    listEl.innerHTML = html;
                }

                // Render Amazon Abandons
                const abandonsRes = await fetch('https://mura-api.joaopaulojaguar.workers.dev/api/abandons', { headers: { 'x-admin-password': currentPass } });
                const abandonsData = await abandonsRes.json();
                const amzAbandonsList = document.getElementById('amazon-abandons-list');
                
                if(!Array.isArray(abandonsData)) {
                    amzAbandonsList.innerHTML = '<div class="empty-state">Erro ao carregar abandonos.</div>';
                } else {
                    const amzAbandons = abandonsData.filter(a => {
                        if (a.site !== 'amazon') return false;
                        if (a.paid) return false;
                        if (a.pixId && globalHistory && globalHistory.some(h => String(h.paymentId) === String(a.pixId))) return false;
                        return true;
                    });
                    if(amzAbandons.length === 0) {
                        amzAbandonsList.innerHTML = '<div class="empty-state">Nenhum abandono da Amazon.</div>';
                    } else {
                        amzAbandons.sort((a,b) => new Date(b.date) - new Date(a.date));
                        let htmlAb = '';
                        amzAbandons.forEach(item => {
                            const nome = item.name || 'Desconhecido';
                            const email = item.email || 'Sem email';
                            const phone = item.phone || 'Sem celular';
                            const dataObj = new Date(item.date || Date.now());
                            const dStr = dataObj.toLocaleDateString() + ' às ' + dataObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            const cleanPhone = parsePhone(phone);
                            
                            htmlAb += `
                            <div class="list-item">
                                <div class="list-item-title">${nome}</div>
                                <div class="list-item-sub"><i class="fa-regular fa-envelope"></i> ${email}</div>
                                <div class="list-item-sub"><i class="fa-solid fa-phone"></i> ${phone}</div>
                                <div class="list-item-sub" style="margin-top: 4px; font-size:11px;">Capturado em: ${dStr}</div>
                                
                                <div class="action-row">
                                    ${cleanPhone ? `<a href="https://wa.me/${cleanPhone}" target="_blank" class="btn-small btn-green"><i class="fa-brands fa-whatsapp"></i> Chamar</a>` : ''}
                                </div>
                            </div>`;
                        });
                        amzAbandonsList.innerHTML = htmlAb;
                    }
                }

            } catch(e) {
                console.error("Render amazon stats error:", e);
            }
        }

        // TAB 2: ABANDONS
        async function loadAbandons() {
            const list = document.getElementById('abandons-list');
            list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
            try {
                const res = await fetch('https://mura-api.joaopaulojaguar.workers.dev/api/abandons', { headers: { 'x-admin-password': currentPass } });
                const data = await res.json();
                
                if(!Array.isArray(data) || data.length === 0) {
                    list.innerHTML = `<div class="empty-state">${Array.isArray(data) ? 'Nenhum abandono capturado ainda.' : 'Acesso Negado ou dados inválidos'}</div>`;
                    return;
                }

                // Filter out Amazon and Paid (Cross-check with history to fix retroactively)
                const officialAbandons = data.filter(a => {
                    if (a.site === 'amazon') return false;
                    if (a.paid) return false;
                    if (a.pixId && globalHistory && globalHistory.some(h => String(h.paymentId) === String(a.pixId))) return false;
                    return true;
                });

                if (officialAbandons.length === 0) {
                    list.innerHTML = `<div class="empty-state">Nenhum abandono capturado ainda.</div>`;
                    return;
                }

                officialAbandons.sort((a,b) => new Date(b.date) - new Date(a.date));

                let html = '';
                officialAbandons.forEach(item => {
                    const nome = item.name || 'Desconhecido';
                    const email = item.email || 'Sem email';
                    const phone = item.phone || 'Sem celular';
                    const dataObj = new Date(item.date || Date.now());
                    const dStr = dataObj.toLocaleDateString() + ' às ' + dataObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const cleanPhone = parsePhone(phone);
                    
                    html += `
                    <div class="list-item">
                        <div class="list-item-title">${nome}</div>
                        <div class="list-item-sub"><i class="fa-regular fa-envelope"></i> ${email}</div>
                        <div class="list-item-sub"><i class="fa-solid fa-phone"></i> ${phone}</div>
                        <div class="list-item-sub" style="margin-top: 4px; font-size:11px;">Capturado em: ${dStr}</div>
                        
                        <div class="action-row">
                            ${cleanPhone ? `<a href="https://wa.me/${cleanPhone}" target="_blank" class="btn-small btn-green"><i class="fa-brands fa-whatsapp"></i> Chamar Admin</a>` : ''}
                        </div>
                    </div>`;
                });
                list.innerHTML = html;
            } catch(e) {
                list.innerHTML = `<div class="empty-state" style="color:var(--ios-red);">Erro: ${e.message}</div>`;
            }
        }

        // TAB 3: PIX / SALES
        async function loadPixHistory() {
            const list = document.getElementById('pix-list');
            list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
            try {
                const res = await fetch('https://mura-api.joaopaulojaguar.workers.dev/api/history', { headers: { 'x-admin-password': currentPass } });
                const data = await res.json();
                
                if(!Array.isArray(data)) {
                    list.innerHTML = '<div class="empty-state">Erro: Dados inválidos recebidos.</div>';
                    return;
                }
                
                // Filly only with actual data generated and exclude Amazon
                const sales = data.filter(h => h && (h.name || h.customer?.name) && !(h.items || []).some(i => i.includes('[AMZ]')));
                
                if(sales.length === 0) {
                    list.innerHTML = '<div class="empty-state">Nenhuma venda/PIX gerado.</div>';
                    return;
                }

                sales.sort((a,b) => new Date(b.date) - new Date(a.date));

                let html = '';
                sales.forEach(sale => {
                    const isPix = sale.method === 'pix';
                    const methodStr = isPix ? 'PIX' : 'Cartão';
                    const methodColor = isPix ? 'var(--ios-green)' : 'var(--ios-blue)';
                    
                    const dataObj = new Date(sale.date || Date.now());
                    const dStr = dataObj.toLocaleDateString() + ' ' + dataObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    const phone = sale.phone || sale.customer?.phone || '';
                    const cleanPhone = parsePhone(phone);
                    const groupMsg = encodeURIComponent('Olá! Parabéns pela sua compra. Acesse o nosso grupo VIP exclusivo aqui: https://chat.whatsapp.com/JXkGitHbLd3AeY8LqiLdYB');

                    html += `
                    <div class="list-item">
                        <div class="list-item-title">${sale.name || sale.customer?.name || 'Sem Nome'} <span style="font-size: 11px; background: ${methodColor}; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">${methodStr}</span></div>
                        <div class="list-item-sub"><i class="fa-regular fa-envelope"></i> ${sale.email || sale.customer?.email || 'Sem email'}</div>
                        <div class="list-item-sub"><i class="fa-solid fa-phone"></i> ${phone || 'Sem celular'}</div>
                        <div class="list-item-right" style="color:var(--ios-text);">${formatBRL(sale.total)}</div>
                        <div class="list-item-sub" style="margin-top: 4px; font-size:11px;">Data: ${dStr}</div>
                        <div class="list-item-sub" style="font-size:11px; color: var(--ios-blue);">Produtos: ${sale.items?.join(', ') || 'N/A'}</div>
                        <div class="action-row">
                            ${cleanPhone ? \`<a href="https://wa.me/\${cleanPhone}?text=\${groupMsg}" target="_blank" class="btn-small btn-green"><i class="fa-brands fa-whatsapp"></i> Adicionar ao Grupo</a>\` : ''}
                        </div>
                    </div>`;
                });
                list.innerHTML = html;
            } catch(e) {
                list.innerHTML = `<div class="empty-state" style="color:var(--ios-red);">Erro: ${e.message}</div>`;
            }
        }

        async function renderVslStats() {
            try {
                if(!globalAnalytics || !globalHistory) return;
                
                const filter = document.getElementById('period-filter-vsl').value;
                let agg = { visits: 0, checkouts: 0, sales: 0, abandons: 0, revenue: 0 };
                let vslSalesList = [];

                if(filter === 'all') {
                    agg.visits = globalAnalytics.totals?.uniqueVisits_vsl || 0;
                    agg.checkouts = globalAnalytics.totals?.checkoutOpens_vsl || 0;
                    agg.abandons = globalAnalytics.totals?.checkoutAbandons_vsl || 0;
                    
                    const validHistory = Array.isArray(globalHistory) ? globalHistory.filter(h => h && h.total > 0 && h.site === 'vsl') : [];
                    agg.sales = validHistory.length;
                    agg.revenue = validHistory.reduce((a, s) => a + Number(s.total), 0);
                    vslSalesList = validHistory;
                } else {
                    const datesToKeep = [];
                    const now = new Date();
                    
                    const getLocalDate = (d) => {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    };
                    
                    if (filter === 'today') datesToKeep.push(getLocalDate(now));
                    else if (filter === 'yesterday') {
                        const y = new Date(now);
                        y.setDate(now.getDate() - 1);
                        datesToKeep.push(getLocalDate(y));
                    } else if (filter === '7days') {
                        for(let i=0; i<7; i++) {
                            const d = new Date(now);
                            d.setDate(now.getDate() - i);
                            datesToKeep.push(getLocalDate(d));
                        }
                    } else if (filter === 'custom') {
                        const start = document.getElementById('date-start-vsl').value;
                        const end = document.getElementById('date-end-vsl').value;
                        if (start && end) {
                            const d1 = new Date(start + 'T00:00:00');
                            const d2 = new Date(end + 'T23:59:59');
                            let current = new Date(d1);
                            while(current <= d2) {
                                datesToKeep.push(getLocalDate(current));
                                current.setDate(current.getDate() + 1);
                            }
                        }
                    }

                    const daily = globalAnalytics.daily || {};
                    datesToKeep.forEach(dStr => {
                        if (daily[dStr]) {
                            agg.visits += daily[dStr].uniqueVisits_vsl || 0;
                            agg.checkouts += daily[dStr].checkoutOpens_vsl || 0;
                            agg.abandons += daily[dStr].checkoutAbandons_vsl || 0;
                        }
                    });

                    const validHistory = Array.isArray(globalHistory) ? globalHistory.filter(h => h && h.total > 0 && h.site === 'vsl') : [];
                    validHistory.forEach(sale => {
                        const saleDateObj = new Date(sale.date || Date.now());
                        const saleLocalDate = getLocalDate(saleDateObj);
                        if(datesToKeep.includes(saleLocalDate)) {
                            agg.sales++;
                            agg.revenue += (Number(sale.total) || 0);
                            vslSalesList.push(sale);
                        }
                    });
                }

                document.getElementById('val-visits-vsl').textContent = agg.visits;
                document.getElementById('val-checkouts-vsl').textContent = agg.checkouts;
                document.getElementById('val-sales-vsl').textContent = agg.sales;
                document.getElementById('val-abandons-vsl').textContent = agg.abandons;
                document.getElementById('val-revenue-vsl').textContent = formatBRL(agg.revenue);

                const listEl = document.getElementById('vsl-sales-list');
                if(vslSalesList.length === 0) {
                    listEl.innerHTML = '<div class="empty-state">Nenhuma venda VSL neste período.</div>';
                } else {
                    vslSalesList.sort((a,b) => new Date(b.date) - new Date(a.date));
                    let html = '';
                    vslSalesList.forEach(sale => {
                        const isPix = sale.method === 'pix';
                        const methodStr = isPix ? 'PIX' : 'Cartão';
                        const methodColor = isPix ? 'var(--ios-green)' : 'var(--ios-blue)';
                        const dataObj = new Date(sale.date || Date.now());
                        const dStr = dataObj.toLocaleDateString() + ' ' + dataObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        
                        const phone = sale.phone || sale.customer?.phone || '';
                        const cleanPhone = parsePhone(phone);
                        const groupMsg = encodeURIComponent('Olá! Parabéns pela sua compra. Acesse o nosso grupo VIP exclusivo aqui: https://chat.whatsapp.com/JXkGitHbLd3AeY8LqiLdYB');

                        html += `
                        <div class="list-item">
                            <div class="list-item-title">${sale.name || sale.customer?.name || 'Sem Nome'} <span style="font-size: 11px; background: ${methodColor}; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">${methodStr}</span></div>
                            <div class="list-item-sub"><i class="fa-regular fa-envelope"></i> ${sale.email || sale.customer?.email || 'Sem email'}</div>
                            <div class="list-item-sub"><i class="fa-solid fa-phone"></i> ${phone || 'Sem celular'}</div>
                            <div class="list-item-right" style="color:var(--ios-text);">${formatBRL(sale.total)}</div>
                            <div class="list-item-sub" style="margin-top: 4px; font-size:11px;">Data: ${dStr}</div>
                            <div class="list-item-sub" style="font-size:11px; color: var(--ios-blue);">Produtos: ${sale.items?.join(', ') || 'N/A'}</div>
                            <div class="action-row">
                                ${cleanPhone ? \`<a href="https://wa.me/\${cleanPhone}?text=\${groupMsg}" target="_blank" class="btn-small btn-green"><i class="fa-brands fa-whatsapp"></i> Adicionar ao Grupo</a>\` : ''}
                            </div>
                        </div>`;
                    });
                    listEl.innerHTML = html;
                }
            } catch(e) {
                console.error("Render VSL stats error:", e);
            }
        }

        // TAB 4: PRODUCTS
        async function loadProducts() {
            const list = document.getElementById('products-list');
            list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
            try {
                const res = await fetch('https://mura-api.joaopaulojaguar.workers.dev/api/config');
                configDataCache = await res.json();
                
                const products = configDataCache.products || {};
                const bumps = configDataCache.orderBumps || {};
                
                const pKeys = Object.keys(products);
                const bKeys = Object.keys(bumps);
                
                if(pKeys.length === 0 && bKeys.length === 0) {
                    list.innerHTML = '<div class="empty-state">Nenhum produto cadastrado.</div>';
                    return;
                }

                let html = '';
                
                pKeys.forEach(id => {
                    const p = products[id];
                    html += `
                    <div class="list-item">
                        <div class="list-item-title">${p.title}</div>
                        <div class="list-item-sub">ID: ${id} <span style="background:var(--ios-blue);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:5px;">Produto</span></div>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 13px; color: var(--ios-text);">Preço (R$):</span>
                            <input type="number" step="0.01" id="price-${id}" value="${p.price}" style="flex:1; padding: 6px; border-radius: 6px; border: 1px solid var(--ios-border); background: var(--ios-bg);">
                            <button class="btn-small" onclick="updateLocalPrice('product', '${id}')">Salvar</button>
                        </div>
                    </div>`;
                });

                bKeys.forEach(id => {
                    const p = bumps[id];
                    html += `
                    <div class="list-item">
                        <div class="list-item-title">${p.title}</div>
                        <div class="list-item-sub">ID: ${id} <span style="background:var(--ios-green);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:5px;">Order Bump</span></div>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 13px; color: var(--ios-text);">Preço (R$):</span>
                            <input type="number" step="0.01" id="price-${id}" value="${p.price}" style="flex:1; padding: 6px; border-radius: 6px; border: 1px solid var(--ios-border); background: var(--ios-bg);">
                            <button class="btn-small" onclick="updateLocalPrice('bump', '${id}')">Salvar</button>
                        </div>
                    </div>`;
                });
                
                list.innerHTML = html;
            } catch(e) {
                list.innerHTML = `<div class="empty-state" style="color:var(--ios-red);">Erro: ${e.message}</div>`;
            }
        }

        function updateLocalPrice(type, id) {
            const el = document.getElementById(`price-${id}`);
            if(!el) return;
            const newVal = parseFloat(el.value);
            if(isNaN(newVal)) return alert("Preço inválido");
            
            if (type === 'product') {
                configDataCache.products[id].price = newVal;
            } else {
                configDataCache.orderBumps[id].price = newVal;
            }
            saveProducts();
        }

        async function saveProducts() {
            if(!configDataCache) return;
            
            try {
                const res = await fetch('https://mura-api.joaopaulojaguar.workers.dev/api/config/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: currentPass, data: configDataCache })
                });
                
                const responseData = await res.json();
                if(responseData.success) {
                    ip.parentNode.style.background = '#E8F5E9';
                    setTimeout(() => ip.parentNode.style.background = '#F2F2F7', 1000);
                    showToast('Preço atualizado!');
                } else {
                    alert("Erro ao salvar: " + (responseData.error || ''));
                }
            } catch(e) {
                alert("Erro de conexão ao salvar produto.");
            }
        }

        async function clearHistory() {
            if(!confirm("Tem certeza que deseja apagar todo o histórico de VENDAS (Back-end)? Apenas vendas serão afetadas.")) return;
            try {
                const res = await fetch('https://mura-api.joaopaulojaguar.workers.dev/api/history/clear', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: currentPass })
                });
                if(res.ok) {
                    showToast("Histórico Limpo.");
                    if(currentTab === 'pix') loadPixHistory();
                } else alert("Erro ao limpar.");
            } catch(e) { alert("Falha na rede.") }
        }

        // Auto refresh stats when switching to VSL Hub
        const originalSwitchTab = switchTab;
        window.switchTab = function(tabId, el, title) {
            originalSwitchTab(tabId, el, title);
            if(tabId === 'vsl') {
                renderVslStats();
            }
        };

    