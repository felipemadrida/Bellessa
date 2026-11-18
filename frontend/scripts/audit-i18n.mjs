/**
 * Auditoría de traducciones:
 *  1. Detecta claves duplicadas dentro del mismo objeto JSON (JSON.parse las
 *     pierde en silencio, así que se revisa el texto crudo).
 *  2. Detecta claves definidas que ningún componente usa.
 *
 * Las claves dinámicas (status.${x}, method.${x}, audit.${x}, wa.tpl.${x}…)
 * se reconocen por prefijo para no reportarlas como huérfanas.
 *
 * Uso: node scripts/audit-i18n.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------------------
// 1. Duplicados en el JSON crudo
// ---------------------------------------------------------------------------
function findDuplicateKeys(raw) {
  const duplicates = []
  const stack = []
  let i = 0
  let pendingKey = null

  while (i < raw.length) {
    const char = raw[i]
    if (char === '"') {
      let value = ''
      i += 1
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === '\\') {
          value += raw[i + 1] ?? ''
          i += 2
          continue
        }
        value += raw[i]
        i += 1
      }
      i += 1
      // ¿Es clave? Lo es si después de cerrar comillas viene ':'
      let look = i
      while (look < raw.length && /\s/.test(raw[look])) look += 1
      if (raw[look] === ':') {
        pendingKey = value
        if (stack.length) {
          const scope = stack[stack.length - 1]
          scope.seen ??= new Set()
          if (scope.seen.has(value)) {
            duplicates.push(`${scope.path.join('.')}.${value}`.replace(/^\./, ''))
          }
          scope.seen.add(value)
          scope.next = value
        }
      }
      continue
    }
    if (char === '{') {
      stack.push({ path: pendingKey ? [pendingKey] : [], seen: new Set(), next: null })
      pendingKey = null
      i += 1
      continue
    }
    if (char === '}') {
      stack.pop()
      pendingKey = null
      i += 1
      continue
    }
    if (char === ',') {
      pendingKey = null
      const scope = stack[stack.length - 1]
      if (scope && scope.next) scope.path = [...scope.path.slice(0, -1), scope.next]
      i += 1
      continue
    }
    i += 1
  }
  return duplicates
}

// ---------------------------------------------------------------------------
// 2. Claves definidas vs. usadas
// ---------------------------------------------------------------------------
function flatten(value, prefix = '') {
  const result = {}
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      Object.assign(result, flatten(child, path))
    } else {
      result[path] = child
    }
  }
  return result
}

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

const es = JSON.parse(readFileSync(resolve(root, 'src/locales/es/translation.json'), 'utf8'))
const en = JSON.parse(readFileSync(resolve(root, 'src/locales/en/translation.json'), 'utf8'))
const esFlat = flatten(es)
const enFlat = flatten(en)

const sources = sourceFiles(resolve(root, 'src'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

// Prefijos que se resuelven con template strings en el código.
const DYNAMIC_PREFIXES = ['status.', 'method.', 'audit.', 'wa.tpl.', 'wa.seg.', 'wa.kind.', 'wa.st.', 'manual.status.']

const used = (key) => {
  if (sources.includes(`'${key}'`) || sources.includes(`"${key}"`) || sources.includes(`\`${key}\``)) return true
  return DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix))
}

const unusedEs = Object.keys(esFlat).filter((key) => !used(key))
const unusedEn = Object.keys(enFlat).filter((key) => !used(key))

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------
const rawEs = readFileSync(resolve(root, 'src/locales/es/translation.json'), 'utf8')
const rawEn = readFileSync(resolve(root, 'src/locales/en/translation.json'), 'utf8')
const duplicates = [
  ...findDuplicateKeys(rawEs).map((key) => `es:${key}`),
  ...findDuplicateKeys(rawEn).map((key) => `en:${key}`),
]

let failed = false
if (duplicates.length) {
  failed = true
  console.error(`✗ Claves duplicadas: ${[...new Set(duplicates)].join(', ')}`)
}
if (unusedEs.length || unusedEn.length) {
  failed = true
  const all = [...new Set([...unusedEs.map((k) => `es:${k}`), ...unusedEn.map((k) => `en:${k}`)])]
  console.error(`✗ Claves sin usar (${all.length}): ${all.join(', ')}`)
}

if (failed) process.exit(1)

console.log(`Auditoría i18n: ${Object.keys(esFlat).length} claves · 0 duplicadas · 0 sin usar`)
console.log('✓ Traducciones sin duplicados ni claves huérfanas.')
