/**
 * Verifica que los archivos de traducción tengan exactamente las mismas claves
 * (es/en) y que ninguna cadena quede vacía. Se ejecuta como gate del build.
 *
 * Uso: node scripts/audit-locales.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

function load(locale) {
  const path = resolve(root, `src/locales/${locale}/translation.json`)
  return flatten(JSON.parse(readFileSync(path, 'utf8')))
}

const es = load('es')
const en = load('en')
const esKeys = new Set(Object.keys(es))
const enKeys = new Set(Object.keys(en))

const missingInEn = [...esKeys].filter((key) => !enKeys.has(key))
const missingInEs = [...enKeys].filter((key) => !esKeys.has(key))
const empty = [
  ...Object.entries(es).filter(([, value]) => !String(value).trim()).map(([key]) => `es:${key}`),
  ...Object.entries(en).filter(([, value]) => !String(value).trim()).map(([key]) => `en:${key}`),
]

let failed = false
if (missingInEn.length) {
  failed = true
  console.error(`✗ Faltan ${missingInEn.length} claves en inglés: ${missingInEn.join(', ')}`)
}
if (missingInEs.length) {
  failed = true
  console.error(`✗ Faltan ${missingInEs.length} claves en español: ${missingInEs.join(', ')}`)
}
if (empty.length) {
  failed = true
  console.error(`✗ Cadenas vacías: ${empty.join(', ')}`)
}

if (failed) {
  process.exit(1)
}

console.log(`Idiomas: ${esKeys.size} claves sincronizadas (es/en) · sin cadenas vacías`)
console.log('✓ Traducciones es/en en paridad.')
