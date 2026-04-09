#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build HTML E-Book Premium — Galos Mura Brasil
V4 — Corrige estrutura invertida do PDF (Sintomas vem ANTES do titulo da doenca)
"""
import re
import os

INPUT_FILE  = os.path.join(os.path.dirname(__file__), 'ebook_text.txt')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'ebook_doencas_premium.html')

# Títulos de doença conhecidos
DISEASE_PREFIXES = [
    'Bronquite Infecciosa',
    'Laringotraqueíte Infecciosa',
    'Metapneumovirose Aviária',
    'Micoplasmose Respiratória',
    'Coriza Infecciosa',
    'Ornithobacterium rhinotracheale',
    'Ornithobacterium (ORT)',
    'Doença de Newcastle',
    'Doença de Marek',
    'Doença de Gumboro',
    'Influenza Aviária',
    'Varíola Aviária',
    'Salmonelose',
    'Cólera Aviária',
    'Colibacilose',
    'Enterite Necrótica',
    'Coccidiose',
    'Verminoses',
    'Histomoníase',
    'Tricomoníase',
    'Criptosporidiose',
    'Deficiência de Cálcio',
    'Deficiências Vitamínicas',
    'Retenção de Ovo',
    'Ferimentos, Bicagem e Canibalismo',
    'Ectoparasitoses',
    'Ectoparasitas',
    'Peito seco',
    'Principais Problemas que causam peito seco',
    'Principais Problemas',
]

SECTION_MARKERS = [
    ('CAPÍTULO 1',                                       'capitulo-1',   '📖 Capítulo 1 — Doenças e Tratamentos'),
    ('Doenças Respiratórias',                             'respiratorias','🫁 Doenças Respiratórias'),
    ('Doenças Virais Sistêmicas',                         'virais',       '🦠 Doenças Virais Sistêmicas'),
    ('Doenças Bacterianas Sistêmicas / Entéricas',        'bacterianas',  '🧫 Doenças Bacterianas'),
    ('Doenças Bacterianas Sistêmicas',                    'bacterianas',  '🧫 Doenças Bacterianas'),
    ('Doenças Parasitárias / Protozoárias / Intestinais', 'parasitas',    '🪱 Doenças Parasitárias'),
    ('Doenças Parasitárias',                              'parasitas',    '🪱 Doenças Parasitárias'),
    ('Condições Nutricionais e Problemas Comuns',         'nutricionais', '🥗 Condições Nutricionais'),
    ('Condições Nutricionais',                            'nutricionais', '🥗 Condições Nutricionais'),
    ('Tabela de Sintomas x Doenças Prováveis',            'capitulo-2',   '📋 Capítulo 2 — Tabelas e Guias Rápidos'),
    ('CAPÍTULO 2',                                        'capitulo-2',   '📋 Capítulo 2 — Tabelas e Guias Rápidos'),
    ('GUIAS E TABELAS RÁPIDAS',                           'capitulo-2',   '📋 Capítulo 2 — Tabelas e Guias Rápidos'),
    ('Checklist de Manejo Diário',                        'checklist',    '📝 Checklist de Manejo Diário'),
    ('Calendário de Vacinação',                           'vacinacao',    '💉 Calendário de Vacinação'),
    ('Protocolos de Vermifugação',                        'vermifugacao', '🧪 Protocolos de Vermifugação'),
    ('CONCLUSÃO E RECOMENDAÇÕES',                         'conclusao',    '✅ Conclusão e Recomendações'),
    ('A Importância da Prevenção',                        'conclusao',    '✅ Conclusão e Recomendações'),
]

FIELD_PREFIXES = [
    'Sintomas:', 'Sintoma(s)', 'Prevenção:', 'Tratamento', 'Antibióticos:',
    'Anticoccidianos:', 'Vermífugos:', 'Medicamentos:', 'Produtos para',
    'Primeiros Socorros:', 'Lesões Cutâneas:', 'Lesões Difteríticas',
    'Suporte:', 'Suplementação:', 'Lubrificação', 'Aviso:', 'Causas:',
    'Identificação da Causa:', 'Isolamento e Limpeza:', 'Vitamina ',
    'Nota:', 'Aves Jovens', 'Aves Adultas', 'Rotação de Princípios',
    'Período de Carência', '[ ]', 'Manhã:', 'Tarde:', 'Final do Dia:',
    'Procure um médico', 'Você observar', 'Houver um surto',
    'Para elaborar', 'Doença(s) Provável', 'Tratamento Sugerido',
    'Idade', 'Vacina', 'Via de Aplicação', 'Fase 1:', 'Fase 2:',
]

# Campos que pertencem a uma doença (para retroativo)
DISEASE_FIELD_PREFIXES = [
    'Sintomas:', 'Prevenção:', 'Tratamento', 'Antibióticos:',
    'Anticoccidianos:', 'Vermífugos:', 'Medicamentos:', 'Produtos para',
    'Primeiros Socorros:', 'Lesões Cutâneas:', 'Lesões Difteríticas',
    'Suporte:', 'Suplementação:', 'Lubrificação', 'Aviso:', 'Causas:',
    'Identificação da Causa:', 'Isolamento e Limpeza:',
]

def is_disease_title(text):
    clean = text.strip().lstrip('\u200b \t')
    # Titles must be relatively short — long paragraphs that mention a disease name are not titles
    if len(clean) > 80:
        return False
    for dp in DISEASE_PREFIXES:
        if clean.startswith(dp):
            return True
    return False

def is_section_marker(text):
    for marker_text, sec_id, sec_title in SECTION_MARKERS:
        if marker_text in text:
            return (sec_id, sec_title, marker_text)
    return None

def is_field_start(text):
    for fp in FIELD_PREFIXES:
        if text.startswith(fp):
            return True
    return False

def is_disease_field(text):
    for fp in DISEASE_FIELD_PREFIXES:
        if text.startswith(fp):
            return True
    return False


def load_and_clean(path):
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.readlines()
    cleaned = []
    for line in raw:
        s = line.strip()
        if not s:
            continue
        if s.startswith('--- PAGE'):
            continue
        if s in ('GALOS MURA', 'BRASIL', 'Sumário'):
            continue
        if re.match(r'^\d{1,2}$', s):
            continue
        s = s.lstrip('\u200b \t')
        cleaned.append(s)
    return cleaned

def tokenize(cleaned_lines):
    tokens = []
    buf = ''
    
    def flush_buf():
        nonlocal buf
        if buf.strip():
            tokens.append(('text', buf.strip()))
        buf = ''
    
    for line in cleaned_lines:
        sec = is_section_marker(line)
        if sec:
            flush_buf()
            tokens.append(('section', sec[0], sec[1]))
            rest = line.replace(sec[2], '').strip()
            for noise in ['DOENÇAS EM GALINHAS E', 'RESPECTIVOS TRATAMENTOS',
                          'DOENÇAS EM GALINHAS E RESPECTIVOS TRATAMENTOS']:
                rest = rest.replace(noise, '').strip()
            if rest and len(rest) > 10:
                tokens.append(('text', rest))
            continue
        
        if is_disease_title(line):
            flush_buf()
            tokens.append(('disease_title', line))
            continue
        
        if is_field_start(line):
            flush_buf()
            buf = line
            continue
        
        if buf:
            buf += ' ' + line
        else:
            buf = line
    
    flush_buf()
    return tokens

def reorder_tokens(tokens):
    """
    CHAVE: No PDF, os campos de doença (Sintomas, Tratamento...) aparecem ANTES do titulo
    da doença. Precisamos reorganizar para colocar titulo ANTES dos campos.
    
    Algoritmo:
    - Percorrer tokens
    - Quando encontrar 'disease_title', olhar para trás e pegar todos os 'text' tokens consecutivos
      que sejam campos de doença (Sintomas, Prevenção, Tratamento, Aviso...) e movê-los para depois do título.
    """
    result = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        
        if tok[0] == 'disease_title':
            # Olhar para trás no result e pegar campos de doença que ficaram antes
            stolen_fields = []
            while result and result[-1][0] == 'text' and is_disease_field(result[-1][1]):
                stolen_fields.insert(0, result.pop())
            
            # Inserir: titulo primeiro, depois a descrição/intro (textos não-campo que seguem o título)
            result.append(tok)
            
            # Agora olhar para frente: pegar textos de descrição que seguem o titulo (não-campo)
            j = i + 1
            desc_texts = []
            while j < len(tokens) and tokens[j][0] == 'text' and not is_disease_field(tokens[j][1]):
                desc_texts.append(tokens[j])
                j += 1
            
            # Inserir descrição primeiro, depois os campos roubados
            for dt in desc_texts:
                result.append(dt)
            for sf in stolen_fields:
                result.append(sf)
            
            i = j
            continue
        
        result.append(tok)
        i += 1
    
    return result

def format_text_block(text):
    t = text.strip()
    if not t:
        return ''
    
    if t.startswith('Sintomas:') or t.startswith('Sintoma(s)'):
        content = t.split(':', 1)[1].strip() if ':' in t else t
        return f'<div class="field-block"><span class="field-label symptom-label">🔴 Sintomas</span><span class="field-text">{content}</span></div>'
    if t.startswith('Prevenção:'):
        return f'<div class="field-block"><span class="field-label prevention-label">🛡️ Prevenção</span><span class="field-text">{t[10:].strip()}</span></div>'
    if t.startswith('Tratamento'):
        idx = t.find(':')
        content = t[idx+1:].strip() if idx >= 0 else t
        return f'<div class="field-block"><span class="field-label treatment-label">💊 Tratamento</span><span class="field-text">{content}</span></div>'
    if t.startswith('Antibióticos:'):
        return f'<div class="field-block"><span class="field-label med-label">💉 Antibióticos</span><span class="field-text">{t[13:].strip()}</span></div>'
    if t.startswith('Anticoccidianos:'):
        return f'<div class="field-block"><span class="field-label med-label">💉 Anticoccidianos</span><span class="field-text">{t[16:].strip()}</span></div>'
    if t.startswith('Vermífugos:'):
        return f'<div class="field-block"><span class="field-label med-label">💉 Vermífugos</span><span class="field-text">{t[11:].strip()}</span></div>'
    if t.startswith('Medicamentos:'):
        return f'<div class="field-block"><span class="field-label med-label">💉 Medicamentos</span><span class="field-text">{t[13:].strip()}</span></div>'
    if t.startswith('Produtos para Aves:'):
        return f'<div class="field-block"><span class="field-label med-label">💉 Produtos (Aves)</span><span class="field-text">{t[19:].strip()}</span></div>'
    if t.startswith('Produtos para Ambiente:'):
        return f'<div class="field-block"><span class="field-label med-label">🏠 Produtos (Ambiente)</span><span class="field-text">{t[22:].strip()}</span></div>'
    if t.startswith('Suporte:'):
        return f'<div class="field-block"><span class="field-label support-label">🩹 Suporte</span><span class="field-text">{t[8:].strip()}</span></div>'
    if t.startswith('Suplementação:'):
        return f'<div class="field-block"><span class="field-label support-label">🩹 Suplementação</span><span class="field-text">{t[14:].strip()}</span></div>'
    if t.startswith('Primeiros Socorros:'):
        return f'<div class="field-block"><span class="field-label treatment-label">🚨 Primeiros Socorros</span><span class="field-text">{t[19:].strip()}</span></div>'
    if t.startswith('Lubrificação'):
        idx = t.find(':')
        return f'<div class="field-block"><span class="field-label treatment-label">🧴 Lubrificação</span><span class="field-text">{t[idx+1:].strip() if idx>=0 else t}</span></div>'
    if t.startswith('Lesões Cutâneas:'):
        return f'<div class="field-block"><span class="field-label treatment-label">🩹 Lesões Cutâneas</span><span class="field-text">{t[16:].strip()}</span></div>'
    if t.startswith('Lesões Difteríticas'):
        idx = t.find(':')
        return f'<div class="field-block"><span class="field-label treatment-label">🩹 Lesões Difteríticas</span><span class="field-text">{t[idx+1:].strip() if idx>=0 else t}</span></div>'
    if t.startswith('Causas:'):
        return f'<div class="field-block"><span class="field-label symptom-label">⚡ Causas</span><span class="field-text">{t[7:].strip()}</span></div>'
    if t.startswith('Identificação da Causa:'):
        return f'<div class="field-block"><span class="field-label prevention-label">🔍 Identificação</span><span class="field-text">{t[23:].strip()}</span></div>'
    if t.startswith('Isolamento e Limpeza:'):
        return f'<div class="field-block"><span class="field-label treatment-label">🧹 Isolamento e Limpeza</span><span class="field-text">{t[21:].strip()}</span></div>'
    if t.startswith('Aviso:'):
        return f'<div class="alert-box">⚠️ <strong>Aviso:</strong> {t[6:].strip()}</div>'
    if t.startswith('[ ]'):
        return f'<div class="checklist-item">☐ {t[3:].strip()}</div>'
    if t.startswith('Manhã:'):
        return f'<h3 class="time-header">🌅 {t}</h3>'
    if t.startswith('Tarde:'):
        return f'<h3 class="time-header">☀️ {t}</h3>'
    if t.startswith('Final do Dia:'):
        return f'<h3 class="time-header">🌙 {t}</h3>'
    if t.startswith('Vitamina ') and ':' in t:
        parts = t.split(':', 1)
        return f'<div class="field-block"><span class="field-label med-label">💊 {parts[0]}</span><span class="field-text">{parts[1].strip()}</span></div>'
    return f'<p>{t}</p>'


def build_html():
    lines = load_and_clean(INPUT_FILE)
    tokens = tokenize(lines)
    # No reorder needed — we handle inverted structure in the assembly phase
    
    sections = {}
    current_section = 'inicio'
    sections[current_section] = ''
    
    in_disease = False
    disease_title = ''
    disease_body = ''
    seen_sections = set()
    orphan_fields = []  # Fields that appear before any disease title in a section
    
    def close_disease():
        nonlocal in_disease, disease_title, disease_body, orphan_fields
        if in_disease and disease_title:
            # Prepend any orphan fields that were collected before this disease
            orphan_html = ''
            for of in orphan_fields:
                orphan_html += format_text_block(of)
            orphan_fields = []
            
            sections[current_section] += f'''
            <details class="disease-card">
                <summary>{disease_title}</summary>
                <div class="disease-content">
                    {disease_body}{orphan_html}
                </div>
            </details>'''
        elif orphan_fields:
            # No disease to attach to, just output as regular text
            for of in orphan_fields:
                sections.setdefault(current_section, '')
                sections[current_section] += format_text_block(of)
            orphan_fields = []
        in_disease = False
        disease_title = ''
        disease_body = ''
    
    # Two-pass approach: first identify disease_title tokens and look backwards
    # to attach orphan field tokens (Sintomas, Tratamento, etc.) that appeared before the title
    #
    # Actually simpler: we just process linearly. When we hit text that is a disease-field
    # but we're NOT in a disease yet, we buffer it. When we hit a disease_title, we attach
    # the buffer. When we hit text that is NOT a disease field and we're not in a disease,
    # we flush the buffer as regular section content.
    
    for token in tokens:
        if token[0] == 'section':
            close_disease()
            sec_id = token[1]
            sec_title = token[2]
            if sec_id not in seen_sections:
                seen_sections.add(sec_id)
                current_section = sec_id
                sections.setdefault(current_section, '')
                sections[current_section] += f'<h2 class="section-title">{sec_title}</h2>'
            else:
                current_section = sec_id
                
        elif token[0] == 'disease_title':
            close_disease()
            in_disease = True
            disease_title = token[1]
            # Pre-fill body with orphan fields that appeared BEFORE this title
            disease_body = ''
            for of in orphan_fields:
                disease_body += format_text_block(of)
            orphan_fields = []
            
        elif token[0] == 'text':
            text = token[1]
            if in_disease:
                disease_body += format_text_block(text)
            else:
                # Check if it's a disease field (Sintomas, Tratamento, etc.)
                if is_disease_field(text):
                    orphan_fields.append(text)
                else:
                    # Flush any orphan fields as regular content (they don't belong to any disease)
                    if orphan_fields:
                        for of in orphan_fields:
                            sections.setdefault(current_section, '')
                            sections[current_section] += format_text_block(of)
                        orphan_fields = []
                    sections.setdefault(current_section, '')
                    sections[current_section] += format_text_block(text)
    
    close_disease()
    
    section_order = [
        ('inicio',        'Inicio'),
        ('capitulo-1',    'Cap. 1'),
        ('respiratorias', 'Respiratorias'),
        ('virais',        'Virais'),
        ('bacterianas',   'Bacterianas'),
        ('parasitas',     'Parasitarias'),
        ('nutricionais',  'Nutricionais'),
        ('capitulo-2',    'Tabelas'),
        ('checklist',     'Checklist'),
        ('vacinacao',     'Vacinacao'),
        ('vermifugacao',  'Vermifugacao'),
        ('conclusao',     'Conclusao'),
    ]
    
    section_order = [(sid, lbl) for sid, lbl in section_order if sections.get(sid, '').strip()]
    
    nav_tabs = ''
    for sid, label in section_order:
        active = ' active' if sid == 'inicio' else ''
        nav_tabs += f'<a href="#{sid}" class="tab{active}" onclick="activateTab(this,\'{sid}\')">{label}</a>\n'
    
    sections_html = ''
    for sid, label in section_order:
        fallback = ' active-fallback' if sid == 'inicio' else ''
        body = sections.get(sid, '')
        sections_html += f'<div id="{sid}" class="section-content{fallback}">{body}</div>\n'
    
    final_html = HTML_TEMPLATE.replace('{{NAV_TABS}}', nav_tabs).replace('{{SECTIONS}}', sections_html)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(final_html)
    
    n_diseases = final_html.count('<details class="disease-card">')
    n_sections = len(section_order)
    size = len(final_html)
    print(f"[OK] E-Book gerado com sucesso!")
    print(f"     Arquivo: {OUTPUT_FILE}")
    print(f"     {n_sections} secoes | {n_diseases} doencas | {size:,} bytes")


HTML_TEMPLATE = r'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Galos Mura Brasil — O Segredo das Doenças</title>
    <style>
        :root {
            --bg: #0a0f1e;
            --surface: #141b2d;
            --surface-hover: #1c2540;
            --gold: #f59e0b;
            --blue: #38bdf8;
            --green: #10b981;
            --red: #ef4444;
            --text: #e2e8f0;
            --text-dim: #94a3b8;
            --glass: rgba(255,255,255,0.06);
            --glass-border: rgba(255,255,255,0.08);
            --radius: 14px;
            --transition: all 0.3s cubic-bezier(.4,0,.2,1);
        }
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        html{scroll-behavior:smooth}
        body{
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
            background:var(--bg);color:var(--text);line-height:1.7;
            padding-top:175px;-webkit-font-smoothing:antialiased;
        }
        @supports (font-variation-settings: normal) {
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Inter', -apple-system, sans-serif; }
        }

        .header{
            position:fixed;top:0;left:0;width:100%;z-index:1000;
            background:rgba(10,15,30,0.92);
            backdrop-filter:saturate(180%) blur(20px);
            -webkit-backdrop-filter:saturate(180%) blur(20px);
            border-bottom:1px solid var(--glass-border);
        }
        .header-top{display:flex;align-items:center;gap:10px;padding:14px 20px 6px}
        .logo{font-size:1.15rem;font-weight:700;color:var(--gold)}
        .logo span{font-size:1.3rem;margin-right:4px}
        .search-wrap{padding:6px 20px 8px}
        #searchInput{
            width:100%;padding:11px 16px 11px 40px;
            border-radius:10px;border:1px solid var(--glass-border);
            background:var(--glass);color:#fff;
            font-size:0.95rem;font-family:inherit;outline:none;
            transition:var(--transition);
            background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.85-3.85zm-5.44.706a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z'/%3E%3C/svg%3E");
            background-repeat:no-repeat;background-position:14px center;
        }
        #searchInput:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(56,189,248,0.15)}
        #searchInput::placeholder{color:var(--text-dim)}
        .search-status{display:none;padding:6px 20px;color:var(--gold);font-size:0.85rem;font-weight:500}
        body.search-active .search-status{display:block}
        .nav{display:flex;width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:8px;padding:8px 20px 14px;scrollbar-width:none}
        .nav::-webkit-scrollbar{display:none}
        .tab{
            padding:7px 16px;background:var(--glass);border-radius:20px;
            color:var(--text-dim);font-size:0.85rem;font-weight:500;
            white-space:nowrap;text-decoration:none;
            border:1px solid var(--glass-border);transition:var(--transition);
        }
        .tab.active{background:rgba(56,189,248,0.12);color:var(--blue);border-color:rgba(56,189,248,0.35)}
        .tab:active{transform:scale(0.95);opacity:0.8}
        body.search-active .nav{opacity:0.4;pointer-events:none}

        .container{max-width:820px;margin:0 auto;padding:0 16px 60px}
        .section-content{display:none;animation:fadeUp 0.35s ease forwards}
        .section-content.active-fallback,.section-content:target{display:block}
        body.search-active .section-content{display:block!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .section-title{font-size:1.4rem;font-weight:700;color:#fff;margin:30px 0 18px;padding-bottom:12px;border-bottom:1px solid var(--glass-border)}

        .disease-card{
            background:var(--surface);border-radius:var(--radius);margin-bottom:14px;
            border:1px solid var(--glass-border);overflow:hidden;transition:var(--transition);
        }
        .disease-card.hidden-by-search{display:none!important}
        .disease-card[open]{border-color:rgba(245,158,11,0.35);box-shadow:0 8px 30px rgba(0,0,0,0.25)}
        .disease-card summary{
            padding:16px 20px;font-size:1.05rem;font-weight:600;color:var(--text);
            cursor:pointer;list-style:none;display:flex;align-items:center;
            justify-content:space-between;transition:var(--transition);
        }
        .disease-card summary:hover{background:var(--surface-hover)}
        .disease-card summary::-webkit-details-marker{display:none}
        .disease-card summary::after{content:'+';font-size:1.4rem;color:var(--blue);transition:transform 0.3s;flex-shrink:0;margin-left:12px}
        .disease-card[open] summary::after{content:'\2212';color:var(--gold);transform:rotate(180deg)}
        .disease-content{padding:4px 20px 20px;border-top:1px solid rgba(255,255,255,0.04)}

        .field-block{margin-bottom:14px;padding:14px 16px;background:rgba(255,255,255,0.02);border-radius:10px;border-left:3px solid var(--glass-border)}
        .field-label{display:block;font-weight:700;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px}
        .symptom-label{color:var(--red)}
        .prevention-label{color:var(--blue)}
        .treatment-label{color:var(--green)}
        .med-label{color:#a78bfa}
        .support-label{color:#f97316}
        .field-text{color:var(--text-dim);font-size:0.95rem;line-height:1.7}
        .alert-box{background:rgba(239,68,68,0.08);border-left:4px solid var(--red);padding:14px 16px;border-radius:0 10px 10px 0;margin:14px 0;font-size:0.9rem;color:#fca5a5}

        .checklist-item{padding:10px 16px;margin-bottom:6px;background:var(--glass);border-radius:8px;color:var(--text);font-size:0.95rem}
        .time-header{color:var(--gold);font-size:1.1rem;margin:20px 0 10px}

        p{color:var(--text-dim);margin-bottom:14px;font-size:0.95rem}
        h2{color:var(--gold);margin-bottom:14px}
        h3{color:var(--blue);margin-bottom:10px}
        strong{color:var(--text)}

        @media(max-width:600px){body{padding-top:185px}.disease-card summary{font-size:0.95rem;padding:14px 16px}.field-block{padding:12px 14px}}
        @media(min-width:768px){body{padding-top:160px}}
        @media print{.header{position:static}.section-content{display:block!important}.disease-card{break-inside:avoid;page-break-inside:avoid}}
    </style>
</head>
<body>
    <header class="header">
        <div class="header-top">
            <div class="logo"><span>🐓</span> Galos Mura Brasil</div>
        </div>
        <div class="search-wrap">
            <input type="text" id="searchInput" placeholder="Pesquisar sintomas, doenças ou remédios..." autocomplete="off" />
        </div>
        <div class="search-status" id="searchStatus"></div>
        <nav class="nav" id="mainNav">
            {{NAV_TABS}}
        </nav>
    </header>
    <div class="container" id="contentContainer">
        {{SECTIONS}}
    </div>
    <script>
    (function(){
        'use strict';
        window.activateTab = function(el, targetId) {
            if(document.body.classList.contains('search-active')) return;
            document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
            if(el) el.classList.add('active');
            document.querySelectorAll('.section-content').forEach(function(s){
                s.style.display = 'none';
                s.classList.remove('active-fallback');
            });
            setTimeout(function(){
                var target = document.getElementById(targetId);
                if(target){target.style.display='block';window.scrollTo({top:0,behavior:'smooth'})}
            }, 15);
        };
        window.addEventListener('load', function(){
            if(window.location.hash){
                var h=window.location.hash.substring(1);
                var el=document.querySelector('.tab[href="#'+h+'"]');
                if(el) activateTab(el, h);
            }
        });

        var searchInput=document.getElementById('searchInput');
        var searchStatus=document.getElementById('searchStatus');
        var cards=document.querySelectorAll('.disease-card');
        var debounce;
        cards.forEach(function(c){c._text=(c.textContent||c.innerText).toLowerCase()});

        searchInput.addEventListener('input',function(){
            clearTimeout(debounce);
            debounce=setTimeout(function(){doSearch(searchInput.value.trim())},250);
        });

        function doSearch(query){
            var q=query.toLowerCase();
            if(!q){
                document.body.classList.remove('search-active');
                searchStatus.textContent='';
                cards.forEach(function(c){c.classList.remove('hidden-by-search');c.removeAttribute('open')});
                var activeTab=document.querySelector('.tab.active');
                if(activeTab) activateTab(activeTab, activeTab.getAttribute('href').substring(1));
                else activateTab(document.querySelector('.tab'),'inicio');
                return;
            }
            document.body.classList.add('search-active');
            var matched=0;
            cards.forEach(function(c){
                if(c._text.indexOf(q)>=0){c.classList.remove('hidden-by-search');c.setAttribute('open','');matched++}
                else{c.classList.add('hidden-by-search');c.removeAttribute('open')}
            });
            searchStatus.textContent=matched>0
                ? matched+' resultado(s) encontrado(s) para "'+query+'"'
                : 'Nenhum resultado para "'+query+'"';
        }
    })();
    </script>
</body>
</html>
'''

if __name__ == '__main__':
    build_html()
