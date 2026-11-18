import { useState } from 'react'
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageCircle,
  Moon,
  Plus,
  Scissors,
  Send,
  Sparkles,
  Sun,
  User,
  X,
} from 'lucide-react'
import { cn, money } from '../lib/format'
import { usePreferences } from '../lib/preferences'

/**
 * Laboratorio de paleta "Quiet Luxury v2".
 *
 * Vista previa aislada (sin API) para validar los neutros cálidos sobre la
 * pantalla de agenda móvil. No es una pantalla de producción: sirve para
 * revisar contraste y armonía de la paleta en contexto real de UI.
 */

type DemoStatus = 'confirmed' | 'pending' | 'marketing'

interface DemoAppointment {
  id: number
  clientName: string
  service: string
  stylist: string
  time: string
  duration: string
  priceCents: number
  status: DemoStatus
  whatsappStatus: string
  icon: 'scissors' | 'calendar' | 'phone' | 'whatsapp'
}

const STYLISTS = ['Todas', 'Sofía R.', 'Elena M.', 'Daniela V.'] as const

const INITIAL_APPOINTMENTS: DemoAppointment[] = [
  {
    id: 1,
    clientName: 'Valeria Montes',
    service: 'Balayage & corte bordado',
    stylist: 'Sofía R.',
    time: '10:00',
    duration: '120 min',
    priceCents: 185000,
    status: 'confirmed',
    whatsappStatus: 'Confirmado por WhatsApp · hace 2 h',
    icon: 'scissors',
  },
  {
    id: 2,
    clientName: 'Camila Elizondo',
    service: 'Tratamiento de hidratación VIP',
    stylist: 'Elena M.',
    time: '12:30',
    duration: '60 min',
    priceCents: 95000,
    status: 'pending',
    whatsappStatus: 'Recordatorio 24 h enviado · esperando «1»',
    icon: 'calendar',
  },
  {
    id: 3,
    clientName: 'Mariana Grijalva',
    service: 'Diseño de cejas & lifting',
    stylist: 'Sofía R.',
    time: '14:00',
    duration: '45 min',
    priceCents: 60000,
    status: 'confirmed',
    whatsappStatus: 'Cita agendada por el bot de WhatsApp',
    icon: 'phone',
  },
  {
    id: 4,
    clientName: 'Lucía Fernanda',
    service: 'Manicure gel & spa pedicure',
    stylist: 'Daniela V.',
    time: '16:15',
    duration: '90 min',
    priceCents: 78000,
    status: 'marketing',
    whatsappStatus: 'Cupón win-back (30 días) canjeado',
    icon: 'whatsapp',
  },
]

const ICONS = {
  scissors: Scissors,
  calendar: Calendar,
  phone: Clock,
  whatsapp: MessageCircle,
} as const

const STATUS_BADGE: Record<DemoStatus, string> = {
  confirmed: 'bg-blush text-licorice',
  pending: 'bg-champagne text-licorice',
  marketing: 'bg-blush-light text-taupe border border-blush',
}

export function PaletaPreviewPage() {
  const { theme, toggleTheme } = usePreferences()
  const [stylist, setStylist] = useState<(typeof STYLISTS)[number]>('Todas')
  const [appointments, setAppointments] = useState<DemoAppointment[]>(INITIAL_APPOINTMENTS)
  const [quickOpen, setQuickOpen] = useState(false)
  const [tab, setTab] = useState<'calendar' | 'services' | 'alerts' | 'profile'>('calendar')
  const [draft, setDraft] = useState({ clientName: '', service: 'Corte & brushing', stylist: 'Sofía R.', time: '17:30' })

  const visible = stylist === 'Todas' ? appointments : appointments.filter((item) => item.stylist === stylist)

  function createAppointment() {
    if (!draft.clientName.trim()) return
    setAppointments((current) => [
      {
        id: Date.now(),
        clientName: draft.clientName.trim(),
        service: draft.service,
        stylist: draft.stylist,
        time: draft.time,
        duration: '60 min',
        priceCents: 75000,
        status: 'pending',
        whatsappStatus: 'Enviando confirmación automática…',
        icon: 'scissors',
      },
      ...current,
    ])
    setDraft({ clientName: '', service: 'Corte & brushing', stylist: 'Sofía R.', time: '17:30' })
    setQuickOpen(false)
  }

  const estimate = visible.reduce((sum, item) => sum + item.priceCents, 0)

  return (
    <div className="flex min-h-dvh justify-center bg-alabaster px-0 py-0 font-sans text-licorice md:items-start md:px-6 md:py-8">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema negro'}
        className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-pill border border-border bg-surface/90 px-4 py-2 text-[11px] font-semibold text-licorice shadow-boutique backdrop-blur transition hover:border-blush-deep/40"
      >
        {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-champagne" /> : <Moon className="h-3.5 w-3.5 text-blush-deep" />}
        {theme === 'dark' ? 'Tema claro' : 'Tema negro'}
      </button>
      <div className="relative flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-alabaster md:min-h-[860px] md:rounded-[40px] md:border-[8px] md:border-licorice md:shadow-lift">
        {/* Cabecera blush */}
        <header className="relative bg-gradient-to-b from-blush via-blush-light to-alabaster px-6 pb-8 pt-10">
          <div className="mb-6 flex items-center justify-between">
            <span className="rounded-pill border border-white/50 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-taupe backdrop-blur-sm">
              Hoy · 18 nov
            </span>
            <button
              type="button"
              aria-label="Notificaciones"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-licorice shadow-boutique backdrop-blur-sm transition hover:bg-white"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2.5 top-2 h-2.5 w-2.5 rounded-full bg-champagne ring-2 ring-white" />
            </button>
          </div>

          <div className="my-2 text-center">
            <h1 className="font-display text-4xl font-normal tracking-tight text-licorice">Bellessa</h1>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.22em] text-taupe">
              Quiet luxury agenda & CRM
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-border bg-white/80 p-3 text-center shadow-boutique backdrop-blur-md">
              <p className="text-[11px] font-medium text-muted">Citas hoy</p>
              <p className="mt-0.5 font-display text-xl text-licorice">{visible.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/80 p-3 text-center shadow-boutique backdrop-blur-md">
              <p className="text-[11px] font-medium text-muted">WhatsApp</p>
              <p className="mt-0.5 font-display text-xl text-sage-deep">92%</p>
            </div>
            <div className="rounded-2xl border border-champagne/40 bg-white/80 p-3 text-center shadow-boutique backdrop-blur-md">
              <p className="text-[11px] font-medium text-muted">Estimado</p>
              <p className="money mt-0.5 font-display text-xl text-champagne-deep">{money(estimate)}</p>
            </div>
          </div>
        </header>

        {/* Cuerpo */}
        <main className="relative -mt-3 flex flex-1 flex-col rounded-t-[32px] border-t border-border bg-surface px-6 pb-28 pt-6 shadow-[0_-8px_30px_rgba(138,106,94,0.10)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-medium text-licorice">Menú de citas</h2>
              <p className="text-xs text-muted">Sincronizado con el bot de WhatsApp</p>
            </div>
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              className="flex items-center gap-1.5 rounded-pill border border-transparent bg-licorice px-4 py-2.5 text-xs font-medium text-alabaster shadow-boutique transition hover:border-champagne hover:bg-licorice/90"
            >
              <Plus className="h-4 w-4 text-champagne" />
              Cita rápida
            </button>
          </div>

          <div className="scrollbar-none mb-3 flex gap-2 overflow-x-auto pb-3">
            {STYLISTS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStylist(option)}
                className={cn(
                  'whitespace-nowrap rounded-pill px-4 py-1.5 text-xs font-medium transition-all',
                  stylist === option
                    ? 'bg-licorice text-alabaster shadow-boutique'
                    : 'bg-alabaster text-taupe hover:bg-blush/40 hover:text-licorice',
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {visible.map((item) => {
              const Icon = ICONS[item.icon]
              return (
                <button
                  type="button"
                  key={item.id}
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-alabaster/60 p-3.5 text-left transition-all hover:bg-alabaster hover:shadow-boutique"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-boutique',
                        STATUS_BADGE[item.status],
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-licorice">{item.clientName}</h3>
                        <span className="rounded-pill border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold text-licorice">
                          {item.time}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {item.service} · <span className="font-medium text-taupe">{item.stylist}</span>
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        {item.status === 'confirmed' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sage-deep" />
                        ) : item.status === 'pending' ? (
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-champagne-deep" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold" />
                        )}
                        <span className="max-w-[190px] truncate text-[11px] text-muted">{item.whatsappStatus}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden text-right sm:block">
                      <span className="money block text-xs font-semibold text-licorice">{money(item.priceCents)}</span>
                      <span className="text-[10px] text-muted">{item.duration}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-taupe transition-transform group-hover:translate-x-0.5 group-hover:text-licorice" />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Banner win-back */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-licorice to-mocha p-3.5 text-alabaster shadow-lift">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-champagne bg-champagne/20 text-champagne">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-white">Motor win-back activo</p>
                <p className="text-[11px] text-blush">8 clientas reactivadas esta semana</p>
              </div>
            </div>
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-champagne">
              Ver CRM
            </span>
          </div>

          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.16em] text-muted">
            Vista previa de paleta · no es una pantalla de producción
          </p>
        </main>

        {/* Modal cita rápida */}
        {quickOpen ? (
          <div className="absolute inset-0 z-30 flex items-end justify-center bg-licorice/60 p-4 backdrop-blur-sm">
            <div className="w-full animate-fade-up rounded-card border border-border bg-alabaster p-6 shadow-lift">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl text-licorice">Agendar en 3 clics</h3>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setQuickOpen(false)}
                  className="rounded-full p-1 text-taupe transition hover:bg-sand hover:text-licorice"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                className="space-y-3.5"
                onSubmit={(event) => {
                  event.preventDefault()
                  createAppointment()
                }}
              >
                <div>
                  <label htmlFor="cliente" className="mb-1 block text-xs font-medium text-muted">
                    Nombre o WhatsApp de la clienta
                  </label>
                  <input
                    id="cliente"
                    required
                    value={draft.clientName}
                    onChange={(event) => setDraft({ ...draft, clientName: event.target.value })}
                    placeholder="Ej. Andrea Salazar (+52 662…)"
                    className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-licorice placeholder:text-muted/60 focus:border-champagne focus:outline-none focus:ring-4 focus:ring-champagne/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="servicio" className="mb-1 block text-xs font-medium text-muted">
                      Servicio
                    </label>
                    <select
                      id="servicio"
                      value={draft.service}
                      onChange={(event) => setDraft({ ...draft, service: event.target.value })}
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs text-licorice focus:border-champagne focus:outline-none focus:ring-4 focus:ring-champagne/20"
                    >
                      <option>Corte & brushing</option>
                      <option>Balayage & babylights</option>
                      <option>Manicure gel VIP</option>
                      <option>Hidratación profunda</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="especialista" className="mb-1 block text-xs font-medium text-muted">
                      Especialista
                    </label>
                    <select
                      id="especialista"
                      value={draft.stylist}
                      onChange={(event) => setDraft({ ...draft, stylist: event.target.value })}
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs text-licorice focus:border-champagne focus:outline-none focus:ring-4 focus:ring-champagne/20"
                    >
                      <option>Sofía R.</option>
                      <option>Elena M.</option>
                      <option>Daniela V.</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-pill border border-champagne/50 bg-licorice py-3 text-xs font-semibold uppercase tracking-wider text-alabaster shadow-boutique transition hover:bg-licorice/90"
                >
                  <Send className="h-3.5 w-3.5 text-champagne" />
                  Guardar y enviar WhatsApp
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {/* Barra inferior */}
        <nav className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-border bg-alabaster/90 px-8 py-3 backdrop-blur-md">
          {(
            [
              ['services', Scissors],
              ['calendar', Calendar],
              ['alerts', Bell],
              ['profile', User],
            ] as const
          ).map(([key, Icon], index) =>
            index === 2 ? (
              <div key="quick" className="-mt-8 flex items-center gap-6">
                <button
                  type="button"
                  aria-label="Nueva cita rápida"
                  onClick={() => setQuickOpen(true)}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-champagne bg-licorice text-blush shadow-lift transition hover:scale-105"
                >
                  <Scissors className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  aria-label="Alertas"
                  onClick={() => setTab('alerts')}
                  className={cn('transition', tab === 'alerts' ? 'text-licorice' : 'text-taupe')}
                >
                  <Icon className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                key={key}
                type="button"
                aria-label={key}
                onClick={() => setTab(key)}
                className={cn('transition', tab === key ? 'text-licorice' : 'text-taupe hover:text-muted')}
              >
                <Icon className="h-5 w-5" />
              </button>
            ),
          )}
        </nav>
      </div>
    </div>
  )
}
