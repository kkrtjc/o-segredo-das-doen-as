
import fitz  # PyMuPDF
import sys

pdf_path = "ebook_doencas.pdf"
output_path = "first_page.png"

try:
    doc = fitz.open(pdf_path)
    if len(doc) < 1:
        print("Error: PDF has no pages.")
        sys.exit(1)

    page = doc.load_page(0)  # number of page
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # Double resolution for better quality
    pix.save(output_path)
    print(f"Successfully saved first page to {output_path}")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
