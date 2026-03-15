from PIL import Image
import os

png_path = r'C:\Users\JOAO PAULO\Documents\GitHub\teste\capadospintinhos.png'
jpg_path = r'C:\Users\JOAO PAULO\Documents\GitHub\teste\capadospintinhos.jpg'

if os.path.exists(png_path):
    try:
        img = Image.open(png_path)
        # Convert to RGB if needed (PNG might be RGBA)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(jpg_path, "JPEG", quality=90)
        print(f"Successfully converted {png_path} to {jpg_path}")
    except Exception as e:
        print(f"Error during conversion: {e}")
else:
    print(f"File not found: {png_path}")
