#!/usr/bin/env node
/**
 * Auditoría de contraste WCAG 2.2 AA del sistema de diseño "Quiet Luxury".
 *
 * Verifica los pares texto/fondo de AMBOS temas (claro y negro). Falla (exit 1)
 * si un par de texto normal queda por debajo de 4.5:1, o uno de UI/iconos por
 * debajo de 3:1.
 *
 * Guardas anti-deriva:
 *  - los hex del tema claro deben existir en `tailwind.config.ts`
 *  - los hex del tema negro deben existir en `src/index.css`
 *
 * Uso: node scripts/audit-contrast.mjs
 */
import { readFileSync } from 'node:fs'

const LIGHT = {
  alabaster: '#F9F6F0',
  porcelain: '#FBF7F1',
  surface: '#FFFFFF',
  bisque: '#F1E7DA',
  blush: '#E8C5C8',
  blushLight: '#F7EBEC',
  blushDeep: '#9C5566',
  champagne: '#D4AF37',
  champagneSoft: '#FBF3DF',
  champagneDeep: '#7A5A18',
  taupe: '#8A6A5E',
  mocha: '#4E3A33',
  muted: '#6F5A50',
  licorice: '#1E1E1E',
  border: '#EADFD2',
  sand: '#F3E9DD',
  roseDeep: '#7E3F4E',
  sage: '#4A6B5D',
  sageSoft: '#EFF3F0',
  sageDeep: '#395247',
  gold: '#A8842C',
  silver: '#D9CBBA',
  silverSoft: '#EFE6DA',
  silverDeep: '#9C8877',
  statusCancelledBg: '#FBECEC',
  statusCancelledText: '#A8383B',
  statusConfirmedText: '#3B6E4C',
}

const DARK = {
  canvas: '#12100D',
  surface: '#1A1613',
  porcelain: '#221D19',
  bisque: '#262019',
  chip: '#2B241D',
  border: '#3A322A',
  ink: '#F3EBE1',
  muted: '#B9A898',
  taupe: '#C6B2A0',
  light: '#F7F1E8',
  black: '#0C0A08',
  blushBg: '#5A3A44',
  blushSoft: '#3A2630',
  blushDeep: '#E9AEB9',
  champagne: '#D4AF37',
  champagneBg: '#6E5518',
  champagneSoft: '#352B18',
  champagneDeep: '#E7C87F',
  goldText: '#D9B85C',
  roseText: '#E4A3AF',
  sage: '#A9C6B6',
  sageSoft: '#1F2A25',
  silverDeep: '#C3AE9A',
}

const LIGHT_PAIRS = [
  ['licorice', 'alabaster', 4.5, 'Texto principal sobre fondo de app'],
  ['licorice', 'surface', 4.5, 'Texto principal sobre tarjetas'],
  ['licorice', 'bisque', 4.5, 'Texto principal sobre superficie cálida'],
  ['licorice', 'sand', 4.5, 'Texto principal sobre chips'],
  ['mocha', 'alabaster', 4.5, 'Neutro profundo sobre fondo de app'],
  ['muted', 'alabaster', 4.5, 'Texto secundario sobre fondo de app'],
  ['muted', 'surface', 4.5, 'Texto secundario sobre tarjetas'],
  ['muted', 'sand', 4.5, 'Texto secundario sobre chips'],
  ['muted', 'bisque', 4.5, 'Texto secundario sobre superficie cálida'],
  ['taupe', 'alabaster', 4.5, 'Rosewood taupe como texto sobre fondo'],
  ['taupe', 'surface', 4.5, 'Rosewood taupe como texto sobre tarjetas'],
  ['taupe', 'sand', 3, 'Detalles taupe sobre chips (no texto)'],
  ['alabaster', 'licorice', 4.5, 'Botón primario (texto claro sobre licorice)'],
  ['alabaster', 'blushDeep', 4.5, 'Botón de acento (texto claro sobre blush deep)'],
  ['alabaster', 'roseDeep', 4.5, 'Hover del botón de acento'],
  ['alabaster', 'sage', 4.5, 'Botón de confirmación'],
  ['blushDeep', 'alabaster', 4.5, 'Enlaces/acento rosa sobre fondo'],
  ['blushDeep', 'blushLight', 4.5, 'Badge no-show'],
  ['roseDeep', 'blushLight', 4.5, 'Texto de peligro sobre blush soft'],
  ['champagneDeep', 'champagneSoft', 4.5, 'Badge pendiente / aviso'],
  ['licorice', 'champagne', 4.5, 'Texto sobre oro (sello/metal)'],
  ['sageDeep', 'sageSoft', 4.5, 'Badge confirmada'],
  ['statusCancelledText', 'statusCancelledBg', 4.5, 'Badge cancelada'],
  ['statusConfirmedText', 'sageSoft', 4.5, 'Badge confirmada (token status)'],
  ['licorice', 'blush', 4.5, 'Texto sobre blush (tag de marca)'],
  ['gold', 'alabaster', 3, 'Iconos dorados sobre fondo (UI, no texto)'],
  ['silverDeep', 'alabaster', 3, 'Bordes/etiquetas plata cálida'],
]

const DARK_PAIRS = [
  ['ink', 'canvas', 4.5, 'Texto principal sobre fondo de app'],
  ['ink', 'surface', 4.5, 'Texto principal sobre tarjetas'],
  ['ink', 'porcelain', 4.5, 'Texto principal sobre superficie elevada'],
  ['ink', 'bisque', 4.5, 'Texto principal sobre superficie secundaria'],
  ['ink', 'chip', 4.5, 'Texto principal sobre chips'],
  ['muted', 'canvas', 4.5, 'Texto secundario sobre fondo de app'],
  ['muted', 'surface', 4.5, 'Texto secundario sobre tarjetas'],
  ['muted', 'chip', 4.5, 'Texto secundario sobre chips'],
  ['taupe', 'surface', 4.5, 'Rosewood taupe sobre tarjetas'],
  ['taupe', 'chip', 4.5, 'Rosewood taupe sobre chips'],
  ['light', 'black', 4.5, 'Texto claro sobre botón/panel licorice'],
  ['light', 'blushBg', 4.5, 'Botón de acento nocturno'],
  ['light', 'champagneBg', 4.5, 'Sello dorado nocturno'],
  ['blushDeep', 'blushSoft', 4.5, 'Badge no-show nocturno'],
  ['champagneDeep', 'champagneSoft', 4.5, 'Badge pendiente nocturno'],
  ['goldText', 'surface', 4.5, 'Oro como texto sobre tarjeta'],
  ['sage', 'sageSoft', 4.5, 'Badge confirmada nocturno'],
  ['roseText', 'surface', 4.5, 'Acento rosa como texto'],
  ['champagne', 'black', 3, 'Metal dorado sobre negro (UI)'],
  ['silverDeep', 'surface', 3, 'Bordes plata cálida sobre tarjeta'],
]

function toRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

function audit(name, tokens, pairs, source, sourceLabel) {
  const sourceText = readFileSync(new URL(source, import.meta.url), 'utf8').toUpperCase()
  const drifted = Object.entries(tokens).filter(([, hex]) => !sourceText.includes(hex.toUpperCase()))
  if (drifted.length) {
    console.error(`✗ Tokens del auditor (${name}) desincronizados de ${sourceLabel}:`)
    for (const [token, hex] of drifted) console.error(`    ${token} = ${hex}`)
    process.exit(1)
  }

  console.log(`\n${name} — fuente: ${sourceLabel}`)
  console.log('  ratio    mínimo  estado  descripción')
  console.log('  -------  ------  ------  ------------------------------------------')

  let failures = 0
  for (const [fg, bg, min, note] of pairs) {
    const ratio = contrast(tokens[fg], tokens[bg])
    const ok = ratio >= min
    if (!ok) failures++
    console.log(
      `  ${ratio.toFixed(2).padStart(6)}:1  ${String(min).padEnd(6)}  ${ok ? 'PASA ' : 'FALLA'}  ${note} (${fg} / ${bg})`,
    )
  }
  return failures
}

console.log('Contraste WCAG 2.2 AA — paleta Quiet Luxury (claro + negro)')
const failures =
  audit('TEMA CLARO', LIGHT, LIGHT_PAIRS, '../tailwind.config.ts', 'tailwind.config.ts') +
  audit('TEMA NEGRO', DARK, DARK_PAIRS, '../src/index.css', 'src/index.css')

if (failures) {
  console.error(`\n✗ ${failures} par(es) no cumplen el mínimo WCAG AA.`)
  process.exit(1)
}
console.log('\n✓ Todos los pares de ambos temas cumplen WCAG 2.2 AA.')
