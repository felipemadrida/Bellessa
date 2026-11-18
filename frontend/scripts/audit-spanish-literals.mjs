/**
 * Gate de idioma: falla si aparece texto en español *hardcodeado* en la UI.
 *
 * Revisa dos superficies donde el texto acaba viéndose en pantalla:
 *   1. Nodos de texto JSX      →  ...>Texto visible<
 *   2. Atributos visibles      →  placeholder="…", aria-label="…", title="…",
 *                                 label="…", alt="…"
 *
 * No revisa comentarios, className, ni valores que van a la API (categorías,
 * etiquetas, unidades), porque esos son *datos* y deben quedarse como están.
 *
 * Uso: node scripts/audit-spanish-literals.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Archivos exentos a propósito:
 *  - AdminSaaS: panel interno de plataforma (no lo ve ningún salón).
 *  - PaletaPreview: laboratorio de diseño, no es producto.
 */
const ALLOWED_PATHS = [/pages[\\/]AdminSaaS\.tsx$/, /pages[\\/]PaletaPreview\.tsx$/, /locales[\\/]/]

/** Atributos cuyo contenido se lee o se escucha por la persona usuaria. */
const VISIBLE_ATTRS = ['placeholder', 'aria-label', 'title', 'label', 'alt']

/** Letras que solo existen en español (o casi). */
const ACCENTED = /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/

/** Palabras funcionales y vocabulario de producto que delatan español. */
const STOPWORDS = new Set([
  // gramática
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a',
  'en', 'con', 'sin', 'por', 'para', 'que', 'tu', 'tus', 'su', 'sus', 'mi', 'mis',
  'es', 'son', 'y', 'o', 'no', 'si', 'sí', 'más', 'mas', 'muy', 'ya', 'como',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'lo', 'le', 'les', 'se',
  'cuando', 'donde', 'todo', 'toda', 'todos', 'todas', 'hay', 'pero', 'aquí',
  // vocabulario del dominio
  'cita', 'citas', 'clienta', 'clientas', 'cliente', 'clientes', 'salón', 'salon',
  'servicio', 'servicios', 'cobro', 'cobros', 'propina', 'propinas', 'equipo',
  'agenda', 'caja', 'hoy', 'día', 'días', 'dia', 'dias', 'semana', 'mes', 'año',
  'nuevo', 'nueva', 'nuevos', 'nuevas', 'total', 'cliente', 'horario', 'horarios',
  'reserva', 'reservas', 'pago', 'pagos', 'gasto', 'gastos', 'inventario',
  'producto', 'productos', 'ajustes', 'reportes', 'correo', 'buscar', 'guardar',
])

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/** ¿El texto parece español? */
function looksSpanish(text) {
  if (ACCENTED.test(text)) return true
  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúñü\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return words.some((word) => STOPWORDS.has(word))
}

/** Descarta ruido: símbolos, números, clases, claves i18n y expresiones. */
function isNoise(text) {
  if (text.length < 2) return true
  if (!/[a-zA-ZÁÉÍÓÚÑáéíóúñ]/.test(text)) return true
  if (/^[{\[].*[}\]]$/.test(text)) return true
  // Claves i18n y rutas: minúsculas con puntos, sin espacios.
  if (/^[a-z][a-zA-Z0-9.]*$/.test(text) && !STOPWORDS.has(text.toLowerCase())) return true
  // Colores, URLs, correos, clases utilitarias.
  if (/^(https?:\/\/|mailto:|tel:)/i.test(text)) return true
  if (text.includes('@') && !text.includes(' ')) return true
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return true
  return false
}

function clean(raw) {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^[\s·•\-–—:|]+/, '')
    .replace(/[\s·•\-–—:|]+$/, '')
    .trim()
}

const findings = []

for (const file of sourceFiles(resolve(root, 'src'))) {
  const rel = relative(root, file).replace(/\\/g, '/')
  if (ALLOWED_PATHS.some((pattern) => pattern.test(file) || pattern.test(rel))) continue

  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  let inBlockComment = false

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false
      return
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true
      return
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return

    // 1. Nodos de texto JSX entre > y <
    const textNodes = line.matchAll(/>([^<>{}]{2,})</g)
    for (const match of textNodes) {
      const text = clean(match[1])
      if (isNoise(text)) continue
      if (looksSpanish(text)) {
        findings.push({ rel, line: index + 1, kind: 'jsx', text })
      }
    }

    // 2. Atributos visibles con literal de cadena
    for (const attr of VISIBLE_ATTRS) {
      // (?<![\w-]) evita que `label` vuelva a casar dentro de `aria-label`.
      const regex = new RegExp(`(?<![\\w-])${attr}\\s*=\\s*"([^"]{2,})"`, 'g')
      for (const match of line.matchAll(regex)) {
        const text = clean(match[1])
        if (isNoise(text)) continue
        if (looksSpanish(text)) {
          findings.push({ rel, line: index + 1, kind: attr, text })
        }
      }
    }
  })
}

if (findings.length) {
  console.error(`✗ ${findings.length} texto(s) en español hardcodeado:`)
  for (const finding of findings) {
    console.error(`  ${finding.rel}:${finding.line}  [${finding.kind}]  ${finding.text}`)
  }
  console.error('\nMuévelos a src/locales/{es,en}/translation.json y usa t(\'clave\').')
  process.exit(1)
}

console.log('Literales en español: 0 en JSX y 0 en atributos visibles')
console.log('✓ Toda la UI pasa por i18n.')
