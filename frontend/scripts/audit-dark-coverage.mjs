#!/usr/bin/env node
/**
 * Auditoría de cobertura del TEMA NEGRO.
 *
 * El tema oscuro se implementa con selectores `html.dark …` sobre las clases
 * semánticas (no con variantes `dark:` en cada componente). Eso es rápido, pero
 * frágil: si se usa un token nuevo y nadie escribe su regla, la superficie se
 * queda clara sobre fondo oscuro (texto invisible).
 *
 * Este script recorre el código, extrae las clases de superficie/texto/borde y
 * exige que cada token *semántico* tenga una regla `html.dark`. Los acentos
 * puros (rose, sage, gold, champagne, blush) se consideran opcionales porque
 * funcionan igual en ambos temas.
 *
 * Uso: node scripts/audit-dark-coverage.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const SRC = join(ROOT, 'src')
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

/** Tokens que OBLIGATORIAMENTE deben invertirse en tema negro. */
const REQUIRED = [
  'alabaster', 'cream', 'surface', 'white', 'sand', 'champ', 'bisque', 'porcelain',
  'licorice', 'ink', 'muted', 'taupe', 'mocha', 'border', 'line', 'silver',
  'blush-soft', 'blush-light', 'rose-soft', 'champagne-soft', 'gold-soft', 'sage-soft',
  'status-confirmed-bg', 'status-pending-bg', 'status-cancelled-bg',
  'status-completed-bg', 'status-no-show-bg', 'status-noShow-bg',
  'status-confirmed-text', 'status-pending-text', 'status-cancelled-text',
  'status-completed-text', 'status-no-show-text', 'status-noShow-text',
]

const PREFIXES = ['bg-', 'text-', 'border-', 'divide-', 'ring-offset-', 'from-', 'via-', 'to-']

/**
 * Clases que NO deben invertirse: en el diseño claro ya son "tinte claro sobre
 * panel oscuro" (héroes, CTAs, banners), así que su fondo es oscuro en ambos
 * temas y el valor claro sigue siendo correcto.
 */
const EXEMPT = [
  /^text-white(\/\d+)?$/,
  /^text-alabaster(\/\d+)?$/,
  /^text-champagne-soft(\/\d+)?$/,
  /^border-cream\/\d+$/,
  /^border-alabaster\/\d+$/,
  /^border-white\/\d+$/,
  /^bg-alabaster\/(5|10|15)$/,
  /^bg-cream\/\d+$/,
  /^ring-offset-/,
]

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full)
  }
  return out
}

function escapeSelector(token) {
  return token.replace(/([\\[\]{}#()/.:%,+!*'"=&|$^~<>?@ ])/g, '\\$1')
}

function hasDarkRule(token) {
  const base = token.split('/')[0]
  const escaped = escapeSelector(base)
  if (CSS.includes(`html.dark .${escaped}`)) return true
  // variantes con opacidad usan selector de atributo: html.dark [class*='bg-sand/']
  if (CSS.includes(`html.dark [class*='${base}`)) return true
  if (CSS.includes(`html.dark [class*="${base}`)) return true
  return false
}

const missing = new Map()
let checked = 0
const seen = new Set()

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8')
  const re = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g
  let m
  while ((m = re.exec(source)) !== null) {
    const value = m[1] ?? m[2] ?? m[3] ?? ''
    if (!value) continue
    const line = source.slice(0, m.index).split('\n').length
    for (const piece of value.split(/\s+/)) {
      const raw = piece.replace(/^[`'"{}[\]()]+|[`'"{}[\]();,]+$/g, '')
      if (!raw || /\$\{/.test(raw) || /[(]/.test(raw)) continue
      const bare = raw.replace(/^(?:[a-z0-9-]+:)+/, '')
      if (EXEMPT.some((re) => re.test(bare))) continue
      if (!PREFIXES.some((p) => bare.startsWith(p))) continue
      const token = bare.split('/')[0]
      const role = token.replace(/^(bg|text|border|divide|ring-offset|from|via|to)-/, '')
      if (!REQUIRED.some((r) => role === r)) continue
      const key = `${file}:${raw}`
      if (seen.has(key)) continue
      seen.add(key)
      checked++
      if (!hasDarkRule(token)) {
        const rel = file.slice(ROOT.length + 1)
        if (!missing.has(rel)) missing.set(rel, [])
        missing.get(rel).push({ line, token: raw })
      }
    }
  }
}

console.log(`Tema negro: ${checked} clases semánticas verificadas`)

if (!missing.size) {
  console.log('✓ Toda clase semántica de superficie/texto/borde tiene regla en tema negro.')
  process.exit(0)
}

let total = 0
for (const items of missing.values()) total += items.length
console.error(`\n✗ ${total} clase(s) sin regla en tema negro:\n`)
for (const [file, items] of [...missing.entries()].sort()) {
  console.error(`  ${file}`)
  for (const item of items) console.error(`    ${item.line}: ${item.token}`)
}
process.exit(1)
