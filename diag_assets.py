
import os
import re

def check_files():
    files_in_dir = os.listdir('.')
    lower_files = {f.lower(): f for f in files_in_dir}
    
    print("--- Verifying index.html ---")
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
        # Find src="..." and href="..."
        matches = re.finditer(r'(src|href)="([^"]+)"', content)
        for match in matches:
            path = match.group(2)
            if path.startswith('http') or path.startswith('#') or '?' in path:
                continue
            
            # Check local file
            if not os.path.exists(path):
                # Try case-insensitive
                base = os.path.basename(path)
                if base.lower() in lower_files:
                    print(f"[CASE ERROR] {path} referenced in HTML, but disk has {lower_files[base.lower()]}")
                else:
                    print(f"[MISSING] {path} referenced in HTML not found on disk.")

    print("\n--- Verifying style.css ---")
    if os.path.exists('style.css'):
        with open('style.css', 'r', encoding='utf-8') as f:
            content = f.read()
            matches = re.finditer(r'url\([\'"]?([^\'"\)]+)[\'"]?\)', content)
            for match in matches:
                path = match.group(1)
                if path.startswith('http') or path.startswith('data:'):
                    continue
                
                if not os.path.exists(path):
                    base = os.path.basename(path)
                    if base.lower() in lower_files:
                        print(f"[CASE ERROR] {path} referenced in CSS, but disk has {lower_files[base.lower()]}")
                    else:
                        print(f"[MISSING] {path} referenced in CSS not found on disk.")

if __name__ == "__main__":
    check_files()
