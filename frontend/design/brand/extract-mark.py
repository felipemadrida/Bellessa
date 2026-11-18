"""
Convierte el logo fuente (dos perfiles, gris + oro sobre blanco) en la marca de
Bellessa lista para producción:

  * fondo transparente (el blanco se vuelve alfa, conservando el antialias)
  * recoloreado a la paleta Quiet Luxury, en dos variantes (clara y oscura)
  * iconos de app (PWA, apple-touch-icon, favicon) con fondo licorice

Uso: python design/brand/extract-mark.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PUBLIC = ROOT / "public"
SOURCE = HERE / "source-logo.png"

LICORICE = (30, 30, 30)
WHITE = (255, 255, 255)

# Variante para fondos claros: taupe cálido + oro legible.
LIGHT_LEFT = (138, 106, 94)      # #8A6A5E
LIGHT_RIGHT = (194, 154, 46)     # #C29A2E
# Variante para fondos oscuros: arena clara + champagne.
DARK_LEFT = (201, 181, 168)      # #C9B5A8
DARK_RIGHT = (212, 175, 55)      # #D4AF37

GRAY_INK_FALLBACK = (138, 138, 138)
GOLD_INK_FALLBACK = (201, 162, 39)


def luminance(px: tuple[int, int, int]) -> float:
    r, g, b = px[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def is_gold(px: tuple[int, int, int]) -> bool:
    r, g, b = px[:3]
    return (r - b) > 34


def ink_references() -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    """Estima el color real de cada tinta (mediana de los píxeles más densos).

    Sin esto, el alfa se calcula contra un color supuesto y el oro sale lavado
    (semana transparente sobre alabaster).
    """
    src = Image.open(SOURCE).convert("RGB")
    src_px = src.load()
    width, height = src.size
    gray: list[tuple[int, int, int]] = []
    gold: list[tuple[int, int, int]] = []

    for y in range(0, height, 3):
        for x in range(0, width, 3):
            px = src_px[x, y]
            if px[0] > 244 and px[1] > 244 and px[2] > 244:
                continue
            if luminance(px) > 205:
                continue
            (gold if is_gold(px) else gray).append(px)

    def median(samples: list[tuple[int, int, int]], fallback: tuple[int, int, int]):
        if not samples:
            return tuple(float(c) for c in fallback)
        return tuple(
            float(sorted(sample[channel] for sample in samples)[len(samples) // 2])
            for channel in range(3)
        )

    return median(gray, GRAY_INK_FALLBACK), median(gold, GOLD_INK_FALLBACK)


def build_mask(gray_ink, gold_ink) -> Image.Image:
    """Devuelve blanco con el alfa extraído del blanco."""
    src = Image.open(SOURCE).convert("RGB")
    width, height = src.size
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    src_px = src.load()
    out_px = out.load()

    for y in range(height):
        for x in range(width):
            px = src_px[x, y]
            r, g, b = px
            # Blanco puro (o casi) → transparente.
            if r > 244 and g > 244 and b > 244:
                continue
            ink = gold_ink if is_gold(px) else gray_ink
            # Alfa = qué tanto se alejó del blanco hacia la tinta, por canal.
            ratios = [
                (255.0 - px[channel]) / (255.0 - ink[channel])
                for channel in range(3)
                if ink[channel] < 250
            ]
            alpha = sum(ratios) / len(ratios) if ratios else 0.0
            alpha = max(0.0, min(1.0, alpha))
            if alpha <= 0.02:
                continue
            out_px[x, y] = (255, 255, 255, int(round(alpha * 255)))
    return out


def recolor(mask: Image.Image, left: tuple[int, int, int], right: tuple[int, int, int]) -> Image.Image:
    """Aplica color plano por región (izquierda / derecha) respetando el alfa."""
    src = Image.open(SOURCE).convert("RGB")
    width, height = src.size
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    src_px = src.load()
    mask_px = mask.load()
    out_px = out.load()
    mid = width / 2

    for y in range(height):
        for x in range(width):
            _, _, _, a = mask_px[x, y]
            if a == 0:
                continue
            px = src_px[x, y]
            # El perfil izquierdo es gris, el derecho oro; la posición desempata
            # los píxeles del borde donde el tono es ambiguo.
            gold = is_gold(px) or (abs(px[0] - px[2]) <= 34 and x > mid)
            color = right if gold else left
            out_px[x, y] = (*color, a)
    return out


def trim(img: Image.Image, pad_ratio: float = 0.03) -> Image.Image:
    """Recorta al contenido y devuelve un lienzo cuadrado con margen óptico."""
    bbox = img.getbbox()
    if not bbox:
        return img
    cut = img.crop(bbox)
    side = max(cut.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2), cut)
    pad = int(side * pad_ratio)
    canvas = canvas.resize((side + pad * 2, side + pad * 2), Image.LANCZOS)
    return canvas


def single_profile(mark: Image.Image) -> Image.Image:
    """Recorta solo el perfil dorado (mitad derecha) para el favicon.

    A 16–32 px la pareja de rostros se vuelve papilla; un solo perfil mantiene
    la lectura de "salón" sin perder nitidez.
    """
    width, height = mark.size
    half = mark.crop((width // 2, 0, width, height))
    return trim(half, pad_ratio=0.04)


def compose_icon(mark: Image.Image, size: int, bg: tuple[int, int, int] = (249, 246, 240),
                 inset: float = 0.13) -> Image.Image:
    """Icono con fondo redondeado (alabaster por defecto) y la marca centrada."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    from PIL import ImageDraw

    draw = ImageDraw.Draw(canvas)
    radius = int(size * 0.22)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=bg)
    # Hairline cálido para que el icono no se funda con el chrome del navegador.
    if size >= 48:
        draw.rounded_rectangle(
            [(0, 0), (size - 1, size - 1)], radius=radius,
            outline=(234, 223, 210), width=max(1, size // 128),
        )
    side = int(size * (1 - inset * 2))
    art = mark.resize((side, side), Image.LANCZOS)
    offset = (size - side) // 2
    canvas.paste(art, (offset, offset), art)
    return canvas


if __name__ == "__main__":
    gray_ink, gold_ink = ink_references()
    print("tinta gris:", tuple(int(c) for c in gray_ink), "| tinta oro:", tuple(int(c) for c in gold_ink))
    mask = build_mask(gray_ink, gold_ink)
    light = trim(recolor(mask, LIGHT_LEFT, LIGHT_RIGHT))
    dark = trim(recolor(mask, DARK_LEFT, DARK_RIGHT))

    light.save(HERE / "brand-mark-light.png")
    dark.save(HERE / "brand-mark-dark.png")

    # Marca para la UI (2x de 96 px). Se usa la variante clara: en la interfaz
    # siempre va sobre un disco porcelain, así el negativo de las caras es claro.
    light.resize((192, 192), Image.LANCZOS).save(PUBLIC / "brand-mark.png")

    compose_icon(light, 512).save(PUBLIC / "icon-512.png")
    compose_icon(light, 192).save(PUBLIC / "icon-192.png")
    compose_icon(light, 180).save(PUBLIC / "icon-180.png")
    compose_icon(dark, 48, bg=LICORICE, inset=0.04).save(PUBLIC / "favicon-48.png")

    # Favicon: la pareja de perfiles sobre licorice da el mayor contraste a 16–32 px
    # (el negativo de las caras se lee como silueta). Un solo perfil sobre crema se
    # desvanecía a ese tamaño.
    compose_icon(dark, 32, bg=LICORICE, inset=0.02).save(PUBLIC / "favicon-32.png")
    compose_icon(dark, 16, bg=LICORICE, inset=0.0).save(PUBLIC / "favicon-16.png")

    # Hoja de contacto
    sheet = Image.new("RGBA", (860, 420), (255, 255, 255, 255))
    big_light = compose_icon(light, 240)
    big_dark = compose_icon(dark, 240, bg=LICORICE)
    from PIL import ImageDraw

    sheet.paste(big_light, (35, 90), big_light)
    sheet.paste(big_dark, (310, 90), big_dark)
    for index, size in enumerate((96, 64, 32, 24)):
        small = compose_icon(light, size)
        sheet.paste(small, (620, 80 + index * 78), small)
    sheet.save(HERE / "preview.png")

    # Vista en contexto: cómo se ve la marca a tamaño real en la interfaz.
    ui = Image.new("RGBA", (720, 300), (255, 255, 255, 255))
    ui_draw = ImageDraw.Draw(ui)
    ui_draw.rounded_rectangle([(0, 0), (359, 299)], radius=0, fill=(249, 246, 240))
    ui_draw.rounded_rectangle([(360, 0), (719, 299)], radius=0, fill=(18, 17, 16))

    mark_small = light.resize((96, 96), Image.LANCZOS)
    for column, (bg_x, disc) in enumerate(((20, (251, 247, 241)), (380, (251, 247, 241)))):
        for index, size in enumerate((34, 38, 52, 96)):
            y = 40 + index * 58
            ui_draw.rounded_rectangle(
                [(bg_x, y), (bg_x + size - 1, y + size - 1)],
                radius=max(6, int(size * 0.37)), fill=disc,
                outline=(234, 223, 210), width=1,
            )
            art = light.resize((size, size), Image.LANCZOS)
            ui.paste(art, (bg_x, y), art)
    ui_draw.text((150, 60), "sidebar 34-38px", fill=(111, 90, 80))
    ui_draw.text((150, 110), "header 52px", fill=(111, 90, 80))
    ui_draw.text((150, 165), "splash 96px", fill=(111, 90, 80))
    ui_draw.text((510, 60), "dark theme", fill=(201, 181, 168))
    ui.save(HERE / "preview-ui.png")
    print("marca y iconos generados")
