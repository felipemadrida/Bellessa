"""
Genera la hoja visual del TEMA NEGRO de la paleta "Quiet Luxury v2".

Uso:  python frontend/design/generate-palette-dark.py
Salida: frontend/design/paleta-quiet-luxury-dark.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).with_name("paleta-quiet-luxury-dark.png")

SERIF = "C:/Windows/Fonts/georgia.ttf"
SANS = "C:/Windows/Fonts/segoeui.ttf"
SANS_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
MONO = "C:/Windows/Fonts/consola.ttf"

CANVAS = "#12100D"
SURFACE = "#1A1613"
BORDER = "#3A322A"
INK = "#F3EBE1"
MUTED = "#B9A898"
TAUPE = "#C6B2A0"

W, H = 1400, 1180
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
    return INK if contrast(INK, bg) >= contrast("#1E1E1E", bg) else "#1E1E1E"


def blend(fg: str, bg: str, t: float) -> str:
    """Mezcla fg sobre bg para textos secundarios siempre legibles."""
    a = [int(fg[i : i + 2], 16) for i in (1, 3, 5)]
    b = [int(bg[i : i + 2], 16) for i in (1, 3, 5)]
    c = [round(a[i] * t + b[i] * (1 - t)) for i in range(3)]
    return "#" + "".join(f"{v:02X}" for v in c)


def chip(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str) -> None:
    draw.rounded_rectangle((x, y, x + w, y + h), radius=18, fill=color, outline=BORDER, width=1)


def label(draw: ImageDraw.ImageDraw, x: int, y: int, h: int, color: str, name: str, hexv: str, extra: str) -> None:
    on = ink_on(color)
    sec = blend(on, color, 0.78)
    draw.text((x + 18, y + h - 62), name, font=font(SANS_BOLD, 18), fill=on)
    draw.text((x + 18, y + h - 38), hexv, font=font(MONO, 16), fill=sec)
    if extra:
        draw.text((x + 18, y + h - 16), extra, font=font(SANS, 13), fill=sec)


def section(draw: ImageDraw.ImageDraw, y: int, title: str, note: str) -> None:
    draw.text((M, y), title, font=font(SANS_BOLD, 15), fill=TAUPE)
    draw.text((M + 300, y), note, font=font(SANS, 14), fill=MUTED)


image = Image.new("RGB", (W, H), CANVAS)
draw = ImageDraw.Draw(image)

draw.text((M, 54), "BELLESSA  ·  SISTEMA DE DISEÑO", font=font(SANS_BOLD, 14), fill=TAUPE)
draw.text((M, 78), "Quiet Luxury — Tema negro", font=font(SERIF, 50), fill=INK)
draw.text(
    (M, 146),
    "Negros cálidos con elevación por capas y acentos en tono joya. Nada de gris: el marrón cálido guía la profundidad.",
    font=font(SANS, 17),
    fill=MUTED,
)

# ---------------------------------------------------------------------------
# 1. Capas de elevación
# ---------------------------------------------------------------------------
layers = [
    ("Canvas", "#12100D", "Fondo de app"),
    ("Surface", "#1A1613", "Tarjetas"),
    ("Porcelain", "#221D19", "Superficie elevada"),
    ("Bisque", "#262019", "Superficie secundaria"),
    ("Sand / Chip", "#2B241D", "Chips e inputs"),
    ("Border", "#3A322A", "Hairlines"),
]
section(draw, 200, "CAPAS DE ELEVACIÓN", "cada nivel sube un escalón de luminosidad")
chip_w = (W - 2 * M - 5 * GAP) // 6
h_chip = 150
y = 232
for i, (name, hexv, extra) in enumerate(layers):
    x = M + i * (chip_w + GAP)
    chip(draw, x, y, chip_w, h_chip, hexv)
    label(draw, x, y, h_chip, hexv, name, hexv, extra)

# ---------------------------------------------------------------------------
# 2. Texto y acentos
# ---------------------------------------------------------------------------
accents = [
    ("Ink", "#F3EBE1", "Texto principal · 16.1:1"),
    ("Muted", "#B9A898", "Texto 2 · 8.3:1"),
    ("Taupe", "#C6B2A0", "Detalles · 8.8:1"),
    ("Blush Joya", "#5A3A44", "Acento nocturno"),
    ("Blush Texto", "#E9AEB9", "Acento · 7.5:1"),
    ("Oro Joya", "#6E5518", "Sello nocturno"),
    ("Oro Texto", "#D9B85C", "Metal · 9.4:1"),
    ("Salvia", "#A9C6B6", "Confirmada · 8.1:1"),
]
section(draw, 424, "TEXTO Y ACENTOS", "los acentos bajan a joya; el texto sube a marfil")
h_chip2 = 132
for row in range(2):
    y = 456 + row * (h_chip2 + GAP)
    for col in range(4):
        name, hexv, extra = accents[row * 4 + col]
        x = M + col * (chip_w + GAP)
        chip(draw, x, y, chip_w, h_chip2, hexv)
        label(draw, x, y, h_chip2, hexv, name, hexv, extra)

# ---------------------------------------------------------------------------
# 3. Antes / después
# ---------------------------------------------------------------------------
section(draw, 780, "ANTES  →  DESPUÉS", "se corrigen los huecos del tema negro anterior")
comparisons = [
    ("Tarjetas", "#FFFFFF", "#1A1613", "blanco", "surface", "ya no deslumbran"),
    ("Botón primario", "#1C1712", "#0C0A08", "se perdía", "negro real", "vuelve a leerse"),
    ("Blush nocturno", "#3A1F26", "#3A2630", "apagado", "joya", "cálido y vivo"),
    ("Chips", "#241F1B", "#2B241D", "plano", "con relieve", "jerarquía clara"),
]
y = 812
box_w = (W - 2 * M - 3 * GAP) // 4
for i, (name, old, new, old_txt, new_txt, note) in enumerate(comparisons):
    x = M + i * (box_w + GAP)
    draw.rounded_rectangle((x, y, x + box_w, y + 210), radius=18, fill=SURFACE, outline=BORDER, width=1)
    draw.text((x + 18, y + 16), name, font=font(SANS_BOLD, 16), fill=INK)
    r = 27
    draw.ellipse((x + 18, y + 48, x + 18 + 2 * r, y + 48 + 2 * r), fill=old, outline=BORDER)
    draw.text((x + 18, y + 108), old, font=font(MONO, 13), fill=MUTED)
    draw.text((x + 18, y + 124), old_txt, font=font(SANS, 12), fill=MUTED)
    draw.text((x + 88, y + 54), "→", font=font(SANS, 22), fill=MUTED)
    draw.ellipse((x + 122, y + 48, x + 122 + 2 * r, y + 48 + 2 * r), fill=new, outline=BORDER)
    draw.text((x + 122, y + 108), new, font=font(MONO, 13), fill=INK)
    draw.text((x + 122, y + 124), new_txt, font=font(SANS_BOLD, 12), fill=INK)
    draw.text((x + 18, y + 158), note, font=font(SANS, 13), fill=MUTED)

# ---------------------------------------------------------------------------
# Pie
# ---------------------------------------------------------------------------
draw.line((M, H - 78, W - M, H - 78), fill=BORDER, width=1)
draw.text(
    (M, H - 62),
    "20 pares verificados en tema negro · 47 en total (claro + negro) · WCAG 2.2 AA · gate en `npm run build`",
    font=font(SANS, 13),
    fill=MUTED,
)
draw.text((W - M - 300, H - 62), "Bellessa · Quiet Luxury", font=font(SERIF, 16), fill=INK)

OUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUT, "PNG")
print(f"OK -> {OUT}")
