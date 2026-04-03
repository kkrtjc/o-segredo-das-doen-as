import os, re
from PIL import Image

def process_heavy_files():
    folder = r'C:\Users\JOAO PAULO\Documents\GitHub\teste'
    files_to_check = ['index.html', 'admin.html', 'style.css']
    
    used_images = set()
    img_regexes = [
        re.compile(r'href=[\"\'\\]*([^\"\'>]+\.(?:png|jpg|jpeg))', re.I),
        re.compile(r'src=[\"\'\\]*([^\"\'>]+\.(?:png|jpg|jpeg))', re.I),
        re.compile(r'url\([\"\']?([^\"\'\)]+\.(?:png|jpg|jpeg))[\"\']?\)', re.I)
    ]
    
    for f in files_to_check:
        try:
            content = open(os.path.join(folder, f), 'r', encoding='utf-8').read()
            for regex in img_regexes:
                for match in regex.findall(content):
                    used_images.add(match)
        except Exception as e:
            print(f'Error reading {f}: {e}')

    converted = set()
    for img_path in used_images:
        cpath = img_path.split('?')[0] # remove query params
        abs_path = os.path.join(folder, cpath.replace('/', os.sep))
        
        if os.path.exists(abs_path):
            size_kb = os.path.getsize(abs_path) / 1024
            if size_kb > 150: # convert if > 150KB
                print(f'Converting {cpath} ({size_kb:.1f} KB)')
                base, ext = os.path.splitext(abs_path)
                webp_path = base + '.webp'
                new_rel_path = os.path.splitext(cpath)[0] + '.webp'
                try:
                    img = Image.open(abs_path)
                    if img.mode in ('RGBA', 'P'):
                        img = img.convert('RGBA')
                    else:
                        img = img.convert('RGB')
                    img.save(webp_path, 'WEBP', quality=80, method=6)
                    converted.add((cpath, new_rel_path))
                except Exception as e:
                    print(f'Error converting {cpath}: {e}')
    
    print(f'\nConverted {len(converted)} files. Updating html/css references...')
    
    for f in files_to_check:
        path = os.path.join(folder, f)
        try:
            content = open(path, 'r', encoding='utf-8').read()
            original_content = content
            # Replacing old paths with webp path manually
            for old_img, new_img in converted:
                content = content.replace(old_img, new_img)
            
            if content != original_content:
                open(path, 'w', encoding='utf-8').write(content)
                print(f'Updated {f}')
        except Exception as e:
            pass

if __name__ == "__main__":
    process_heavy_files()
