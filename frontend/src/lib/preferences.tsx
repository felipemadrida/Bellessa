import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Locale = 'es' | 'en'
export type Theme = 'light' | 'dark'

const LOCALE_KEY = 'bellessa_locale'
const THEME_KEY = 'bellessa_theme'

const STRINGS: Record<string, { es: string; en: string }> = {
  'nav.home': { es: 'Inicio', en: 'Home' },
  'nav.agenda': { es: 'Agenda', en: 'Agenda' },
  'nav.cash': { es: 'Caja', en: 'Register' },
  'nav.hoy': { es: 'Hoy', en: 'Today' },
  'nav.more': { es: 'Más', en: 'More' },
  'nav.clients': { es: 'Clientas', en: 'Clients' },
  'nav.whatsapp': { es: 'WhatsApp', en: 'WhatsApp' },
  'nav.reports': { es: 'Reportes', en: 'Reports' },
  'nav.services': { es: 'Servicios', en: 'Services' },
  'nav.inventory': { es: 'Inventario', en: 'Inventory' },
  'nav.team': { es: 'Equipo', en: 'Team' },
  'nav.settings': { es: 'Ajustes', en: 'Settings' },
  'common.searchClient': { es: 'Buscar clienta…', en: 'Search client…' },
  'common.searchLabel': { es: 'Buscar clienta', en: 'Search client' },
  'common.newAppointment': { es: 'Nueva cita', en: 'New appointment' },
  'common.cita': { es: 'Cita', en: 'Appointment' },
  'common.logout': { es: 'Cerrar sesión', en: 'Sign out' },
  'common.salonOrder': { es: 'Salón en orden', en: 'Salon in order' },
  'common.light': { es: 'Claro', en: 'Light' },
  'common.dark': { es: 'Negro', en: 'Dark' },
  'common.es': { es: 'ES', en: 'ES' },
  'common.en': { es: 'EN', en: 'EN' },
  'common.returnSalon': { es: 'Volver al panel del salón', en: 'Back to salon dashboard' },
  'common.superadmin': { es: 'Superadmin', en: 'Superadmin' },
  'login.madeFor': { es: 'Hecho para salones en México', en: 'Made for salons in Mexico' },
  'login.head1': { es: 'Tu salón,', en: 'Your salon,' },
  'login.head2': { es: 'en orden.', en: 'in order.' },
  'login.head3': { es: 'Tu tiempo, tuyo.', en: 'Your time, yours.' },
  'login.subtitle': {
    es: 'Agenda, clientas, cobros y seguimiento en una sola app. Menos libreta, menos WhatsApp perdido, más tiempo para crear.',
    en: 'Schedule, clients, payments and follow-up in one app. Less notebook, less lost WhatsApp, more time to create.',
  },
  'login.feat1': { es: 'Agenda que evita traslapes y llena tu día.', en: 'A schedule that avoids overlaps and fills your day.' },
  'login.feat2': { es: 'Recordatorios por WhatsApp con un toque.', en: 'WhatsApp reminders in one tap.' },
  'login.feat3': { es: 'Cobros, propinas y corte de caja en MXN.', en: 'Payments, tips and cash-out in MXN.' },
  'login.today': { es: 'Hoy · Salón Demo', en: 'Today · Salón Demo' },
  'login.appointments': { es: 'citas', en: 'appointments' },
  'login.welcome': { es: 'Bienvenida de vuelta', en: 'Welcome back' },
  'login.welcomeSub': { es: 'Qué gusto verte', en: 'So good to see you' },
  'login.enterSub': {
    es: 'Entra para ver tu agenda, tus clientas y la caja de hoy.',
    en: 'Sign in to see your agenda, clients and today’s register.',
  },
  'login.email': { es: 'Correo', en: 'Email' },
  'login.password': { es: 'Contraseña', en: 'Password' },
  'login.enter': { es: 'Entrar a mi salón', en: 'Enter my salon' },
  'login.demo': { es: 'Abrir el demo de Salón Demo', en: 'Open the Salón Demo demo' },
  'login.accept': {
    es: 'Al continuar aceptas el uso responsable de los datos de tus clientas.',
    en: 'By continuing you accept responsible use of your clients’ data.',
  },
  'login.create': { es: 'Crear una cuenta nueva', en: 'Create a new account' },
  'login.viewBooking': { es: 'Ver página de reservas', en: 'View booking page' },
  'login.admin': { es: 'Admin SaaS', en: 'Admin SaaS' },
  'login.withoutAccount': { es: 'O explora sin cuenta', en: 'Or explore without an account' },
  'login.haveAccount': { es: 'Ya tengo cuenta', en: 'I already have an account' },
  'login.createAccountLink': { es: 'Crear cuenta', en: 'Create account' },
  'login.startFree': { es: 'Empieza gratis', en: 'Start free' },
  'login.registerHeadline': { es: 'Crea el espacio de tu salón', en: 'Create your salon space' },
  'login.registerSub': {
    es: 'Tu agenda, tu equipo y tus clientas listos en menos de un minuto.',
    en: 'Your agenda, team and clients ready in under a minute.',
  },
  'login.businessName': { es: 'Nombre del salón', en: 'Salon name' },
  'login.yourName': { es: 'Tu nombre', en: 'Your name' },
  'login.whatsapp': { es: 'WhatsApp del salón', en: 'Salon WhatsApp' },
  'login.businessPassword': { es: 'Contraseña de la cuenta', en: 'Account password' },
  'login.createSalon': { es: 'Crear mi salón', en: 'Create my salon' },
  'login.successToast': { es: '¡Tu salón ya está en Bellessa!', en: 'Your salon is now on Bellessa!' },
  'dashboard.unconfirmed': { es: 'Tienes {n} cita{s} por confirmar. Vamos a dejar el día listo.', en: 'You have {n} appointment{s} to confirm. Let’s get the day ready.' },
  'dashboard.confirmed': { es: 'Todo confirmado. Respira: tu día está bajo control.', en: 'All confirmed. Breathe: your day is under control.' },
  'dashboard.linkBooking': { es: 'Link de reservas', en: 'Booking link' },
  'dashboard.share': { es: 'Compartir', en: 'Share' },
  'dashboard.newAppointment': { es: 'Nueva cita', en: 'New appointment' },
  'dashboard.incomeToday': { es: 'Ingresos de hoy', en: 'Today’s income' },
  'dashboard.thisMonth': { es: 'este mes', en: 'this month' },
  'dashboard.completedOf': { es: '{a} de {b} completadas', en: '{a} of {b} completed' },
  'dashboard.goal': { es: 'de la meta', en: 'of the goal' },
  'dashboard.viewAgenda': { es: 'Ver agenda', en: 'View agenda' },
  'dashboard.cash': { es: 'en efectivo', en: 'in cash' },
  'dashboard.de': { es: 'de', en: 'of' },
  'dashboard.todayAppointments': { es: 'Citas hoy', en: 'Appointments today' },
  'dashboard.toConfirm': { es: '{n} por confirmar', en: '{n} to confirm' },
  'dashboard.avgTicket': { es: 'Ticket promedio', en: 'Average ticket' },
  'dashboard.tips': { es: 'en propinas', en: 'in tips' },
  'dashboard.occupancy': { es: 'Ocupación', en: 'Occupancy' },
  'dashboard.capacity': { es: 'De tu capacidad de hoy', en: 'Of today’s capacity' },
  'dashboard.newClients': { es: 'Clientas nuevas', en: 'New clients' },
  'dashboard.upcoming': { es: 'Próximas citas', en: 'Upcoming appointments' },
  'dashboard.upcomingSub': { es: '{n} en lo que resta del día', en: '{n} left today' },
  'dashboard.seeAll': { es: 'Ver todas', en: 'View all' },
  'dashboard.noMore': { es: 'No hay más citas hoy', en: 'No more appointments today' },
  'dashboard.weekRevenue': { es: 'Ingresos de la semana', en: 'Week revenue' },
  'dashboard.topServices': { es: 'Servicios estrella', en: 'Top services' },
  'dashboard.monthBest': { es: 'Lo más vendido del mes', en: 'Best sellers this month' },
  'dashboard.cashToday': { es: 'Caja de hoy', en: 'Today’s register' },
  'dashboard.cashExpected': { es: 'Efectivo esperado en cajón', en: 'Expected cash in drawer' },
  'dashboard.tipsToday': { es: 'Propinas de hoy', en: 'Today’s tips' },
  'dashboard.chargedMonth': { es: 'Cobrado este mes', en: 'Charged this month' },
  'dashboard.goToCash': { es: 'Ir a caja', en: 'Go to register' },
  'dashboard.birthdays': { es: 'Cumpleaños', en: 'Birthdays' },
  'dashboard.thisWeek': { es: 'Esta semana', en: 'This week' },
  'greeting.morning': { es: 'Buenos días', en: 'Good morning' },
  'greeting.afternoon': { es: 'Buenas tardes', en: 'Good afternoon' },
  'greeting.evening': { es: 'Buenas noches', en: 'Good evening' },
}

interface PreferencesValue {
  locale: Locale
  theme: Theme
  setLocale: (locale: Locale) => void
  toggleTheme: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const PreferencesContext = createContext<PreferencesValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = window.localStorage.getItem(LOCALE_KEY)
    return stored === 'en' ? 'en' : 'es'
  })
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem(THEME_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    window.localStorage.setItem(LOCALE_KEY, locale)
    document.documentElement.lang = locale === 'en' ? 'en' : 'es-MX'
  }, [locale])

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const setLocale = useCallback((value: Locale) => setLocaleState(value), [])
  const toggleTheme = useCallback(() => setTheme((value) => (value === 'dark' ? 'light' : 'dark')), [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const entry = STRINGS[key]
      let value = entry ? entry[locale] : key
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replaceAll(`{${name}}`, String(replacement))
        }
      }
      return value
    },
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
