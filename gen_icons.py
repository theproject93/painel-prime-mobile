from PIL import Image

src = r"C:\temp\Projetos\painel-prime\apps\web\.open-next\assets\landingpage2\prime-logo-transparent.png"
out_dir = r"C:\pp-build\apps\mobile\assets"

img = Image.open(src).convert("RGBA")

# icon.png - 1024x1024 with white background
icon = Image.new("RGBA", (1024, 1024), (255, 255, 255, 255))
logo_size = 700
logo_resized = img.resize((logo_size, logo_size), Image.LANCZOS)
offset = (1024 - logo_size) // 2
icon.paste(logo_resized, (offset, offset), logo_resized)
icon.save(out_dir + "/icon.png", "PNG")
print("icon.png OK")

# adaptive-icon.png - transparent foreground centered
adaptive = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
logo_size_a = 600
logo_resized_a = img.resize((logo_size_a, logo_size_a), Image.LANCZOS)
offset_a = (1024 - logo_size_a) // 2
adaptive.paste(logo_resized_a, (offset_a, offset_a), logo_resized_a)
adaptive.save(out_dir + "/adaptive-icon.png", "PNG")
print("adaptive-icon.png OK")

# splash-icon.png - same
adaptive.save(out_dir + "/splash-icon.png", "PNG")
print("splash-icon.png OK")

# Also copy to nested assets/assets/ if it exists
import os
nested = out_dir + "/assets"
if os.path.isdir(nested):
    icon.save(nested + "/icon.png", "PNG")
    adaptive.save(nested + "/adaptive-icon.png", "PNG")
    adaptive.save(nested + "/splash-icon.png", "PNG")
    print("nested assets OK")

print("All done")
