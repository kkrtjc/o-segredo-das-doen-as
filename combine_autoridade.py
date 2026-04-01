"""
Professional Before/After Image Combiner
Replicates the style of transformacao_realista_v3.png:
- Square output (1:1 aspect ratio)
- Both images same height, side by side
- Thin white divider line in middle  
- No text overlays, no borders — clean and editorial
- Optimized JPEG output for fast mobile loading
"""
from PIL import Image, ImageFilter
import os

BASE = r"C:\Users\JOAO PAULO\Documents\GitHub\teste\autoridade"
OUTPUT_SIZE = 1024  # Square canvas
DIVIDER_WIDTH = 4   # Thin white line between halves
QUALITY = 85        # JPEG quality for web

def smart_crop_center(img, target_w, target_h):
    """Center-crop for best subject framing"""
    img_ratio = img.width / img.height
    target_ratio = target_w / target_h
    
    if img_ratio > target_ratio:
        # Image is wider — crop sides
        new_w = int(img.height * target_ratio)
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height))
    else:
        # Image is taller — crop top/bottom (bias slightly up for animal heads)
        new_h = int(img.width / target_ratio)
        top = max(0, int((img.height - new_h) * 0.35))  # Bias upward
        img = img.crop((0, top, img.width, top + new_h))
    
    return img.resize((target_w, target_h), Image.Resampling.LANCZOS)

def combine_before_after(before_path, after_path, output_name):
    """Combine two images into a single square before/after — matching reference style"""
    if not os.path.exists(before_path):
        print(f"  SKIP: {before_path} not found")
        return
    if not os.path.exists(after_path):
        print(f"  SKIP: {after_path} not found")
        return
    
    print(f"  Processing: {os.path.basename(before_path)} + {os.path.basename(after_path)}")
    
    before = Image.open(before_path).convert("RGB")
    after = Image.open(after_path).convert("RGB")
    
    # Each half is exactly half the canvas minus the divider
    half_w = (OUTPUT_SIZE - DIVIDER_WIDTH) // 2
    
    # Smart crop both images to fill their half perfectly
    before_cropped = smart_crop_center(before, half_w, OUTPUT_SIZE)
    after_cropped = smart_crop_center(after, half_w, OUTPUT_SIZE)
    
    # Create canvas and compose
    canvas = Image.new("RGB", (OUTPUT_SIZE, OUTPUT_SIZE), (255, 255, 255))
    canvas.paste(before_cropped, (0, 0))
    canvas.paste(after_cropped, (half_w + DIVIDER_WIDTH, 0))
    
    # Save as optimized JPEG for fast mobile loading
    output_path = os.path.join(BASE, output_name)
    canvas.save(output_path, "JPEG", quality=QUALITY, optimize=True)
    
    file_size_kb = os.path.getsize(output_path) / 1024
    print(f"  -> Saved: {output_name} ({OUTPUT_SIZE}x{OUTPUT_SIZE}, {file_size_kb:.0f}KB)")

print("=" * 50)
print("CREATING PROFESSIONAL BEFORE/AFTER IMAGES")
print("=" * 50)

# Pair 1: Franga
combine_before_after(
    os.path.join(BASE, "franga a1.jpeg"),
    os.path.join(BASE, "franga a2.png"),
    "pro_franga.jpg"
)

# Pair 2: Galinha doente
combine_before_after(
    os.path.join(BASE, "galinha doente 1 antes.png"),
    os.path.join(BASE, "galinha doente 1 depois.png"),
    "pro_galinha.jpg"
)

# Pair 3: Galo
combine_before_after(
    os.path.join(BASE, "galo doente.png"),
    os.path.join(BASE, "galo curado.jpg"),
    "pro_galo.jpg"
)

print("\nDone! All images created.")
