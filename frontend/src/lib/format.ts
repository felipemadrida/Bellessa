import type { AppointmentStatus, PaymentMethod } from './types'

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Moneda e idioma activos de la app. Se configuran desde el salón
 * (`PreferencesProvider` / `AuthProvider`) para que todo `money()` respete la
 * divisa base sin tocar cada llamada.
 */
let activeCurrency = 'MXN'
let activeNumberLocale = 'es-MX'

export function configureMoney(options: {
  currency?: string | null
  locale?: string | null
}): void {
  if (options.currency) activeCurrency = options.currency.toUpperCase()
  if (options.locale) {
    activeNumberLocale = options.locale.toLowerCase().startsWith('en') ? 'en-US' : 'es-MX'
  }
}

export function activeMoneyConfig(): { currency: string; locale: string } {
  return { currency: activeCurrency, locale: activeNumberLocale }
}

export function money(cents: number, currency?: string): string {
  const code = currency ?? activeCurrency
  const hasCents = Math.abs(cents) % 100 !== 0
  return new Intl.NumberFormat(activeNumberLocale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100)
}

export function moneyExact(cents: number, currency?: string): string {
  return new Intl.NumberFormat(activeNumberLocale, {
    style: 'currency',
    currency: currency ?? activeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function parseMoney(value: string): number {
  const clean = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '')
  const number = Number.parseFloat(clean)
  return Number.isFinite(number) ? Math.round(number * 100) : 0
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .replace(/\s?([ap])\.\s?m\./i, ' $1.m.')
}

export function formatTimeShort(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export function formatDateLong(iso: string, timeZone: string): string {
  return capitalize(
    new Intl.DateTimeFormat('es-MX', {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(iso)),
  )
}

export function formatDateShort(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(iso))
    .replace('.', '')
}

export function formatDayMonth(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso))
}

export function dateKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function todayKey(timeZone: string): string {
  return dateKey(new Date().toISOString(), timeZone)
}

export function parseKey(key: string): Date {
  return new Date(`${key}T12:00:00Z`)
}

export function addDaysKey(key: string, days: number): string {
  const date = parseKey(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekdayShort(key: string): string {
  return capitalize(
    new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short' })
      .format(parseKey(key))
      .replace('.', ''),
  )
}

/**
 * Nombre del día de la semana por índice (0 = lunes), en el idioma activo.
 * Usa Intl para no duplicar listas de días por idioma.
 */
export function weekdayNameByIndex(
  index: number,
  locale: string,
  style: 'long' | 'short' | 'narrow' = 'long',
): string {
  const english = locale.toLowerCase().startsWith('en')
  // En español "miércoles" y "martes" comparten la inicial M; usamos X como es costumbre.
  if (!english && style === 'narrow' && index === 2) return 'X'
  // 2024-01-01 fue lunes, así que sirve de ancla para cualquier índice.
  const date = new Date(Date.UTC(2024, 0, 1 + index))
  return capitalize(
    new Intl.DateTimeFormat(english ? 'en-US' : 'es-MX', {
      timeZone: 'UTC',
      weekday: style,
    })
      .format(date)
      .replace('.', ''),
  )
}

export function weekdayNarrow(key: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'narrow' })
    .format(parseKey(key))
    .toUpperCase()
}

export function dayNumber(key: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric' }).format(parseKey(key))
}

export function monthShort(key: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', month: 'short' })
    .format(parseKey(key))
    .replace('.', '')
}

export function dateLongFromKey(key: string): string {
  return capitalize(
    new Intl.DateTimeFormat('es-MX', {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(parseKey(key)),
  )
}

export function monthLongFromKey(key: string): string {
  return capitalize(
    new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
      parseKey(key),
    ),
  )
}

export function rangeKeys(startKey: string, endKey: string): string[] {
  const result: string[] = []
  let current = startKey
  let guard = 0
  while (current <= endKey && guard < 400) {
    result.push(current)
    current = addDaysKey(current, 1)
    guard += 1
  }
  return result
}

export function startOfWeekKey(key: string): string {
  const date = parseKey(key)
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDaysKey(key, diff)
}

export function relativeDayLabel(key: string, today: string): string {
  if (key === today) return 'Hoy'
  if (key === addDaysKey(today, 1)) return 'Mañana'
  if (key === addDaysKey(today, -1)) return 'Ayer'
  return dateLongFromKey(key)
}

export function greeting(hour: number): string {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function hourInTZ(timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(new Date()),
  )
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function phoneDisplay(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return phone ?? ''
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)} ${digits.slice(6)}`
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmada',
  completed: 'Completada',
  canceled: 'Cancelada',
  no_show: 'No asistió',
}

export const STATUS_TONE: Record<AppointmentStatus, string> = {
  pending: 'bg-champagne-soft text-champagne-deep',
  confirmed: 'bg-sage-soft text-sage-deep',
  completed: 'bg-sand text-muted',
  canceled: 'bg-status-cancelled-bg text-status-cancelled-text',
  no_show: 'bg-blush-soft text-blush-deep',
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
}

export function birthdayLabel(birthday: string, timeZone: string): string {
  const date = new Date(`${birthday}T12:00:00Z`)
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export function nextBirthdayDays(birthday: string, today: string): number {
  const date = new Date(`${birthday}T12:00:00Z`)
  const todayDate = parseKey(today)
  date.setUTCFullYear(todayDate.getUTCFullYear())
  if (date < todayDate) date.setUTCFullYear(todayDate.getUTCFullYear() + 1)
  return Math.round((date.getTime() - todayDate.getTime()) / 86_400_000)
}
