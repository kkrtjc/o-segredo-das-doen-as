const fs = require('fs');
let file = 'Novo guia 1.0.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Substituir o Select pela Scroll Bar (Nativo do iOS)
content = content.replace(
  /<div class="mobile-nav-wrapper">[\s\S]*?<\/select>\s*<\/div>/g, 
  `<nav class="mobile-scroll-nav" id="mobileScrollNav">
            <a href="#" class="scroll-tab active" data-target="apresentacao" onclick="handleMobileClick('apresentacao', null); return false;">&#128218; Início</a>
            <a href="#" class="scroll-tab" data-target="doencas" onclick="handleMobileClick('doencas', 'all'); return false;">&#128203; Todas</a>
            <a href="#" class="scroll-tab" data-target="bact-resp" onclick="handleMobileClick('doencas', 'bact-resp'); return false;">&#129440; Respiratórias</a>
            <a href="#" class="scroll-tab" data-target="viral" onclick="handleMobileClick('doencas', 'viral'); return false;">&#129516; Virais</a>
            <a href="#" class="scroll-tab" data-target="bact-sist" onclick="handleMobileClick('doencas', 'bact-sist'); return false;">&#129658; Sistêmicas</a>
            <a href="#" class="scroll-tab" data-target="parasita" onclick="handleMobileClick('doencas', 'parasita'); return false;">&#128027; Parasitas</a>
            <a href="#" class="scroll-tab" data-target="nutricional" onclick="handleMobileClick('doencas', 'nutricional'); return false;">&#129367; Nutricionais</a>
            <a href="#" class="scroll-tab" data-target="peito-seco" onclick="handleMobileClick('doencas', 'peito-seco'); return false;">&#129412; Peito Seco</a>
            <a href="#" class="scroll-tab" data-target="tabelas" onclick="handleMobileClick('tabelas', null); return false;">&#128202; Tabelas</a>
            <a href="#" class="scroll-tab" data-target="checklist" onclick="handleMobileClick('checklist', null); return false;">&#10004; Checklist</a>
        </nav>`
);

// 2. Adicionar o CSS NATIVO
let newCss = `
        /* --- MENU SWIPE IOS --- */
        .mobile-header { padding: 0 !important; flex-direction: column !important; height: auto !important; align-items: flex-start !important; }
        .header-logo { padding: 15px 20px 0; width: 100%; display: block; padding-bottom:5px; }
        .mobile-scroll-nav {
            display: flex; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;
            gap: 10px; padding: 10px 20px 20px; scrollbar-width: none;
        }
        .mobile-scroll-nav::-webkit-scrollbar { display: none; /* Safari e Chrome */ }
        .scroll-tab {
            padding: 8px 18px; background: rgba(255,255,255,0.05); border-radius: 20px;
            color: var(--text-secondary); font-size: 0.95rem; font-weight: 500;
            white-space: nowrap; text-decoration: none; border: 1px solid var(--border-glass);
            transition: all 0.2s ease;
        }
        .scroll-tab.active {
            background: rgba(56, 189, 248, 0.15); color: var(--accent-blue); border-color: rgba(56, 189, 248, 0.4);
        }
        .scroll-tab:active { transform: scale(0.95); opacity: 0.7; }
    </style>`;
content = content.replace('</style>', newCss);

// 3. Adicionar o JS de controle (links nulos que ignoram dropdown bugado)
let jsInjection = `// --- MOBILE SWIPE EVENT (LINKS PUROS) ---
        function handleMobileClick(sectionId, filterId) {
            // Pequeno tempo para evitar Layout Thrashing do Webkit Mobile
            setTimeout(function() {
                var tabs = document.querySelectorAll('.scroll-tab');
                for(var i=0; i<tabs.length; i++) tabs[i].classList.remove('active');
                
                if(filterId) {
                    var el = document.querySelector('.scroll-tab[data-target="'+filterId+'"]');
                    if(el) el.classList.add('active');
                    filterByCategory(filterId);
                } else {
                    var el = document.querySelector('.scroll-tab[data-target="'+sectionId+'"]');
                    if(el) el.classList.add('active');
                    showSection(sectionId);
                }
            }, 50);
        }

`;

content = content.replace('// --- NATIVE MOBILE SELECT EVENT ---', jsInjection + '// --- NATIVE MOBILE SELECT EVENT ---');

// Sync selection visual state when using other links across document
let selectSyncReplace = `var mTabs = document.querySelectorAll('.scroll-tab');
                for(var t=0; t<mTabs.length; t++) mTabs[t].classList.remove('active');
                var activeTab = document.querySelector('.scroll-tab[data-target="'+id+'"]');
                if (activeTab) activeTab.classList.add('active');`;

content = content.replace(/var mSelect = document\.getElementById\('mobileNavSelect'\);\s*if \(mSelect\) mSelect\.value = id;/g, selectSyncReplace);

let selectCatSyncReplace = `var mTabs = document.querySelectorAll('.scroll-tab');
                for(var t=0; t<mTabs.length; t++) mTabs[t].classList.remove('active');
                var activeTab = document.querySelector('.scroll-tab[data-target="'+(category === 'all' ? 'doencas' : category)+'"]');
                if (activeTab) activeTab.classList.add('active');`;

content = content.replace(/var mSelect = document\.getElementById\('mobileNavSelect'\);\s*if \(mSelect\) mSelect\.value = \(category === 'all' \? 'doencas' : 'filter:' \+ category\);/g, selectCatSyncReplace);

fs.writeFileSync(file, content, 'utf8');
console.log('Mobile swipe bar installed successfully.');
