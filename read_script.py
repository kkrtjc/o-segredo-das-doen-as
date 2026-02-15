
import sys

file_path = r"C:\Users\JOAO PAULO\.gemini\antigravity\scratch\osegredodasgalinhas\script.js"

try:
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        lines = f.readlines()
        
    start = max(0, 1850)
    end = min(len(lines), 1870)
    
    print(f"Reading lines {start+1} to {end}:")
    for i in range(start, end):
        print(f"{i+1}: {lines[i]}", end='')

except Exception as e:
    print(f"Error: {e}")
