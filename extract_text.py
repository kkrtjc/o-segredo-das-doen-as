
import fitz  # PyMuPDF
import sys

pdf_path = "ebook_doencas.pdf"

try:
    doc = fitz.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"
    
    with open("ebook_content.txt", "w", encoding="utf-8") as f:
        f.write(full_text)
    print("Successfully extracted text to ebook_content.txt")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
