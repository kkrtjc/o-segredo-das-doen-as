import re

def build_ebook():
    input_file = r'C:\Users\JOAO PAULO\Documents\GitHub\o-segredo-das-doen-as\pdfs_secure_12x9a\ebook_doencas_content.txt'
    output_file = r'C:\Users\JOAO PAULO\Documents\GitHub\o-segredo-das-doen-as\pdfs_secure_12x9a\ebook_doencas_premium.html'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        text = f.read()

    # Base HTML template with Glassmorphism and premium Dark Theme
    html_template = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Galo Mura Brasil - O Segredo das Doenças</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0b1120;
            --surface-color: #1a2235;
            --accent-gold: #fbbf24;
            --accent-blue: #38bdf8;
            --accent-green: #10b981;
            --text-main: #f1f5f9;
            --text-secondary: #94a3b8;
            --border-glass: rgba(255, 255, 255, 0.08);
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.6;
            padding-top: 130px; /* Space for fixed header */
        }

        /* --- NATIVE SWIPE HEADER --- */
        .mobile-header {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background: rgba(11, 17, 32, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 1000;
            border-bottom: 1px solid var(--border-glass);
            padding: 0;
            display: flex;
            flex-direction: column;
        }

        .header-logo {
            padding: 15px 20px 5px;
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--accent-gold);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .mobile-scroll-nav {
            display: flex;
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            gap: 10px;
            padding: 10px 20px 15px;
            scrollbar-width: none;
        }
        
        .mobile-scroll-nav::-webkit-scrollbar { display: none; }

        .scroll-tab {
            padding: 8px 18px;
            background: rgba(255,255,255,0.05);
            border-radius: 20px;
            color: var(--text-secondary);
            font-size: 0.95rem;
            font-weight: 500;
            white-space: nowrap;
            text-decoration: none;
            border: 1px solid var(--border-glass);
            transition: var(--transition);
        }

        .scroll-tab.active {
            background: rgba(56, 189, 248, 0.15);
            color: var(--accent-blue);
            border-color: rgba(56, 189, 248, 0.4);
        }

        .scroll-tab:active { transform: scale(0.95); opacity: 0.8; }

        /* --- MAIN CONTENT --- */
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 0 20px 40px;
        }

        /* --- SECTION CONTROLLERS (CSS ONLY TABS) --- */
        .section-content {
            display: none;
            animation: fadeIn 0.4s ease forwards;
        }
        
        .section-content:target, .section-content.active-fallback {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* --- TYPOGRAPHY & CARDS --- */
        h1, h2, h3 { color: var(--accent-gold); margin-bottom: 15px; }
        p { margin-bottom: 15px; color: var(--text-secondary); }
        
        .intro-text {
            font-size: 1.1rem;
            text-align: justify;
            margin-bottom: 30px;
            color: #cbd5e1;
            padding: 20px;
            background: rgba(255,255,255,0.02);
            border-radius: 12px;
            border-left: 4px solid var(--accent-gold);
        }

        /* --- NATIVE ACCORDION (DETAILS) --- */
        details {
            background: var(--surface-color);
            border-radius: 12px;
            margin-bottom: 15px;
            border: 1px solid var(--border-glass);
            overflow: hidden;
            transition: var(--transition);
        }

        details[open] {
            border-color: rgba(251, 191, 36, 0.3);
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }

        summary {
            padding: 18px 20px;
            font-size: 1.1rem;
            font-weight: 600;
            color: #f1f5f9;
            cursor: pointer;
            list-style: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        summary::-webkit-details-marker { display: none; }
        
        summary::after {
            content: '+';
            font-size: 1.5rem;
            color: var(--accent-blue);
            transition: transform 0.3s;
        }

        details[open] summary::after {
            content: '−';
            color: var(--accent-gold);
            transform: rotate(180deg);
        }

        .details-content {
            padding: 0 20px 20px;
            border-top: 1px solid rgba(255,255,255,0.03);
            margin-top: 5px;
            padding-top: 15px;
        }

        .med-tag {
            display: inline-block;
            background: rgba(16, 185, 129, 0.15);
            color: var(--accent-green);
            padding: 2px 10px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.9rem;
            margin-bottom: 5px;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .alert-box {
            background: rgba(239, 68, 68, 0.1);
            border-left: 4px solid #ef4444;
            padding: 15px;
            border-radius: 0 8px 8px 0;
            margin-top: 15px;
            font-size: 0.9rem;
            color: #fca5a5;
        }
        
        .section-title {
            margin-top: 40px;
            margin-bottom: 20px;
            font-size: 1.5rem;
            color: white;
            border-bottom: 1px solid var(--border-glass);
            padding-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        /* --- LISTS --- */
        ul.checklist {
            list-style: none;
        }
        ul.checklist li {
            position: relative;
            padding-left: 30px;
            margin-bottom: 15px;
        }
        ul.checklist li::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: var(--accent-green);
            font-weight: bold;
        }
    </style>
</head>
<body>

    <header class="mobile-header">
        <div class="header-logo">
            <span>&#128019;</span> Galos Mura Brasil
        </div>
        <nav class="mobile-scroll-nav">
            <a href="#apresentacao" class="scroll-tab active" onclick="activateTab(this, 'apresentacao')">Início</a>
            <a href="#respiratorias" class="scroll-tab" onclick="activateTab(this, 'respiratorias')">Respiratórias</a>
            <a href="#virais" class="scroll-tab" onclick="activateTab(this, 'virais')">Virais Sistem.</a>
            <a href="#bacterianas" class="scroll-tab" onclick="activateTab(this, 'bacterianas')">Bacterianas</a>
            <a href="#parasitas" class="scroll-tab" onclick="activateTab(this, 'parasitas')">Parasitas</a>
            <a href="#nutricionais" class="scroll-tab" onclick="activateTab(this, 'nutricionais')">Nutricionais</a>
            <a href="#tabelas" class="scroll-tab" onclick="activateTab(this, 'tabelas')">Tabelas & Docs</a>
        </nav>
    </header>

    <div class="container">
"""

    apresentacao = """
    <!-- APRESENTAÇÃO -->
    <div id="apresentacao" class="section-content active-fallback">
        <h1>O Segredo das Doenças</h1>
        <div class="intro-text">
            <p><strong>Olá, amigo criador!</strong></p>
            <p>Se você chegou até aqui, é provável que tenha enfrentado uma situação comum: ver suas galinhas adoecerem e não saber como proceder.</p>
            <p>Meu nome é João Paulo, sou criador há mais de 10 anos. Compartilho aqui o que <strong>realmente funcionou na prática de campo</strong>.</p>
            <p><i>Aviso: Não sou veterinário, mas essas são as condutas e medicamentos que já salvaram milhares de aves.</i></p>
        </div>
        
        <h3>O que você encontrará:</h3>
        <ul class="checklist">
            <li>Identificação rápida das principais doenças.</li>
            <li>Causas e sintomas mais comuns.</li>
            <li>Tratamentos eficazes testados na prática (doses e antibióticos).</li>
        </ul>
        <br>
        <p>Use o menu superior para deslizar e encontrar rapidamente a categoria que sua ave precisa.</p>
    </div>
    """

    html_template += apresentacao

    # Raw parsing patterns (heuristics)
    # the pdf text is long, let's hardcode some sections by hunting in regex or just split
    
    doencas_list = [
        ("respiratorias", "&#129440; Respiratórias", [
            ("Bronquite Infecciosa (IBV)", "Sintomas: Espirros, tosse, dificuldade respiratória.", "Tilosina (ex: Tylan®) 15 mg/kg ou Enrofloxacino (ex: Chimetril®) 10 mg/kg via oral (3-5 dias).", "Doença viral. Antibióticos previnem infecções secundárias."),
            ("Laringotraqueíte Infecciosa (ILT)", "Dificuldade respiratória severa, tosse sanguinolenta, bombeamento do pescoço.", "Tilosina 15 mg/kg ou Oxitetraciclina 30 mg/kg (5-7 dias).", "Vacinação previne."),
            ("Metapneumovirose Aviária", "Inchaço da cabeça e seios, espirros.", "Tilosina 15mg/kg ou Doxiciclina 15 mg/kg.", "Também chamada de Síndrome da Cabeça Inchada."),
            ("Micoplasmose Respiratória (DRC)", "Secreção nasal fétida, ronco crônico.", "Tilosina 15mg/kg ou Tiamulina 25 mg/kg.", "Causada pelo M. gallisepticum."),
            ("Coriza Infecciosa", "Pus nos olhos, rosto muito inchado, cheiro ruim.", "Enrofloxacino (Baytril) 10 mg/kg ou Tilosina 15mg/kg.", "Bacteriana, isolar imediatamente."),
            ("Ornithobacterium (ORT)", "Inchaço no rosto, dificuldade extrema para respirar.", "Enrofloxacino 10 mg/kg ou Doxiciclina 15 mg/kg.", "")
        ]),
        ("virais", "&#129516; Virais Sistêmicas", [
            ("Doença de Newcastle", "Mortalidade rápida, torcicolo, tremores, diarreia verde.", "Suporte vitamínico. Oxitetraciclina 30mg/kg para secundárias.", "Altamente contagiosa e trágica. Vacinação é obrigatória."),
            ("Doença de Marek", "Paralisia das asas e pernas, cegueira, olho cinza.", "Incurável. Suporte alimentar isolado.", "Prevenção apenas vacinando pintinhos no 1º dia."),
            ("Doença de Gumboro", "Aves tristes, diarreia aquosa, penas arrepiadas (bolsa de Fabricius).", "Vitamina ADE. Oxitetraciclina 30mg/kg para secundárias.", "Ataca a imunidade da ave."),
            ("Varíola Aviária (Bouba)", "Verrugas/crostas pretas no rosto (seca). Placas amareladas na boca (úmida).", "Iodo ou Thuya Avícola + pomada cicatrizante.", "Transmitida por mosquitos. Vacinação é certeira.")
        ]),
        ("bacterianas", "&#129658; Bacterianas & Entéricas", [
            ("Salmonelose (Pullorum/Tifo)", "Diarreia branca (pintinhos), fezes grudadas na cloaca.", "Enrofloxacina 10 mg/kg ou Sulfametoxazol+Trimetoprim 30 mg/kg.", "Evite comprar aves de origem desconhecida."),
            ("Cólera Aviária", "Morte súbita, crista fica roxa/azulada, diarreia verde-amarelada.", "Oxitetraciclina 30 mg/kg ou Sulfametoxazol+Trimetoprim 30 mg/kg.", "Pode dizimar o plantel em 2 dias."),
            ("Colibacilose (E. coli)", "Saco vitelino inflamado em pintos, barriga d'água.", "Enrofloxacina 10 mg/kg ou Gentamicina 5 mg/kg injetável.", "Higiene da água e poeira."),
            ("Enterite Necrótica", "Diarreia necrótica (podre), ave muito deprimida.", "Amoxicilina 20 mg/kg ou Bacitracina.", "")
        ]),
        ("parasitas", "&#128027; Parasitárias", [
            ("Coccidiose", "Diarreia com sangue, ave perde peso rápido e fica secando.", "Toltrazuril (Baycox) 7 mg/kg ou Amprolium.", "Higiene do piso e da cama de frango é lei."),
            ("Verminoses (Lombriga, etc)", "Peito Seco, fezes anormais, emagrecimento grave.", "Levamisol (ex: Ripercol) 20-25mg/kg dose única. Ou Fenbendazol.", "Vermifugar plantel a cada 3~6 meses."),
            ("Histomoníase (Cabeça Negra)", "Diarreia amarela-enxofre, pele da cabeça escurece.", "Metronidazol 35 mg/kg (5 a 7 dias).", "Doença transmitida por vermes."),
            ("Tricomoníase", "Massa amarela fedida que tampa a garganta e a boca.", "Metronidazol 25-50 mg/kg.", "Aves pegam isso muitas vezes da água suja ou de pombos."),
            ("Ectoparasitas (Piolho/Ácaro)", "Coceira extrema, falta de pena, pele escamosa.", "Ivermectina Pour-on (na nuca) gota ou Mectimax. Ou spray de Fipronil.", "Dedetizar o galinheiro com Cipermetrina sem as aves presentes.")
        ]),
        ("nutricionais", "&#129367; Nutricionais & Especiais", [
            ("Ovo Preso (Retenção)", "Ave não consegue botar, fica tipo pinguim, estufada.", "Banho morno na cloaca com sal epsom para relaxar, massagem com banha/óleo.", "Falta de cálcio gera ovos enormes ou frágeis."),
            ("Peito Seco (Sintoma)", "O osso do peito fica afiado parecendo uma faca.", "Não é uma doença, é um SINTOMA de fome causada por Coccidiose, vermes ou vírus.", "Descubra a raiz do problema rápido para tratar."),
            ("Canibalismo / Arrancamento", "Aves se bicando até sangrar e arrancar penas.", "Falta de proteína aguda, superlotação, estresse.", "Isolar ave ferida e passar pomada escurecedora.")
        ])
    ]

    for cat_id, cat_title, diseases in doencas_list:
        html_template += f'''
    <div id="{cat_id}" class="section-content">
        <h2 class="section-title">{cat_title}</h2>
'''
        for name, symp, treat, warn in diseases:
            html_template += f'''
        <details>
            <summary>{name}</summary>
            <div class="details-content">
                <p><strong>Sintomas Típicos:</strong><br>{symp}</p>
                <div class="med-tag">Dose & Medicamento:</div>
                <p>{treat}</p>
'''
            if warn:
                html_template += f'''
                <div class="alert-box">
                    <strong>Atenção:</strong> {warn}
                </div>
'''
            html_template += '''
            </div>
        </details>
'''
        html_template += '''
    </div>
'''

    # TABELAS E CHECKLIST (Capítulo 2)
    tabelas = """
    <!-- TABELAS -->
    <div id="tabelas" class="section-content">
        <h2 class="section-title">&#128202; Protocolos Rápidos</h2>
        
        <details>
            <summary>Checklist Diário</summary>
            <div class="details-content">
                <ul class="checklist">
                    <li><strong>Manhã:</strong> Lavar bebedouros, botar ração, olhar atitude (ave quieta vai pro isolamento).</li>
                    <li><strong>Tarde:</strong> Checar se sobrou água limpa (galinha sofre rápido sem). Coletar os ovos.</li>
                    <li><strong>Noite:</strong> Trancar galinheiro para predador.</li>
                </ul>
            </div>
        </details>
        
        <details>
            <summary>Guia de Vacinação Base</summary>
            <div class="details-content">
                <p><strong>1º Dia:</strong> Marek e Gumboro</p>
                <p><strong>14 dias:</strong> Newcastle e Bronquite</p>
                <p><strong>21 dias:</strong> Bouba Aviária</p>
                <p><strong>14 Semanas:</strong> Coriza Infecciosa</p>
            </div>
        </details>
        
        <details>
            <summary>Vermifugação</summary>
            <div class="details-content">
                <p>Dar vermífugo na fase de crescimento (ex: 30 a 45 dias) e depois fazer reforço a cada 4 ou 6 meses no plantel adulto inteiro no mesmo dia.</p>
                <div class="alert-box">Descarte os ovos durante os dias do vermífugo, pois sai veneno na gema. Leia a bula!</div>
            </div>
        </details>
    </div>
    """
    html_template += tabelas
    
    html_template += """
    </div> <!-- Fim container -->

    <script>
        // JS Nativo para Abas (Sem dependência pesada)
        function activateTab(element, targetId) {
            // Remove active from all tabs
            const tabs = document.querySelectorAll('.scroll-tab');
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active to clicked tab
            if(element) element.classList.add('active');
            
            // Hide all sections, remove active-fallback so hash routing takes over precisely without clash
            const sections = document.querySelectorAll('.section-content');
            sections.forEach(s => {
                s.style.display = 'none';
                s.classList.remove('active-fallback'); // pure reset
            });
            
            // Show target
            setTimeout(() => {
                const target = document.getElementById(targetId);
                if(target) {
                    target.style.display = 'block';
                    // Scroll topo suave caso as sections sejam muito longas
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 10);
        }

        // Se acessar com hash direto via URL, ativar o display (Fallback de carregamento inicial)
        window.addEventListener('load', () => {
            if(window.location.hash) {
                const h = window.location.hash.substring(1);
                const el = document.querySelector('.scroll-tab[href="#'+h+'"]');
                if(el) activateTab(el, h);
            }
        });
    </script>
</body>
</html>
"""

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_template)
    print("Sucesso! E-Book Premium gerado em: " + output_file)

if __name__ == "__main__":
    build_ebook()
