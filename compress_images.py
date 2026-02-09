import os
from PIL import Image

def compress_images(directory, quality=75):
    supported_formats = ('.png', '.jpg', '.jpeg')
    for filename in os.listdir(directory):
        if filename.lower().endswith(supported_formats):
            filepath = os.path.join(directory, filename)
            filesize_kb = os.path.getsize(filepath) / 1024
            
            if filesize_kb > 200: # Compress only if > 200KB
                print(f"Compressing {filename} ({filesize_kb:.2f} KB)...")
                try:
                    img = Image.open(filepath)
                    # Convert to RGB if saving as JPG
                    if filename.lower().endswith('.png'):
                        # Keep PNG but optimize
                        img.save(filepath, optimize=True)
                    else:
                        img.save(filepath, quality=quality, optimize=True)
                    
                    new_filesize_kb = os.path.getsize(filepath) / 1024
                    print(f"Done: {new_filesize_kb:.2f} KB (Saved {(filesize_kb - new_filesize_kb):.2f} KB)")
                except Exception as e:
                    print(f"Error compressing {filename}: {e}")

if __name__ == "__main__":
    target_dir = r"c:\Users\JOAO PAULO\.gemini\antigravity\scratch\osegredodasgalinhas"
    compress_images(target_dir)
    # Also check subdirectories like 'carrosel'
    carrosel_dir = os.path.join(target_dir, "carrosel")
    if os.path.exists(carrosel_dir):
        compress_images(carrosel_dir)
