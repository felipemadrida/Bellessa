#!/usr/bin/env node
/**
 * Auditoría de consistencia del sistema de diseño "Quiet Luxury".
 *
 * Verifica que toda clase utilitaria de color/forma/sombra usada en
 * `src/**\/*.{ts,tsx}` exista realmente en el CSS compilado por Tailwind.
 * Detecta clases inexistentes (p. ej. `rounded-4xl` en Tailwind 3), que se
 * traducen en estilos rotos silenciosos.
 *
 * Uso:
 *   node scripts/audit-design-tokens.mjs [ruta-al-css]
 *   (por defecto toma el CSS más reciente de dist/assets)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const SRC = join(ROOT, 'src')

const PREFIXES = [
  'bg-', 'text-', 'border-', 'rounded-', 'shadow-', 'ring-', 'divide-',
  'from-', 'via-', 'to-', 'accent-', 'outline-', 'fill-', 'stroke-',
  'placeholder-', 'decoration-', 'caret-', 'font-', 'leading-', 'tracking-',
  'animate-', 'max-h-', 'min-h-', 'max-w-', 'min-w-',
]

function findCss(explicit) {
  if (explicit) return resolve(ROOT, explicit)
  const assets = join(ROOT, 'dist', 'assets')
  try {
    const files = readdirSync(assets).filter((f) => f.endsWith('.css'))
    if (!files.length) return null
    return join(assets, files[0])
  } catch {
    return null
  }
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full)
  }
  return out
}

/** Escapa un nombre de clase como lo hace Tailwind al generar selectores. */
function escapeSelector(token) {
  return token.replace(/([\\[\]{}#()/.:%,+!*'"=&|$^~<>?@ ])/g, '\\$1')
}

const cssPath = findCss(process.argv[2])
if (!cssPath) {
  console.error('✗ No encontré CSS compilado. Ejecuta `npm run build` primero.')
  process.exit(2)
}
const css = readFileSync(cssPath, 'utf8')

/** Extrae candidatos a clase de strings literales (con línea). */
function extractClasses(source) {
  const found = []
  const stringRe = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g
  let m
  while ((m = stringRe.exec(source)) !== null) {
    const value = m[1] ?? m[2] ?? m[3] ?? ''
    if (!value || value.length > 900) continue
    const line = source.slice(0, m.index).split('\n').length
    for (const piece of value.split(/\s+/)) {
      // Recorta comillas/llaves que aparecen al partir template literals anidados.
      const raw = piece.replace(/^[`'"{}[\]()]+|[`'"{}[\]();,]+$/g, '')
      if (!raw || /\$\{/.test(raw)) continue
      if (/[(]/.test(raw)) continue // valores arbitrarios con espacios/funciones
      if (!PREFIXES.some((p) => raw.replace(/^(?:[a-z0-9-]+:)+/, '').startsWith(p))) continue
      found.push({ token: raw, line })
    }
  }
  return found
}

const missing = []
const seen = new Set()
let checked = 0

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8')
  for (const { token, line } of extractClasses(source)) {
    const key = `${file}:${token}`
    if (seen.has(key)) continue
    seen.add(key)
    checked++
    if (!css.includes(`.${escapeSelector(token)}`)) {
      missing.push({ file: file.slice(ROOT.length + 1), line, token })
    }
  }
}

console.log(`CSS:      ${cssPath.slice(ROOT.length + 1)}`)
console.log(`Clases:   ${checked} verificadas`)

if (!missing.length) {
  console.log('✓ Todas las clases utilitarias del sistema de diseño existen en el CSS.')
  process.exit(0)
}

const byFile = new Map()
for (const item of missing) {
  if (!byFile.has(item.file)) byFile.set(item.file, [])
  byFile.get(item.file).push(item)
}
console.error(`\n✗ ${missing.length} clases NO encontradas en el CSS:\n`)
for (const [file, items] of [...byFile.entries()].sort()) {
  console.error(`  ${file}`)
  for (const item of items) console.error(`    ${item.line}: ${item.token}`)
}
process.exit(1)
