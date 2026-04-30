import re
import urllib.request
import os

html_path = 'index.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Baixar imagens externas e trocar no HTML
external_images = {
    'https://logospng.org/download/pix/logo-pix-icone-1024.png': 'assets/pix.png',
    'https://logospng.org/download/visa/logo-visa-256.png': 'assets/visa.png',
    'https://logospng.org/download/mastercard/logo-mastercard-256.png': 'assets/mastercard.png',
    'https://img.icons8.com/color/48/barcode.png': 'assets/barcode.png',
    'https://logospng.org/download/mercado-pago/logo-mercado-pago-icone-1024.png': 'assets/mercado-pago.png'
}

if not os.path.exists('assets'):
    os.makedirs('assets')

for url, local_path in external_images.items():
    try:
        # Avoid downloading if already exists
        if not os.path.exists(local_path):
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(local_path, 'wb') as out_file:
                out_file.write(response.read())
            print(f"Baixado: {local_path}")
        html = html.replace(url, local_path)
    except Exception as e:
        print(f"Erro ao baixar {url}: {e}")

# 2. Adicionar loading="lazy" nas imagens que não tem, ignorando as primeiras imagens do topo.
# We will use regex to find <img ...> tags.
img_pattern = re.compile(r'<img\s+[^>]*>', re.IGNORECASE)

def add_lazy(match):
    tag = match.group(0)
    # se já tem loading=..., ignorar
    if 'loading=' in tag.lower():
        return tag
    
    # Adiciona loading="lazy" no final antes do >
    return tag[:-1] + ' loading="lazy">'

# Find all images
imgs = list(img_pattern.finditer(html))

# Let's say the first 3 images are critical (logo, hero). We skip them.
# We will apply replacement to the rest.
modified_html = html
offset = 0

for i, match in enumerate(imgs):
    if i < 3:
        continue # ignora os 3 primeiros para LCP (Largest Contentful Paint)
    
    tag = match.group(0)
    if 'loading=' not in tag.lower():
        new_tag = tag[:-1] + ' loading="lazy">'
        start = match.start() + offset
        end = match.end() + offset
        modified_html = modified_html[:start] + new_tag + modified_html[end:]
        offset += len(new_tag) - len(tag)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(modified_html)

print("Otimização concluída!")
