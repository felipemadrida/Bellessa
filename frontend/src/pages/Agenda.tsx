import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Plus,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePreferences } from '../lib/preferences'
import {
  addDaysKey,
  cn,
  dateLongFromKey,
  dayNumber,
  formatDuration,
  formatTime,
  money,
  monthShort,
  startOfWeekKey,
  todayKey,
  weekdayShort,
} from '../lib/format'
import type { Appointment } from '../lib/types'
import { PageHeader } from '../components/AppShell'
import { AppointmentSheet } from '../components/AppointmentSheet'
import { NewAppointmentModal } from '../components/NewAppointmentModal'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Segmented,
  Skeleton,
  StatusBadge,
} from '../components/ui'
import { AgendaWeekView } from './AgendaWeekView'

export function AgendaPage() {
  const { business, user } = useAuth()
  const { t } = usePreferences()
  const timezone = business?.timezone ?? 'America/Mexico_City'
  const today = todayKey(timezone)
  const [params, setParams] = useSearchParams()

  const date = params.get('date') ?? today
  const staffParam = Number(params.get('staff')) || null
  const view = params.get('vista') === 'semana' ? 'week' : 'day'
  const [newOpen, setNewOpen] = useState(params.get('nueva') === '1')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [staffFilter, setStaffFilter] = useState<number | null>(staffParam)

  const appointmentsQuery = useQuery({
    queryKey: ['agenda', date],
    queryFn: () => api.appointments.list(date),
  })
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: () => api.staff.list() })

  const weekStart = startOfWeekKey(date)
  const weekDays = Array.from({ length: 7 }, (_, index) => addDaysKey(weekStart, index))
  const appointments = appointmentsQuery.data ?? []
  const staff = staffQuery.data ?? []

  const filtered = useMemo(
    () => (staffFilter ? appointments.filter((item) => item.staff.id === staffFilter) : appointments),
    [appointments, staffFilter],
  )

  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const appointment of filtered) {
      const label = new Intl.DateTimeFormat('es-MX', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: true,
      }).format(new Date(appointment.start_at))
      const list = map.get(label) ?? []
      list.push(appointment)
      map.set(label, list)
    }
    return Array.from(map.entries())
  }, [filtered, timezone])

  const activeAppointments = filtered.filter(
    (item) => item.status !== 'canceled' && item.status !== 'no_show',
  )
  const expectedRevenue = activeAppointments.reduce((sum, item) => sum + item.price_cents, 0)
  const confirmed = filtered.filter((item) => item.status === 'confirmed' || item.status === 'completed').length
  const pending = filtered.filter((item) => item.status === 'pending').length

  function updateParams(next: { date?: string; staff?: number | null }) {
    const updated = new URLSearchParams(params)
    if (next.date !== undefined) {
      if (next.date === today) updated.delete('date')
      else updated.set('date', next.date)
    }
    if (next.staff !== undefined) {
      if (next.staff) updated.set('staff', String(next.staff))
      else updated.delete('staff')
    }
    setParams(updated, { replace: true })
  }

  function changeDate(next: string) {
    updateParams({ date: next })
  }

  function changeStaff(id: number | null) {
    setStaffFilter(id)
    updateParams({ staff: id })
  }

  function changeView(next: 'day' | 'week') {
    const updated = new URLSearchParams(params)
    if (next === 'week') updated.set('vista', 'semana')
    else updated.delete('vista')
    setParams(updated, { replace: true })
  }

  function openNew() {
    setNewOpen(true)
    if (params.get('nueva')) {
      const updated = new URLSearchParams(params)
      updated.delete('nueva')
      setParams(updated, { replace: true })
    }
  }

  const canCreate = user?.role === 'owner' || user?.role === 'staff'

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={t('page.agenda.eyebrow')}
        title={t('page.agenda.title')}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{dateLongFromKey(date)}</span>
            <span className="text-line">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-licorice">
              <Clock3 size={13} /> {filtered.length}{' '}
              {filtered.length === 1
                ? t('page.agenda.appointmentOne')
                : t('page.agenda.appointmentMany')}
            </span>
          </span>
        }
        actions={
          <>
            <div className="hidden items-center gap-1.5 rounded-pill border border-border bg-alabaster px-2 py-1.5 sm:flex">
              <button
                type="button"
                aria-label={t('common.prevDay')}
                onClick={() => changeDate(addDaysKey(date, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-taupe transition hover:bg-alabaster/60"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={date}
                onChange={(event) => changeDate(event.target.value)}
                className="w-[128px] border-0 bg-transparent px-1 text-xs font-semibold text-licorice focus:outline-none"
                aria-label={t('common.pickDate')}
              />
              <button
                type="button"
                aria-label={t('common.nextDay')}
                onClick={() => changeDate(addDaysKey(date, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-taupe transition hover:bg-alabaster/60"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Button variant="rose" onClick={openNew} className="rounded-pill bg-licorice hover:bg-licorice/90">
              <Plus size={17} /> {t('common.newAppointment')}
            </Button>
          </>
        }
      />

      {/* Semana */}
      <Card className="mb-4 rounded-card p-2.5 sm:p-3 shadow-boutique">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('common.prevWeek')}
              onClick={() => changeDate(addDaysKey(weekStart, -7))}
              className="flex h-7 w-7 items-center justify-center rounded-xl text-taupe hover:bg-alabaster/60"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              aria-label={t('common.nextWeek')}
              onClick={() => changeDate(addDaysKey(weekStart, 7))}
              className="flex h-7 w-7 items-center justify-center rounded-xl text-taupe hover:bg-alabaster/60"
            >
              <ChevronRight size={15} />
            </button>
            <span className="ml-1 text-[11px] font-semibold text-taupe">
              {monthShort(weekStart)} · {dayNumber(weekStart)} – {dayNumber(addDaysKey(weekStart, 6))}
            </span>
          </div>
          <button
            type="button"
            onClick={() => changeDate(today)}
            className={cn(
              'rounded-pill px-3 py-1 text-[11px] font-bold transition',
              date === today ? 'bg-licorice text-alabaster' : 'bg-alabaster text-licorice hover:bg-blush-soft',
            )}
          >
            {t('nav.hoy')}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const active = day === date
            const count = day === date ? filtered.length : undefined
            return (
              <button
                key={day}
                type="button"
                onClick={() => changeDate(day)}
                aria-pressed={active}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 rounded-card px-1 py-2.5 transition',
                  active ? 'bg-licorice text-alabaster shadow-boutique' : 'text-taupe hover:bg-alabaster/60',
                )}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider text-taupe">
                  {weekdayShort(day)}
                </span>
                <span
                  className={cn(
                    'font-display text-lg font-medium leading-none',
                    day === today && !active ? 'text-blush' : '',
                  )}
                >
                  {dayNumber(day)}
                </span>
                {active && count !== undefined ? (
                  <span className="text-[9px] text-alabaster/60">
                    {count}{' '}
                    {count === 1
                      ? t('page.agenda.appointmentOne')
                      : t('page.agenda.appointmentMany')}
                  </span>
                ) : day === today ? (
                  <span className="h-1 w-1 rounded-full bg-blush" />
                ) : (
                  <span className="h-1" />
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Resumen + filtro */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Segmented
            size="sm"
            value={view}
            onChange={changeView}
            options={[
              { value: 'day', label: 'Día' },
              { value: 'week', label: 'Semana' },
            ]}
            className="shrink-0"
          />
          <button
            type="button"
            onClick={() => changeStaff(null)}
            className={cn(
              'flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-[11.5px] font-semibold transition',
              staffFilter === null
                ? 'border-licorice bg-licorice text-alabaster'
                : 'border-border bg-alabaster text-taupe hover:border-blush/30',
            )}
          >
            <Sparkles size={13} /> {t('page.agenda.allTeam')}
          </button>
          {staff.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => changeStaff(staffFilter === member.id ? null : member.id)}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-pill border pl-1 pr-3 text-[11.5px] font-semibold transition',
                staffFilter === member.id
                  ? 'border-licorice bg-alabaster text-licorice shadow-boutique'
                  : 'border-border bg-alabaster text-taupe hover:border-blush/30',
              )}
            >
              <Avatar name={member.name} color={member.color} size="xs" />
              {member.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {view === 'day' ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-alabaster px-3 text-[11px] font-semibold text-taupe">
              <Check size={12} className="text-blush" /> {t('page.agenda.confirmedCount', { n: confirmed })}
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-alabaster px-3 text-[11px] font-semibold text-taupe">
              <Clock3 size={12} className="text-champagne" /> {t('page.agenda.pendingCount', { n: pending })}
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-alabaster px-3 text-[11px] font-semibold text-taupe">
              <Wallet size={12} className="text-blush" /> {money(expectedRevenue)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Agenda */}
      {view === 'week' ? (
        <AgendaWeekView
          weekDays={weekDays}
          timezone={timezone}
          today={today}
          staffFilter={staffFilter}
          onSelectDay={changeDate}
          onSelect={(appointment) => setSelected(appointment)}
        />
      ) : appointmentsQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-24 rounded-card" />
          ))}
        </div>
      ) : appointmentsQuery.isError ? (
        <Card className="shadow-boutique">
          <EmptyState
            icon={<CircleAlert size={22} />}
            title={t('page.agenda.errorTitle')}
            description={t('common.connectionError')}
            action={<Button onClick={() => appointmentsQuery.refetch()}>{t('common.retry')}</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="shadow-boutique">
          <EmptyState
            icon={<CalendarDays size={23} />}
            title={t('page.agenda.freeTitle')}
            description={t('page.agenda.freeDesc')}
            action={
              <Button variant="rose" onClick={openNew} className="rounded-pill bg-licorice hover:bg-licorice/90">
                <CalendarPlus size={16} /> {t('page.agenda.schedule')}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map(([hour, items]) => (
            <div key={hour} className="flex gap-3 sm:gap-5">
              <div className="w-12 shrink-0 pt-2.5 text-right sm:w-16">
                <p className="text-[12px] font-bold text-licorice">{hour}</p>
                <p className="text-[9px] uppercase tracking-wider text-taupe/60">{items.length} cita{items.length === 1 ? '' : 's'}</p>
              </div>
              <div className="relative flex-1 space-y-2 border-l border-border/70 pl-3 sm:pl-5">
                {items.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setSelected(appointment)}
                    className="group relative w-full overflow-hidden rounded-card border border-border bg-alabaster/85 p-3.5 text-left shadow-boutique transition hover:-translate-y-0.5 hover:border-blush/30 hover:shadow-lift sm:p-4"
                  >
                    <span
                      className="absolute inset-y-3 left-0 w-[3px] rounded-full"
                      style={{ backgroundColor: appointment.service.color }}
                    />
                    <div className="flex items-start gap-3 pl-1.5">
                      <div className="w-[72px] shrink-0">
                        <p className="whitespace-nowrap text-[12px] font-bold text-licorice">
                          {formatTime(appointment.start_at, timezone)}
                        </p>
                        <p className="whitespace-nowrap text-[10px] text-taupe">
                          {formatTime(appointment.end_at, timezone)}
                        </p>
                        <p className="mt-0.5 text-[9.5px] text-taupe/70">
                          {formatDuration(appointment.service.duration_min)}
                        </p>
                      </div>
                      <Avatar
                        name={appointment.client.name}
                        color={appointment.staff.color}
                        size="sm"
                        className="hidden sm:inline-flex"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate text-[14px] font-bold text-licorice">
                            {appointment.client.name}
                          </p>
                          <StatusBadge status={appointment.status} />
                          {appointment.payment ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blush">
                              <Check size={11} /> Pagado
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[11.5px] text-taupe">
                          {appointment.service.name} · {appointment.staff.name}
                        </p>
                        {appointment.notes ? (
                          <p className="mt-1 truncate text-[10.5px] italic text-taupe/70">
                            {appointment.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="money text-[13px] font-bold text-licorice">
                          {money(appointment.price_cents)}
                        </p>
                        <p className="mt-1 text-[9.5px] uppercase tracking-wider text-taupe/60">
                          {appointment.source === 'public'
                            ? t('source.online')
                            : appointment.source === 'whatsapp'
                              ? t('source.whatsapp')
                              : t('source.counter')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {canCreate ? (
        <NewAppointmentModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          initialDate={date}
          initialStaffId={staffFilter ?? undefined}
          onCreated={(appointment) => setSelected(appointment)}
        />
      ) : null}

      <AppointmentSheet
        open={!!selected}
        appointment={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
