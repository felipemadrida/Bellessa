import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { api } from '../lib/api'
import { cn, dayNumber, formatTime, money, STATUS_TONE, weekdayShort } from '../lib/format'
import { usePreferences } from '../lib/preferences'
import type { Appointment } from '../lib/types'
import { Skeleton, StatusDot } from '../components/ui'

interface AgendaWeekViewProps {
  weekDays: string[]
  timezone: string
  today: string
  staffFilter: number | null
  onSelectDay: (day: string) => void
  onSelect: (appointment: Appointment) => void
}

/**
 * Vista semanal de la agenda: 7 columnas (una por día) que muestran las citas
 * del día apiladas en orden cronológico. Reutiliza la misma clave de consulta
 * (`['agenda', día]`) que la vista diaria, de modo que la caché de TanStack
 * Query se comparte entre ambas vistas y no se disparan peticiones duplicadas.
 */
export function AgendaWeekView({
  weekDays,
  timezone,
  today,
  staffFilter,
  onSelectDay,
  onSelect,
}: AgendaWeekViewProps) {
  const { t } = usePreferences()
  const dayQueries = useQueries({
    queries: weekDays.map((day) => ({
      queryKey: ['agenda', day],
      queryFn: () => api.appointments.list(day),
    })),
  })

  const isLoading = dayQueries.some((query) => query.isLoading)
  const isError = dayQueries.some((query) => query.isError)

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    weekDays.forEach((day, index) => {
      const items = dayQueries[index]?.data ?? []
      const filtered = staffFilter
        ? items.filter((appointment) => appointment.staff.id === staffFilter)
        : items
      filtered.sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      )
      map.set(day, filtered)
    })
    return map
  }, [dayQueries, weekDays, staffFilter])

  if (isLoading) {
    return (
      <div className="grid min-w-[980px] grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div key={day} className="space-y-2">
            <Skeleton className="h-12 rounded-card" />
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-20 rounded-card" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-card border border-border bg-surface/85 p-10 text-center shadow-boutique">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sand text-muted">
          <CalendarDays size={22} />
        </div>
        <h3 className="font-display text-lg font-medium text-licorice">
          {t('agendaWeek.errorTitle')}
        </h3>
        <p className="mt-1 text-sm text-muted">{t('common.connectionError')}</p>
      </div>
    )
  }

  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="grid min-w-[980px] grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const items = byDay.get(day) ?? []
          const active = day === today
          return (
            <div
              key={day}
              className={cn(
                'flex flex-col overflow-hidden rounded-card border bg-surface/60 shadow-soft transition',
                active ? 'border-blush/30 ring-1 ring-blush/20' : 'border-border',
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  'flex flex-col items-center gap-0.5 border-b px-1 py-2.5 text-center transition',
                  active ? 'border-blush/20 bg-blush-soft' : 'border-border/70 hover:bg-alabaster/70',
                )}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider text-taupe">
                  {weekdayShort(day)}
                </span>
                <span
                  className={cn(
                    'font-display text-lg font-medium leading-none',
                    active ? 'text-blush-deep' : 'text-licorice',
                  )}
                >
                  {dayNumber(day)}
                </span>
                <span className="text-[9px] font-semibold text-taupe/70">
                  {items.length}{' '}
                  {items.length === 1
                    ? t('page.agenda.appointmentOne')
                    : t('page.agenda.appointmentMany')}
                </span>
              </button>

              <div className="flex-1 space-y-1.5 overflow-y-auto p-1.5">
                {items.length === 0 ? (
                  <p className="px-1 py-4 text-center text-[10.5px] italic text-taupe/50">
                    {t('agendaWeek.free')}
                  </p>
                ) : (
                  items.map((appointment) => (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => onSelect(appointment)}
                      className="group relative w-full overflow-hidden rounded-xl border border-border bg-alabaster/85 p-2 pl-2.5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-blush/30 hover:shadow-lift"
                    >
                      <span
                        className="absolute inset-y-2 left-0 w-[3px] rounded-full"
                        style={{ backgroundColor: appointment.service.color }}
                      />
                      <div className="pl-1.5">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="whitespace-nowrap text-[11px] font-bold text-licorice">
                            {formatTime(appointment.start_at, timezone)}
                          </p>
                          <span className="whitespace-nowrap text-[10px] font-bold text-licorice">
                            {money(appointment.price_cents)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[12px] font-semibold text-licorice">
                          {appointment.client.name}
                        </p>
                        <p className="truncate text-[10.5px] text-taupe">
                          {appointment.service.name}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1">
                          <StatusDot status={appointment.status} />
                          <span
                            className={cn(
                              'truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                              STATUS_TONE[appointment.status],
                            )}
                          >
                            {t(`status.${appointment.status}`)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
