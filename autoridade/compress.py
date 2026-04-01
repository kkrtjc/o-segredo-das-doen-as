import os
from PIL import Image

def convert_to_webp(directory):
    supported_formats = ('.png', '.jpg', '.jpeg')
    images_to_convert = ['bouba.jpg', 'coccidiose.jpg', 'coriza.jpg', 'vermes.jpg']
    
    for filename in os.listdir(directory):
        if filename in images_to_convert or filename.lower().endswith(supported_formats):
            filepath = os.path.join(directory, filename)
            filesize_kb = os.path.getsize(filepath) / 1024
            
            print(f"Checking {filename} ({filesize_kb:.2f} KB)...")
            try:
                img = Image.open(filepath)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                new_filename = os.path.splitext(filename)[0] + ".webp"
                new_filepath = os.path.join(directory, new_filename)
                
                img.save(new_filepath, format="WEBP", quality=65, method=6)
                
                new_filesize_kb = os.path.getsize(new_filepath) / 1024
                print(f"Done: {new_filename} -> {new_filesize_kb:.2f} KB (Saved {(filesize_kb - new_filesize_kb):.2f} KB)")
            except Exception as e:
                print(f"Error compressing {filename}: {e}")

if __name__ == "__main__":
    target_dir = r"c:\Users\JOAO PAULO\Documents\GitHub\teste\autoridade"
    convert_to_webp(target_dir)
