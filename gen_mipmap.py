from PIL import Image
import os

src = r"C:\temp\Projetos\painel-prime\apps\web\.open-next\assets\landingpage2\prime-logo-transparent.png"
res_dir = r"C:\pp-build\apps\mobile\android\app\src\main\res"

img = Image.open(src).convert("RGBA")

# Android adaptive icon sizes per density
sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Foreground sizes (108dp * density)
fg_sizes = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

for folder, size in sizes.items():
    folder_path = os.path.join(res_dir, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    # ic_launcher.webp - icon with white bg, cropped to square
    bg = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    logo = img.resize((int(size * 0.7), int(size * 0.7)), Image.LANCZOS)
    offset = (size - logo.width) // 2
    bg.paste(logo, (offset, offset), logo)
    bg.convert("RGB").save(os.path.join(folder_path, "ic_launcher.webp"), "WEBP", quality=90)
    
    # ic_launcher_round.webp - same but circular mask
    round_bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    round_bg.paste(logo, (offset, offset), logo)
    mask = Image.new("L", (size, size), 0)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(mask)
    draw.ellipse([0, 0, size-1, size-1], fill=255)
    round_bg.putalpha(mask)
    round_bg.convert("RGB").save(os.path.join(folder_path, "ic_launcher_round.webp"), "WEBP", quality=90)

    # ic_launcher_foreground.webp - transparent bg, logo centered in 108dp safe zone
    fg_size = fg_sizes[folder]
    fg = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
    logo_fg = img.resize((int(fg_size * 0.55), int(fg_size * 0.55)), Image.LANCZOS)
    offset_fg = (fg_size - logo_fg.width) // 2
    fg.paste(logo_fg, (offset_fg, offset_fg), logo_fg)
    fg.save(os.path.join(folder_path, "ic_launcher_foreground.webp"), "WEBP", quality=90)
    
    print(f"{folder}: OK")

print("All mipmap icons regenerated")
