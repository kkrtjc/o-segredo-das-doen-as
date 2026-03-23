
import os

file_path = r'C:\Users\JOAO PAULO\Documents\GitHub\teste\guia-doencas-completo.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix showSection to close overlay
old_code = """            // Close mobile menu
            document.getElementById('sidebar').classList.remove('open');"""

new_code = """            // Close mobile menu
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully updated showSection to close overlay.")
else:
    print("Could not find the target code block in showSection.")
