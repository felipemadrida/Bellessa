import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  Gift,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  cn,
  dateKey,
  formatTime,
  hourInTZ,
  initials,
  money,
  nextBirthdayDays,
  relativeDayLabel,
  todayKey,
} from '../lib/format'
import type { Appointment, Dashboard, DayRevenue, TopService } from '../lib/types'
import { Avatar, Button, Card, EmptyState, ProgressBar, SectionTitle, Skeleton, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'
import { usePreferences } from '../lib/preferences'

function GoalRing({ percent }: { percent: number }) {
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(251,247,242,.14)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#D9A441"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-medium text-cream">{Math.round(percent)}%</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-cream/55">de la meta</span>
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'rose',
}: {
  icon: typeof Clock3
  label: string
  value: string
  hint?: string
  tone?: 'rose' | 'sage' | 'gold' | 'ink' | 'silver'
}) {
  const tones = {
    rose: 'bg-rose-soft text-rose-deep',
    sage: 'bg-sage-soft text-sage',
    gold: 'bg-gold-soft text-[#8A6418]',
    ink: 'bg-sand text-ink',
    silver: 'metal-silver text-silver-deep',
  }
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}>
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="money mt-1 font-display text-[26px] font-medium leading-none text-ink">{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] text-muted">{hint}</p> : null}
    </Card>
  )
}

function RevenueChart({ data }: { data: DayRevenue[] }) {
  const max = Math.max(...data.map((day) => day.revenue_cents), 1)
  return (
    <div className="flex h-44 items-end gap-2 sm:gap-3">
      {data.map((day, index) => {
        const height = Math.max(3, Math.round((day.revenue_cents / max) * 100))
        const isToday = index === data.length - 1
        return (
          <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-32 w-full flex-1 items-end">
              <div
                className={cn(
                  'group relative w-full rounded-t-xl transition-all duration-500',
                  isToday ? 'bg-ink' : 'bg-[#E8B7C1] hover:bg-rose/80',
                )}
                style={{ height: `${Math.max(4, Math.round((day.revenue_cents / max) * 124))}px` }}
                title={`${day.label}: ${money(day.revenue_cents)}`}
              >
                <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] font-semibold text-cream group-hover:block">
                  {money(day.revenue_cents)}
                </span>
              </div>
            </div>
            <span className={cn('text-[10px] font-semibold', isToday ? 'text-ink' : 'text-muted')}>
              {day.label.split(' ')[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function UpcomingRow({ appointment }: { appointment: Appointment }) {
  const { business } = useAuth()
  if (!business) return null
  return (
    <Link
      to={`/agenda?date=${dateKey(appointment.start_at, business.timezone)}`}
      className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-sand/40 sm:gap-4 sm:px-3"
    >
      <div className="w-[68px] shrink-0 text-right">
        <p className="whitespace-nowrap text-[12px] font-bold text-ink">
          {formatTime(appointment.start_at, business.timezone)}
        </p>
        <p className="text-[10px] text-muted">{appointment.service.duration_min} min</p>
      </div>
      <Avatar name={appointment.client.name} color={appointment.staff.color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold text-ink">{appointment.client.name}</p>
        <p className="truncate text-[11.5px] text-muted">
          {appointment.service.name} · {appointment.staff.name}
        </p>
      </div>
      <div className="hidden sm:block">
        <StatusBadge status={appointment.status} />
      </div>
      <span className="money hidden text-[13px] font-semibold text-ink sm:block">
        {money(appointment.price_cents)}
      </span>
      <ChevronRight size={16} className="text-muted/50 transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  )
}

function TopServices({ services }: { services: TopService[] }) {
  const max = Math.max(...services.map((service) => service.revenue_cents), 1)
  if (!services.length) {
    return (
      <p className="rounded-2xl bg-sand/40 px-4 py-6 text-center text-xs text-muted">
        Aún no hay servicios cobrados este mes.
      </p>
    )
  }
  return (
    <div className="space-y-4">
      {services.slice(0, 4).map((service, index) => (
        <div key={service.service_id}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[10px] font-bold text-muted/60">{String(index + 1).padStart(2, '0')}</span>
              <p className="truncate text-[13px] font-semibold text-ink">{service.name}</p>
            </div>
            <span className="money shrink-0 text-[12px] font-semibold text-muted">
              {money(service.revenue_cents)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ProgressBar value={(service.revenue_cents / max) * 100} color={service.color} className="flex-1" />
            <span className="w-8 text-right text-[10px] text-muted">{service.count}×</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-56 w-full rounded-4xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-32 rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user, business } = useAuth()
  const { toast } = useToast()
  const { t } = usePreferences()
  const [copied, setCopied] = useState(false)
  const query = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const data: Dashboard | undefined = query.data

  if (!business || !user) return null
  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError || !data) {
    return (
      <Card>
        <EmptyState
          icon={<CircleAlert size={22} />}
          title="No pudimos cargar tu día"
          description="Revisa tu conexión e intenta de nuevo."
          action={<Button onClick={() => query.refetch()}>Reintentar</Button>}
        />
      </Card>
    )
  }

  const goalPercent = data.revenue_goal_cents
    ? (data.revenue_month_cents / data.revenue_goal_cents) * 100
    : 0
  const today = todayKey(business.timezone)
  const shareUrl = `${window.location.origin}/reservar/${business.slug}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast('Link de reservas copiado')
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      toast('No pudimos copiar el link', 'error')
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-deep">
            {capitalize(data.today_label)} · {business.city ?? 'Ciudad de México'}
          </p>
          <h1 className="mt-1 font-display text-[32px] font-medium leading-none tracking-[-0.025em] text-ink sm:text-[42px]">
            {(() => {
              const hour = hourInTZ(business.timezone)
              return `${t(hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening')}, ${user.name.split(' ')[0]}.`
            })()}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {data.unconfirmed > 0
              ? t('dashboard.unconfirmed', { n: data.unconfirmed, s: data.unconfirmed === 1 ? '' : 's' })
              : t('dashboard.confirmed')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={copyLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span className="hidden sm:inline">{t('dashboard.linkBooking')}</span>
            <span className="sm:hidden">{t('dashboard.share')}</span>
          </Button>
          <Link to="/agenda?nueva=1">
            <Button variant="rose">
              <CalendarPlus size={17} />
              {t('dashboard.newAppointment')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-4xl bg-ink px-5 py-6 text-cream shadow-lift sm:px-8 sm:py-8">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full opacity-70 blur-2xl"
          style={{ background: 'radial-gradient(circle, #D9A44155 0%, transparent 68%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full opacity-50 blur-2xl"
          style={{ background: 'radial-gradient(circle, #C2415A66 0%, transparent 70%)' }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/55">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
              {t('dashboard.incomeToday')}
            </div>
            <p className="money mt-2 font-display text-[52px] font-normal leading-none tracking-[-0.04em] sm:text-[64px]">
              {money(data.revenue_today_cents)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-cream/65">
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp size={14} className="text-gold" />
                {money(data.revenue_month_cents)} {t('dashboard.thisMonth')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={14} className="text-gold" />
                {t('dashboard.completedOf', { a: data.completed_today, b: data.appointments_today })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wallet size={14} className="text-gold" />
                {money(data.expected_cash_cents)} {t('dashboard.cash')}
              </span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Link
                to="/agenda"
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-cream px-4 text-[13px] font-bold text-ink transition hover:bg-white"
              >
                {t('dashboard.viewAgenda')} <ArrowRight size={15} />
              </Link>
              <Link
                to="/reportes"
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-cream/20 px-4 text-[13px] font-semibold text-cream/80 transition hover:bg-cream/10"
              >
                {t('nav.reports')}
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-3xl border border-cream/10 bg-cream/[.06] px-4 py-4 backdrop-blur-sm sm:flex-col sm:gap-2 sm:px-6">
            <GoalRing percent={goalPercent} />
            <div className="text-left sm:text-center">
              <p className="money text-sm font-bold text-cream">{money(data.revenue_month_cents)}</p>
              <p className="text-[11px] text-cream/50">{t('dashboard.de')} {money(data.revenue_goal_cents)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={CalendarPlus}
          label={t('dashboard.todayAppointments')}
          value={String(data.appointments_today)}
          hint={t('dashboard.toConfirm', { n: data.pending_today })}
          tone="rose"
        />
        <KpiCard
          icon={Wallet}
          label={t('dashboard.avgTicket')}
          value={money(data.average_ticket_cents)}
          hint={`${money(data.tips_today_cents)} ${t('dashboard.tips')}`}
          tone="sage"
        />
        <KpiCard
          icon={Sparkles}
          label={t('dashboard.occupancy')}
          value={`${data.occupancy_pct}%`}
          hint={t('dashboard.capacity')}
          tone="gold"
        />
        <KpiCard
          icon={Users}
          label={t('dashboard.newClients')}
          value={String(data.new_clients_month)}
          hint={t('dashboard.thisMonth')}
          tone="silver"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <SectionTitle
              title="Próximas citas"
              subtitle={`${data.upcoming.length} en lo que resta del día`}
              action={
                <Link to="/agenda" className="text-xs font-semibold text-rose hover:underline">
                  Ver todas
                </Link>
              }
            />
            {data.upcoming.length ? (
              <div className="-mx-1 divide-y divide-line/50">
                {data.upcoming.map((appointment) => (
                  <UpcomingRow key={appointment.id} appointment={appointment} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarPlus size={21} />}
                title="No hay más citas hoy"
                description="Aprovecha para descansar o abrir nuevos horarios en tu agenda."
                action={
                  <Link to="/agenda?nueva=1">
                    <Button size="sm" variant="secondary">
                      Agendar algo
                    </Button>
                  </Link>
                }
                className="py-8"
              />
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle
              title="Ingresos de la semana"
              subtitle="Últimos 7 días"
              action={
                <Link to="/reportes" className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose">
                  Detalle <ArrowUpRight size={13} />
                </Link>
              }
            />
            <RevenueChart data={data.revenue_last_7_days} />
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title="Servicios estrella" subtitle="Lo más vendido del mes" />
            <TopServices services={data.top_services} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-line/60 bg-gradient-to-br from-[#F6E4E7] to-[#FBF7F2] px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-rose-deep">Caja de hoy</p>
                  <p className="money mt-1 font-display text-[30px] font-medium leading-none text-ink">
                    {money(data.expected_cash_cents)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">Efectivo esperado en cajón</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-rose-deep">
                  <Wallet size={19} />
                </span>
              </div>
            </div>
            <div className="space-y-2.5 px-4 py-4 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">Propinas de hoy</span>
                <span className="money font-semibold text-ink">{money(data.tips_today_cents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Cobrado este mes</span>
                <span className="money font-semibold text-ink">{money(data.revenue_month_cents)}</span>
              </div>
              <Link
                to="/caja"
                className="mt-2 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-ink text-[12px] font-bold text-cream transition hover:bg-[#3A2D28]"
              >
                Ir a caja <ArrowRight size={13} />
              </Link>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title="Cumpleaños" subtitle="Esta semana" />
            {data.birthdays.length ? (
              <div className="space-y-1">
                {data.birthdays.map((client) => (
                  <Link
                    key={client.id}
                    to={`/clientas/${client.id}`}
                    className="flex items-center gap-3 rounded-2xl px-1 py-2 transition hover:bg-sand/40"
                  >
                    <Avatar name={client.name} color="#D9A441" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{client.name}</p>
                      <p className="text-[11px] text-muted">
                        {client.birthday ? nextBirthdayDays(client.birthday, today) : 0} días ·{' '}
                        {client.phone ? client.phone.slice(-4) : ''}
                      </p>
                    </div>
                    <Gift size={16} className="text-gold" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-sand/40 px-4 py-5 text-center text-xs text-muted">
                Sin cumpleaños próximos. Buen momento para pedir fechas de nacimiento.
              </p>
            )}
          </Card>

          {data.unconfirmed > 0 ? (
            <Link to="/agenda" className="block">
              <Card className="flex items-center gap-3 border-gold/30 bg-gold-soft/70 p-4 transition hover:bg-gold-soft">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60 text-[#8A6418]">
                  <CircleAlert size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[#6F5216]">
                    {data.unconfirmed} cita{data.unconfirmed === 1 ? '' : 's'} sin confirmar
                  </p>
                  <p className="text-[11px] text-[#8A6418]/80">Manda un recordatorio por WhatsApp</p>
                </div>
                <ChevronRight size={17} className="text-[#8A6418]/60" />
              </Card>
            </Link>
          ) : null}

          <div className="rounded-3xl border border-dashed border-line bg-white/40 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              <Sparkles size={13} className="text-gold" /> Tip Bellessa
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
              Comparte tu link de reservas en Instagram. Tus clientas eligen servicio, día y hora sin
              mandarte mensajes a medianoche.
            </p>
            <button
              type="button"
              onClick={copyLink}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-rose"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar link público'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: '/agenda?nueva=1', label: 'Nueva cita', icon: CalendarPlus },
          { to: '/clientas?nueva=1', label: 'Nueva clienta', icon: Users },
          { to: '/caja', label: 'Registrar gasto', icon: Wallet },
          { to: `/reservar/${business.slug}`, label: 'Ver reservas', icon: ArrowUpRight },
        ].map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="flex items-center gap-2.5 rounded-2xl border border-line bg-white/60 px-3 py-3 text-[12px] font-semibold text-ink transition hover:border-rose/30 hover:bg-white"
          >
            <action.icon size={16} className="text-rose" />
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
