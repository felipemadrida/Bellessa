import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleAlert,
  Download,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePreferences } from '../lib/preferences'
import {
  addDaysKey,
  cn,
  dateLongFromKey,
  money,
  todayKey,
} from '../lib/format'
import type { PaymentMethod, Report } from '../lib/types'
import { PageHeader } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionTitle,
  Segmented,
  Skeleton,
} from '../components/ui'

const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: '#4A6B5D',
  card: '#9C5566',
  transfer: '#A8842C',
  other: '#7E3F4E',
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'method.cash',
  card: 'method.card',
  transfer: 'method.transfer',
  other: 'method.other',
}

type Period = '7' | '30' | '90'

export function ReportsPage() {
  const { business } = useAuth()
  const { t } = usePreferences()
  const timezone = business?.timezone ?? 'America/Mexico_City'
  const today = todayKey(timezone)
  const [period, setPeriod] = useState<Period>('30')
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const start = addDaysKey(today, -(Number(period) - 1))
  const query = useQuery({
    queryKey: ['reports', start, today],
    queryFn: () => api.reports.summary(start, today),
  })
  const report: Report | undefined = query.data

  const bestDay = useMemo(() => {
    if (!report?.by_day.length) return null
    return report.by_day.reduce((best, day) => (day.revenue_cents > best.revenue_cents ? day : best))
  }, [report])

  async function exportCsv() {
    setExporting(true)
    try {
      await api.reports.exportCsv(start, today)
      toast('Reporte descargado')
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos exportar', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={t('page.reports.eyebrow')}
        title={t('page.reports.title')}
        subtitle={`${dateLongFromKey(start)} — ${dateLongFromKey(today)}`}
        actions={
          <>
            <Segmented
              options={[
                { value: '7', label: t('page.reports.days7') },
                { value: '30', label: t('page.reports.days30') },
                { value: '90', label: t('page.reports.days90') },
              ]}
              value={period}
              onChange={(value) => setPeriod(value as Period)}
            />
            <Button variant="rose" onClick={exportCsv} loading={exporting}>
              <Download size={16} /> {t('page.reports.export')}
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      ) : query.isError || !report ? (
        <Card>
          <EmptyState
            icon={<CircleAlert size={22} />}
            title={t('page.reports.errorTitle')}
            action={<Button onClick={() => query.refetch()}>Reintentar</Button>}
          />
        </Card>
      ) : report.payments_count === 0 ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={23} />}
            title={t('page.reports.emptyTitle')}
            description="Cuando registres cobros en la agenda, aquí verás ingresos, ocupación y servicios estrella."
            action={
              <Button variant="rose" onClick={() => (window.location.href = '/agenda?nueva=1')}>
                Agendar y cobrar
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={<Wallet size={17} />}
              label={t('reports.kpiRevenue')}
              value={money(report.revenue_cents)}
              hint={t('reports.kpiPayments', { n: report.payments_count })}
              tone="rose"
            />
            <Kpi
              icon={<TrendingUp size={17} />}
              label={t('reports.kpiAvgTicket')}
              value={money(report.avg_ticket_cents)}
              hint={t('reports.kpiTips', { amount: money(report.tips_cents) })}
              tone="sage"
            />
            <Kpi
              icon={<Sparkles size={17} />}
              label={t('reports.kpiOccupancy')}
              value={`${report.occupancy_pct}%`}
              hint={t('reports.kpiCompleted', { n: report.completed_appointments })}
              tone="gold"
            />
            <Kpi
              icon={<Users size={17} />}
              label={t('reports.kpiNewClients')}
              value={String(report.new_clients)}
              hint={t('reports.kpiRecurring', { n: report.recurring_clients })}
              tone="ink"
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
            <Card className="p-4 sm:p-5">
              <SectionTitle
                title={t('reports.byDay')}
                subtitle={
                  bestDay
                    ? `Mejor día: ${bestDay.label} con ${money(bestDay.revenue_cents)}`
                    : 'Sin datos'
                }
              />
              <RevenueBars report={report} />
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle title={t('reports.byMethod')} subtitle={t('reports.byMethodSub')} />
              <div className="flex items-center gap-5">
                <Donut report={report} />
                <div className="flex-1 space-y-2.5">
                  {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((method) => {
                    const value = report.by_method[method] ?? 0
                    const percent = report.revenue_cents
                      ? Math.round((value / report.revenue_cents) * 100)
                      : 0
                    return (
                      <div key={method} className="flex items-center gap-2 text-[11.5px]">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: METHOD_COLORS[method] }}
                        />
                        <span className="flex-1 font-medium text-muted">{t(METHOD_LABELS[method])}</span>
                        <span className="money font-semibold text-licorice">{money(value)}</span>
                        <span className="w-8 text-right text-[10px] text-muted">{percent}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-sage-soft/60 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sage">Canceladas</p>
                  <p className="font-display text-xl font-medium text-licorice">{report.canceled_appointments}</p>
                </div>
                <div className="rounded-2xl bg-blush-soft/60 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blush-deep">
                    {t('status.no_show')}
                  </p>
                  <p className="font-display text-xl font-medium text-licorice">{report.no_show_appointments}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <SectionTitle title={t('reports.topServices')} subtitle={t('reports.topServicesSub')} />
              <div className="space-y-3.5">
                {report.top_services.length ? (
                  report.top_services.map((service, index) => {
                    const max = report.top_services[0]?.revenue_cents || 1
                    return (
                      <div key={service.service_id}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold text-licorice">
                            <span className="text-[10px] font-bold text-muted/50">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="truncate">{service.name}</span>
                            <span className="shrink-0 text-[10px] text-muted">{service.count}×</span>
                          </span>
                          <span className="money shrink-0 text-[12px] font-semibold text-muted">
                            {money(service.revenue_cents)}
                          </span>
                        </div>
                        <ProgressBar
                          value={(service.revenue_cents / max) * 100}
                          color={service.color}
                        />
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-muted">{t('reports.noServices')}</p>
                )}
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle title={t('reports.team')} subtitle={t('reports.teamSub')} />
              <div className="space-y-3">
                {report.staff.map((member) => (
                  <div
                    key={member.staff_id}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-alabaster/40 px-3 py-2.5"
                  >
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: member.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-licorice">{member.name}</p>
                      <p className="text-[10.5px] text-muted">
                        {member.appointments} citas · {member.occupancy_pct}% ocupación
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="money text-[12.5px] font-bold text-licorice">
                        {money(member.revenue_cents)}
                      </p>
                      <p className="text-[9.5px] text-muted">
                        comisión {money(member.commission_cents)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <Card className="p-4 sm:p-5">
              <SectionTitle title={t('reports.topClients')} subtitle={t('reports.topClientsSub')} />
              {report.top_clients.length ? (
                <div className="divide-y divide-border/50">
                  {report.top_clients.map((client, index) => (
                    <div key={client.client_id} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sand text-[10px] font-bold text-muted">
                        {index + 1}
                      </span>
                      <p className="flex-1 truncate text-[12.5px] font-semibold text-licorice">{client.name}</p>
                      <span className="text-[10.5px] text-muted">{client.visits} visitas</span>
                      <span className="money w-20 text-right text-[12px] font-bold text-licorice">
                        {money(client.spent_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">{t('reports.noClients')}</p>
              )}
            </Card>

            <div className="relative overflow-hidden rounded-3xl bg-licorice p-5 text-alabaster">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-60 blur-2xl"
                style={{ background: 'radial-gradient(circle, #A8842C55, transparent 70%)' }}
              />
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-alabaster/50">
                <Sparkles size={13} className="text-gold" /> Lectura rápida
              </p>
              <p className="mt-3 font-display text-[26px] font-normal leading-tight tracking-[-0.02em]">
                {report.occupancy_pct >= 70
                  ? 'Tu agenda está trabajando muy bien.'
                  : report.occupancy_pct >= 40
                    ? 'Hay espacio para crecer esta semana.'
                    : 'Tienes mucho espacio para llenar.'}
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-alabaster/65">
                {report.occupancy_pct >= 70
                  ? 'Considera subir precios en los servicios más pedidos o abrir lista de espera.'
                  : 'Comparte tu link de reservas y manda recordatorios a clientas que no vuelven hace 30 días.'}
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-alabaster/60">
                <CalendarDays size={13} className="text-gold" />
                {dateLongFromKey(start)} — {dateLongFromKey(today)}
              </div>
              <button
                type="button"
                onClick={() => (window.location.href = `/reservar/${business?.slug ?? ''}`)}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-alabaster px-3.5 text-[11.5px] font-bold text-licorice"
              >
                Ver página de reservas <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone: 'rose' | 'sage' | 'gold' | 'ink'
}) {
  const tones = {
    rose: 'bg-blush-soft text-blush-deep',
    sage: 'bg-sage-soft text-sage',
    gold: 'bg-champagne-soft text-champagne-deep',
    ink: 'bg-sand text-licorice',
  }
  return (
    <Card className="p-4">
      <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl', tones[tone])}>
        {icon}
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="money mt-0.5 font-display text-[25px] font-medium leading-none text-licorice">{value}</p>
      <p className="mt-1 text-[10.5px] text-muted">{hint}</p>
    </Card>
  )
}

function RevenueBars({ report }: { report: Report }) {
  const { t } = usePreferences()
  const max = Math.max(...report.by_day.map((day) => day.revenue_cents), 1)
  const showEvery = report.by_day.length > 45 ? 10 : report.by_day.length > 20 ? 4 : 1
  return (
    <div className="scrollbar-none flex h-52 items-end gap-[3px] overflow-x-auto pb-1">
      {report.by_day.map((day, index) => {
        return (
          <div
            key={day.date}
            className="group flex h-full min-w-[10px] flex-1 flex-col items-center justify-end gap-1.5"
            title={t('reports.barTooltip', {
              label: day.label,
              amount: money(day.revenue_cents),
              n: day.appointments,
            })}
          >
            <div className="flex h-40 w-full flex-1 items-end">
              <div
                className="w-full rounded-t-[4px] bg-blush transition hover:bg-rose"
                style={{ height: `${Math.max(3, Math.round((day.revenue_cents / max) * 156))}px` }}
              />
            </div>
            <span
              className={cn(
                'whitespace-nowrap text-[8.5px] text-muted',
                index % showEvery !== 0 && 'opacity-0',
              )}
            >
              {day.label.split(' ')[1]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Donut({ report }: { report: Report }) {
  const { t } = usePreferences()
  const total = report.revenue_cents || 1
  let current = 0
  const segments: string[] = []
  ;(Object.keys(METHOD_COLORS) as PaymentMethod[]).forEach((method) => {
    const value = report.by_method[method] ?? 0
    const percent = (value / total) * 100
    const start = current
    current += percent
    if (value > 0) {
      segments.push(`${METHOD_COLORS[method]} ${start}% ${current}%`)
    }
  })
  if (!segments.length) segments.push('#EADFD2 0% 100%')
  return (
    <div
      className="relative h-28 w-28 shrink-0 rounded-full"
      style={{ background: `conic-gradient(${segments.join(', ')})` }}
      role="img"
      aria-label={t('reports.donutAria')}
    >
      <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-surface">
        <span className="text-[9px] uppercase tracking-wider text-muted">{t('nap.total')}</span>
        <span className="money font-display text-[15px] font-medium text-licorice">
          {money(report.revenue_cents)}
        </span>
      </div>
    </div>
  )
}
