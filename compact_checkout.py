import os

file_path = r'c:\Users\JOAO PAULO\.gemini\antigravity\scratch\osegredodasgalinhas\style.css'

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for i in range(len(lines)):
    # Modal Compactness
    if 'max-width: 500px;' in lines[i]:
        lines[i] = lines[i].replace('500px', '440px')
    
    # Specific padding for checkout container
    if 'padding: 2rem;' in lines[i]:
        # Simple check for nearby checkout-container
        context = "".join(lines[max(0, i-15):i])
        if '.checkout-container' in context:
            lines[i] = lines[i].replace('2rem', '1.2rem')
    
    # Header Compactness
    if 'margin-bottom: 1.5rem;' in lines[i]:
        context = "".join(lines[max(0, i-5):i])
        if '.checkout-header' in context:
             lines[i] = lines[i].replace('1.5rem', '0.8rem')
    
    # Font Size
    if 'font-size: 1.8rem;' in lines[i]:
        context = "".join(lines[max(0, i-5):i])
        if '.checkout-header h3' in context:
            lines[i] = lines[i].replace('1.8rem', '1.50rem')
    
    # Input Padding (Remove icon space)
    if 'padding: 12px 12px 12px 45px !important;' in lines[i]:
        lines[i] = lines[i].replace('12px 12px 12px 45px !important;', '12px 15px !important;')

# Global hide icons just in case
lines.append('\n/* Simplified Checkout Refresh */\n.input-wrapper i { display: none !important; }\n')

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Styles updated successfully.")
