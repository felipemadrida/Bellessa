import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import i18n from '../i18n'
import { useAuth } from './auth'
import { configureMoney } from './format'

export type Locale = 'es' | 'en'
export type Theme = 'light' | 'dark'

const LOCALE_KEY = 'bellessa_locale'
const THEME_KEY = 'bellessa_theme'

interface PreferencesValue {
  locale: Locale
  theme: Theme
  setLocale: (locale: Locale) => void
  toggleTheme: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const PreferencesContext = createContext<PreferencesValue | null>(null)

function resolveLocale(value: string | null | undefined): Locale {
  return value?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { business } = useAuth()
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = window.localStorage.getItem(LOCALE_KEY)
    if (stored === 'en' || stored === 'es') return stored
    return resolveLocale(i18n.language)
  })
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem(THEME_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })

  // Idioma por defecto del salón: solo aplica si la persona no ha elegido uno.
  useEffect(() => {
    if (!business) return
    if (window.localStorage.getItem(LOCALE_KEY)) return
    setLocaleState(resolveLocale(business.locale))
  }, [business])

  useEffect(() => {
    void i18n.changeLanguage(locale)
    configureMoney({ locale })
    document.documentElement.lang = locale === 'en' ? 'en' : 'es-MX'
  }, [locale])

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  // Color de marca del salón, tema del navegador y título de la app.
  useEffect(() => {
    const color = business?.brand_color || '#9C5566'
    const root = document.documentElement
    root.style.setProperty('--brand', color)
    root.style.setProperty('--brand-soft', `${color}1F`)
    root.style.setProperty('--brand-line', `${color}33`)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [business?.brand_color])

  useEffect(() => {
    // El título de la app (pestaña y app instalada) es el nombre comercial del salón.
    const name = business?.name?.trim() || 'Bellessa'
    document.title = name
    document
      .querySelector('meta[name="apple-mobile-web-app-title"]')
      ?.setAttribute('content', name)
  }, [business?.name])

  const setLocale = useCallback((value: Locale) => {
    window.localStorage.setItem(LOCALE_KEY, value)
    setLocaleState(value)
  }, [])

  const toggleTheme = useCallback(() => setTheme((value) => (value === 'dark' ? 'light' : 'dark')), [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      (i18n.t as unknown as (key: string, options?: Record<string, unknown>) => string)(key, vars),
    [locale],
  )

  const value = useMemo(
    () => ({ locale, theme, setLocale, toggleTheme, t }),
    [locale, theme, setLocale, toggleTheme, t],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesValue {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences debe usarse dentro de PreferencesProvider')
  return context
}
