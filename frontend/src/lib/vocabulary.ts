/**
 * Traducción del vocabulario operativo del salón: categorías de servicio y
 * etiquetas de clienta.
 *
 * Los valores se guardan en español en la base de datos (es el idioma de
 * captura), y aquí solo se traducen **para mostrarlos**. Así cambiar el idioma
 * de la interfaz no altera los datos, y cualquier categoría personalizada que
 * no esté en el catálogo se muestra tal cual la escribió el salón.
 */
const VOCABULARY: Record<string, string> = {
  cabello: 'catalog.hair',
  color: 'catalog.color',
  unas: 'catalog.nails',
  peinado: 'catalog.styling',
  makeup: 'catalog.makeup',
  facial: 'catalog.facial',
  novias: 'catalog.bridal',
  balayage: 'catalog.balayage',
  vip: 'catalog.vip',
  recurrente: 'catalog.recurring',
  frecuente: 'catalog.frequent',
  nueva: 'catalog.new',
  general: 'catalog.general',
}

type Translate = (key: string) => string

/** Minúsculas y sin acentos, para que "Uñas" y "unas" caigan en la misma clave. */
export function normalizeVocabulary(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Traduce una categoría o etiqueta conocida; si no lo es, devuelve el original. */
export function vocabularyLabel(value: string, t: Translate): string {
  const key = VOCABULARY[normalizeVocabulary(value)]
  if (!key) return value
  const translated = t(key)
  return translated && translated !== key ? translated : value
}

/** Separa la cadena de etiquetas guardada como "VIP,Color" en una lista. */
export function splitTags(tags: string | null | undefined): string[] {
  return (tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/**
 * Traduce una clave de catálogo del backend (plantilla de marketing o segmento)
 * y cae al texto que mandó la API cuando aún no hay traducción.
 */
export function catalogKeyLabel(
  namespace: 'wa.tpl' | 'wa.seg' | 'wa.kind' | 'wa.st' | 'manual.status',
  key: string,
  fallback: string,
  t: Translate,
): string {
  const full = `${namespace}.${key}`
  const translated = t(full)
  return translated && translated !== full ? translated : fallback
}
