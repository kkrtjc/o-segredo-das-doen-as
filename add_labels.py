import os
from PIL import Image, ImageDraw, ImageFont

BASE = r"C:\Users\JOAO PAULO\Documents\GitHub\teste\autoridade"

TARGETS = ["coriza.jpg", "bouba.jpg"]

LABEL_HEIGHT = 56

def get_font(size):
    font_paths = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/impact.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, size)
    return ImageFont.load_default()

def stamp_labels(filename):
    in_path = os.path.join(BASE, filename)
    if not os.path.exists(in_path):
        print(f"File not found: {in_path}")
        return

    img = Image.open(in_path).convert("RGB")
    
    # Criar um novo canvas apenas adicionando a altura do rótulo embaixo
    new_h = img.height + LABEL_HEIGHT
    new_img = Image.new("RGB", (img.width, new_h), (10, 10, 10))
    
    # Colar a imagem original inteira no topo (SEM MEXER na foto original)
    new_img.paste(img, (0, 0))
    
    draw = ImageDraw.Draw(new_img)
    font_big = get_font(36)
    
    half_w = img.width // 2
    label_y = img.height

    # Barra vermelha ANTES (Metade Esquerda)
    draw.rectangle([0, label_y, half_w, new_h], fill=(180, 30, 30))
    
    # Barra verde DEPOIS (Metade Direita)
    draw.rectangle([half_w, label_y, img.width, new_h], fill=(22, 130, 55))
    
    # Linha divisória preta sutil bem no meio
    draw.rectangle([half_w - 2, 0, half_w + 2, new_h], fill=(18, 18, 18))
    
    # Textos com sombra para clareza
    def draw_text_centered(text, box_x, box_y, box_w, box_h, shadow_color, text_color):
        bbox = draw.textbbox((0, 0), text, font=font_big)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = box_x + (box_w - tw) // 2
        y = box_y + (box_h - th) // 2
        
        # Shadow
        draw.text((x + 2, y + 2), text, fill=shadow_color, font=font_big)
        # Main Text
        draw.text((x, y), text, fill=text_color, font=font_big)

    # ANTES
    draw_text_centered("ANTES", 0, label_y, half_w, LABEL_HEIGHT, (80, 0, 0), (255, 255, 255))
    
    # DEPOIS
    draw_text_centered("DEPOIS", half_w, label_y, half_w, LABEL_HEIGHT, (0, 60, 0), (255, 255, 255))
    
    # Salvar nos dois formatos
    base_name = os.path.splitext(filename)[0]
    out_png = os.path.join(BASE, f"{base_name}.png")
    out_jpg = os.path.join(BASE, f"{base_name}.jpg") # Subscreve o jpg com o texto
    
    new_img.save(out_png, "PNG", optimize=True)
    new_img.save(out_jpg, "JPEG", quality=90, optimize=True)
    print(f"[SUCESSO] Labels adicionados perfeitamente em {base_name}")

if __name__ == "__main__":
    for t in TARGETS:
        stamp_labels(t)
