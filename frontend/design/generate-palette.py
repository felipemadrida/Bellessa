"""
Genera la hoja visual de la paleta "Quiet Luxury v2" de Bellessa.

Uso:  python frontend/design/generate-palette.py
Salida: frontend/design/paleta-quiet-luxury-v2.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).with_name("paleta-quiet-luxury-v2.png")

SERIF = "C:/Windows/Fonts/georgia.ttf"
SANS = "C:/Windows/Fonts/segoeui.ttf"
SANS_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
MONO = "C:/Windows/Fonts/consola.ttf"

ALABASTER = "#F9F6F0"
LICORICE = "#1E1E1E"
BORDER = "#EADFD2"
MUTED = "#6F5A50"

W, H = 1400, 1120
M = 72
GAP = 24


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def luminance(hex_color: str) -> float:
    rgb = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def ink_on(bg: str) -> str:
    return LICORICE if contrast(LICORICE, bg) >= contrast(ALABASTER, bg) else ALABASTER


def chip(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str) -> None:
    draw.rounded_rectangle((x, y, x + w, y + h), radius=18, fill=color, outline=BORDER, width=1)


def label(draw: ImageDraw.ImageDraw, x: int, y: int, h: int, name: str, hexv: str, extra: str, on: str) -> None:
    draw.text((x + 18, y + h - 62), name, font=font(SANS_BOLD, 18), fill=on)
    draw.text((x + 18, y + h - 38), hexv, font=font(MONO, 16), fill=on)
    if extra:
        draw.text((x + 18, y + h - 16), extra, font=font(SANS, 13), fill=on)


def section(draw: ImageDraw.ImageDraw, y: int, title: str, note: str) -> None:
    draw.text((M, y), title, font=font(SANS_BOLD, 15), fill=MUTED)
    draw.text((M + 250, y), note, font=font(SANS, 14), fill=MUTED)


image = Image.new("RGB", (W, H), ALABASTER)
draw = ImageDraw.Draw(image)


draw.text((M, 54), "BELLESSA  ·  SISTEMA DE DISEÑO", font=font(SANS_BOLD, 14), fill=MUTED)
draw.text((M, 78), "Paleta Quiet Luxury v2", font=font(SERIF, 52), fill=LICORICE)
draw.text(
    (M, 148),
    "Neutros cálidos: se eliminan los grises desaturados (taupe grisáceo y plata fría) que ensuciaban la interfaz.",
    font=font(SANS, 17),
    fill=MUTED,
)

# ---------------------------------------------------------------------------
# 1. Anclas de marca
# ---------------------------------------------------------------------------
anchors = [
    ("Alabaster White", "#F9F6F0", "Fondo base · 15.5:1"),
    ("Blush Rose", "#E8C5C8", "Acento suave · 10.5:1"),
    ("Champagne Gold", "#D4AF37", "Metal y sellos · 7.9:1"),
    ("Licorice Black", "#1E1E1E", "Tinta principal"),
]
section(draw, 200, "ANCLAS DE MARCA", "sin cambios: son la firma visual")
w_chip = (W - 2 * M - 3 * GAP) // 4
h_chip = 150
y = 232
for i, (name, hexv, extra) in enumerate(anchors):
    x = M + i * (w_chip + GAP)
    chip(draw, x, y, w_chip, h_chip, hexv)
    label(draw, x, y, h_chip, name, hexv, extra, ink_on(hexv))
    # círculo de acento
    draw.ellipse((x + w_chip - 46, y + 16, x + w_chip - 20, y + 42), outline=ink_on(hexv), width=2)

# ---------------------------------------------------------------------------
# 2. Neutros cálidos
# ---------------------------------------------------------------------------
neutrals = [
    ("Porcelain", "#FBF7F1", "Superficie elevada"),
    ("Bisque", "#F1E7DA", "Superficie secundaria"),
    ("Warm Sand", "#F3E9DD", "Chips e inputs"),
    ("Warm Border", "#EADFD2", "Hairlines"),
    ("Champagne Silver", "#D9CBBA", "Metal/plata cálida"),
    ("Silver Deep", "#9C8877", "Bordes · 3.1:1"),
    ("Rosewood Taupe", "#8A6A5E", "Texto 2 · 4.52:1 AA"),
    ("Mocha", "#4E3A33", "Neutro profundo · 9.9:1"),
]
section(draw, 424, "NEUTROS CÁLIDOS (v2)", "croma 8–16, tinte cálido h≈47–78")
h_chip2 = 132
for row in range(2):
    y = 456 + row * (h_chip2 + GAP)
    for col in range(4):
        name, hexv, extra = neutrals[row * 4 + col]
        x = M + col * (w_chip + GAP)
        chip(draw, x, y, w_chip, h_chip2, hexv)
        label(draw, x, y, h_chip2, name, hexv, extra, ink_on(hexv))

# ---------------------------------------------------------------------------
# 3. Antes / después
# ---------------------------------------------------------------------------
section(draw, 780, "ANTES  →  DESPUÉS", "el gris se vuelve cálido y legible")
comparisons = [
    ("Warm Taupe", "#8B7A74", "#8A6A5E", "3.79:1", "4.52:1", "ahora pasa AA"),
    ("Plata / Silver", "#C9C6C2", "#D9CBBA", "gris frío", "champán", "armoniza con oro"),
    ("Hairline", "#E6DED4", "#EADFD2", "grisáceo", "cálido", "menos dureza"),
    ("Texto secundario", "#6E605A", "#6F5A50", "5.59:1", "5.98:1", "más cálido y legible"),
]
y = 812
box_w = (W - 2 * M - 3 * GAP) // 4
for i, (name, old, new, old_ratio, new_ratio, note) in enumerate(comparisons):
    x = M + i * (box_w + GAP)
    draw.rounded_rectangle((x, y, x + box_w, y + 210), radius=18, fill="#FFFFFF", outline=BORDER, width=1)
    draw.text((x + 18, y + 16), name, font=font(SANS_BOLD, 16), fill=LICORICE)
    # muestras
    r = 27
    draw.ellipse((x + 18, y + 48, x + 18 + 2 * r, y + 48 + 2 * r), fill=old, outline=BORDER)
    draw.text((x + 18, y + 108), old, font=font(MONO, 13), fill=MUTED)
    draw.text((x + 18, y + 124), old_ratio, font=font(SANS, 12), fill=MUTED)
    draw.text((x + 88, y + 54), "→", font=font(SANS, 22), fill=MUTED)
    draw.ellipse((x + 122, y + 48, x + 122 + 2 * r, y + 48 + 2 * r), fill=new, outline=BORDER)
    draw.text((x + 122, y + 108), new, font=font(MONO, 13), fill=LICORICE)
    draw.text((x + 122, y + 124), new_ratio, font=font(SANS_BOLD, 12), fill=LICORICE)
    draw.text((x + 18, y + 158), note, font=font(SANS, 13), fill=MUTED)

# ---------------------------------------------------------------------------
# Pie
# ---------------------------------------------------------------------------
draw.line((M, H - 78, W - M, H - 78), fill=BORDER, width=1)
draw.text(
    (M, H - 62),
    "27 pares de contraste verificados · WCAG 2.2 AA · gated en `npm run build` (audit-contrast.mjs)",
    font=font(SANS, 13),
    fill=MUTED,
)
draw.text(
    (W - M - 320, H - 62),
    "Bellessa · Quiet Luxury",
    font=font(SERIF, 16),
    fill=LICORICE,
)

OUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUT, "PNG")
print(f"OK -> {OUT}")
