"""
Gera imagens combinadas de antes/depois para o carrossel de autoridade.
V2 - Labels maiores, mais visiveis, visual premium.
"""

from PIL import Image, ImageDraw, ImageFont
import os

BASE = r"C:\Users\JOAO PAULO\Documents\GitHub\teste\autoridade"

PAIRS = [
    ("franga a1.jpeg", "franga a2.png", "combined_franga"),
    ("galinha doente 1 antes.png", "galinha doente 1 depois.png", "combined_galinha"),
    ("galo doente.png", "galo curado.jpg", "combined_galo"),
]

CANVAS_HEIGHT = 700
LABEL_HEIGHT = 56
DIVIDER_WIDTH = 5

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

def create_combined(before_path, after_path, output_name):
    before = Image.open(os.path.join(BASE, before_path)).convert("RGB")
    after = Image.open(os.path.join(BASE, after_path)).convert("RGB")
    
    target_h = CANVAS_HEIGHT
    
    # Resize both to same height
    b_ratio = target_h / before.height
    b_new_w = int(before.width * b_ratio)
    before_resized = before.resize((b_new_w, target_h), Image.LANCZOS)
    
    a_ratio = target_h / after.height
    a_new_w = int(after.width * a_ratio)
    after_resized = after.resize((a_new_w, target_h), Image.LANCZOS)
    
    # Use same width for both (the larger one)
    max_w = max(b_new_w, a_new_w)
    # Cap max width to avoid overly wide images
    max_w = min(max_w, 600)
    
    def center_crop(img, target_w, target_h):
        if img.width >= target_w:
            left = (img.width - target_w) // 2
            return img.crop((left, 0, left + target_w, target_h))
        else:
            padded = Image.new("RGB", (target_w, target_h), (12, 12, 12))
            x_offset = (target_w - img.width) // 2
            padded.paste(img, (x_offset, 0))
            return padded
    
    before_final = center_crop(before_resized, max_w, target_h)
    after_final = center_crop(after_resized, max_w, target_h)
    
    total_w = max_w * 2 + DIVIDER_WIDTH
    total_h = target_h + LABEL_HEIGHT
    
    canvas = Image.new("RGB", (total_w, total_h), (10, 10, 10))
    draw = ImageDraw.Draw(canvas)
    
    # Paste images
    canvas.paste(before_final, (0, 0))
    canvas.paste(after_final, (max_w + DIVIDER_WIDTH, 0))
    
    # Dark gradient overlay at bottom of each image (for label readability)
    gradient = Image.new("RGBA", (max_w, 80), (0, 0, 0, 0))
    grad_draw = ImageDraw.Draw(gradient)
    for y in range(80):
        alpha = int(180 * (y / 80))
        grad_draw.line([(0, y), (max_w, y)], fill=(0, 0, 0, alpha))
    
    canvas_rgba = canvas.convert("RGBA")
    # Paste gradient at bottom of before image
    canvas_rgba.paste(gradient, (0, target_h - 80), gradient)
    # Paste gradient at bottom of after image
    canvas_rgba.paste(gradient, (max_w + DIVIDER_WIDTH, target_h - 80), gradient)
    canvas = canvas_rgba.convert("RGB")
    draw = ImageDraw.Draw(canvas)
    
    # Central divider - subtle dark line
    div_x = max_w
    draw.rectangle([div_x, 0, div_x + DIVIDER_WIDTH - 1, total_h], fill=(18, 18, 18))
    
    # === LABELS ===
    font_big = get_font(36)
    label_y = target_h
    
    # ANTES - deep red
    draw.rectangle([0, label_y, max_w, total_h], fill=(180, 30, 30))
    # DEPOIS - deep green
    draw.rectangle([max_w + DIVIDER_WIDTH, label_y, total_w, total_h], fill=(22, 130, 55))
    
    # ANTES text
    antes_text = "ANTES"
    antes_bbox = draw.textbbox((0, 0), antes_text, font=font_big)
    antes_tw = antes_bbox[2] - antes_bbox[0]
    antes_th = antes_bbox[3] - antes_bbox[1]
    antes_x = (max_w - antes_tw) // 2
    antes_y = label_y + (LABEL_HEIGHT - antes_th) // 2
    # Shadow
    draw.text((antes_x + 2, antes_y + 2), antes_text, fill=(80, 0, 0), font=font_big)
    draw.text((antes_x, antes_y), antes_text, fill=(255, 255, 255), font=font_big)
    
    # DEPOIS text
    depois_text = "DEPOIS"
    depois_bbox = draw.textbbox((0, 0), depois_text, font=font_big)
    depois_tw = depois_bbox[2] - depois_bbox[0]
    depois_th = depois_bbox[3] - depois_bbox[1]
    depois_x = max_w + DIVIDER_WIDTH + (max_w - depois_tw) // 2
    depois_y = label_y + (LABEL_HEIGHT - depois_th) // 2
    # Shadow
    draw.text((depois_x + 2, depois_y + 2), depois_text, fill=(0, 60, 0), font=font_big)
    draw.text((depois_x, depois_y), depois_text, fill=(255, 255, 255), font=font_big)
    
    # Save
    png_path = os.path.join(BASE, f"{output_name}.png")
    jpg_path = os.path.join(BASE, f"{output_name}.jpg")
    
    canvas.save(png_path, "PNG", optimize=True)
    canvas.save(jpg_path, "JPEG", quality=85, optimize=True)
    
    print(f"[OK] {output_name} -> {total_w}x{total_h} | JPG: {os.path.getsize(jpg_path) // 1024} KB")

if __name__ == "__main__":
    print("Gerando imagens combinadas v2...")
    for before, after, name in PAIRS:
        try:
            create_combined(before, after, name)
        except Exception as e:
            print(f"[ERRO] {name}: {e}")
    print("Concluido!")
