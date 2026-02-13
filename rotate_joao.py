from PIL import Image
import os

# Path to the image
image_path = r"c:\Users\JOAO PAULO\.gemini\antigravity\scratch\osegredodasgalinhas\carrosel\joao_new.jpg"

# Open the image
img = Image.open(image_path)

# Rotate 90 degrees clockwise (to the right)
rotated_img = img.rotate(-90, expand=True)

# Save the rotated image (overwrite the original)
rotated_img.save(image_path, quality=95)

print(f"✅ Image rotated 90° clockwise and saved to {image_path}")
