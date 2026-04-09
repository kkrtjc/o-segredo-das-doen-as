import re

lines = open('ebook_text.txt','r',encoding='utf-8').readlines()
cleaned = []
for l in lines:
    s = l.strip()
    if not s or s.startswith('--- PAGE') or s in ('GALOS MURA','BRASIL') or re.match(r'^\d{1,2}$',s):
        continue
    cleaned.append(s)

# Merge paragraphs like the main script does
merged = []
buf = ''
for line in cleaned:
    starts = ['Sintomas:','Prevenção:','Tratamento','Antibióticos:','Anticoccidianos:',
              'Vermífugos:','Medicamentos:','Produtos para','Primeiros Socorros:',
              'Lesões ','Suporte:','Suplementação:','Lubrificação',
              'Aviso:','Causas:','Identificação','Isolamento','Vitamina ',
              'CAPÍTULO','Capítulo','CONCLUSÃO','GUIAS','Calendário','Protocolos',
              'Checklist','Nota:','Aves Jovens','Aves Adultas','Rotação',
              'Período de Carência','Manhã:','Tarde:','Final do Dia:',
              '[ ]','Procure','Você observar','Houver','Para elaborar']
    is_start = any(line.startswith(s) for s in starts)
    if buf and is_start:
        merged.append(buf.strip())
        buf = line
    else:
        buf = (buf + ' ' + line) if buf else line
if buf.strip():
    merged.append(buf.strip())

# Now try matching disease titles
DISEASE_TITLES = {
    'Bronquite Infecciosa (IBV)',
    'Laringotraqueíte Infecciosa (ILT)',
    'Metapneumovirose Aviária (aMPV)',
    'Micoplasmose Respiratória (DRC',
    'Coriza Infecciosa',
    'Ornithobacterium rhinotracheale (ORT)',
    'Doença de Newcastle (ND)',
    'Doença de Newcastle',
    'Doença de Marek',
    'Doença de Gumboro (IBDV / Bursite Infecciosa)',
    'Doença de Gumboro',
    'Influenza Aviária (IA)',
    'Influenza Aviária',
    'Varíola Aviária (Bouba Aviária)',
    'Salmonelose (Pullorum, Tifo Aviário, Enteritidis',
    'Salmonelose',
    'Cólera Aviária (Pasteurelose)',
    'Cólera Aviária',
    'Colibacilose (E. coli',
    'Colibacilose',
    'Enterite Necrótica (Clostridium perfringens)',
    'Enterite Necrótica',
    'Coccidiose (Eimeria spp.)',
    'Coccidiose',
    'Verminoses (Ascaridia, Heterakis, Capillaria, Tênias',
    'Verminoses',
    'Histomoníase (Doença da Cabeça Negra)',
    'Histomoníase',
    'Tricomoníase (Trichomonas gallinae',
    'Tricomoníase',
    'Criptosporidiose',
    'Deficiência de Cálcio / Problemas de Casca',
    'Deficiências Vitamínicas (A, D, E, B2 etc.)',
    'Deficiências Vitamínicas',
    'Retenção de Ovo (Egg Binding)',
    'Ferimentos, Bicagem e Canibalismo',
    'Ectoparasitoses (ácaros, piolhos, carrapatos)',
    'Peito seco',
    'Principais Problemas',
}

with open('diag_output.txt', 'w', encoding='utf-8') as out:
    out.write(f"Total merged paragraphs: {len(merged)}\n\n")
    
    for i, p in enumerate(merged):
        clean = p.strip().lstrip('\u200b \t')
        matched = False
        for dt in DISEASE_TITLES:
            if clean == dt or clean.startswith(dt):
                matched = True
                break
        
        # Only print first 120 chars
        preview = p[:120]
        if matched:
            out.write(f"DISEASE [{i:3d}]: {preview}\n")
        elif i < 20 or 'CAPÍTULO' in p or 'Respiratórias' in p or 'Virais' in p or 'Bacterianas' in p or 'Parasitárias' in p or 'Nutricionais' in p:
            out.write(f"SECTION [{i:3d}]: {preview}\n")
    
    out.write("\n\n=== FIRST 50 MERGED PARAGRAPHS ===\n")
    for i in range(min(50, len(merged))):
        out.write(f"[{i:3d}] {merged[i][:150]}\n")

print("Done - check diag_output.txt")
