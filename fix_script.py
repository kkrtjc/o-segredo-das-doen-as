
import os

file_path = r"C:\Users\JOAO PAULO\.gemini\antigravity\scratch\osegredodasgalinhas\script.js"

try:
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        lines = f.readlines()
        
    print(f"Original lines: {len(lines)}")
    
    # Truncate at line 1860
    truncated_lines = lines[:1860]
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(truncated_lines)
        
    print(f"Truncated to {len(truncated_lines)} lines")

except Exception as e:
    print(f"Error: {e}")
