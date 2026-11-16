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
  Skeleton,
  StatusBadge,
} from '../components/ui'

export function AgendaPage() {
  const { business, user } = useAuth()
  const timezone = business?.timezone ?? 'America/Mexico_City'
  const today = todayKey(timezone)
  const [params, setParams] = useSearchParams()

  const date = params.get('date') ?? today
  const staffParam = Number(params.get('staff')) || null
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
        eyebrow="Tu día, a la vista"
        title="Agenda"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{dateLongFromKey(date)}</span>
            <span className="text-line">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <Clock3 size={13} /> {filtered.length} citas
            </span>
          </span>
        }
        actions={
          <>
            <div className="hidden items-center gap-1.5 rounded-2xl border border-line bg-white px-2 py-1.5 sm:flex">
              <button
                type="button"
                aria-label="Día anterior"
                onClick={() => changeDate(addDaysKey(date, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-sand"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={date}
                onChange={(event) => changeDate(event.target.value)}
                className="w-[128px] border-0 bg-transparent px-1 text-xs font-semibold text-ink focus:outline-none"
                aria-label="Elegir fecha"
              />
              <button
                type="button"
                aria-label="Día siguiente"
                onClick={() => changeDate(addDaysKey(date, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-sand"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Button variant="rose" onClick={openNew}>
              <Plus size={17} /> Nueva cita
            </Button>
          </>
        }
      />

      {/* Semana */}
      <Card className="mb-4 p-2.5 sm:p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Semana anterior"
              onClick={() => changeDate(addDaysKey(weekStart, -7))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-sand"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              aria-label="Semana siguiente"
              onClick={() => changeDate(addDaysKey(weekStart, 7))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-sand"
            >
              <ChevronRight size={15} />
            </button>
            <span className="ml-1 text-[11px] font-semibold text-muted">
              {monthShort(weekStart)} · {dayNumber(weekStart)} – {dayNumber(addDaysKey(weekStart, 6))}
            </span>
          </div>
          <button
            type="button"
            onClick={() => changeDate(today)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-bold transition',
              date === today ? 'bg-ink text-cream' : 'bg-sand text-ink hover:bg-rose-soft',
            )}
          >
            Hoy
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
                  'relative flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2.5 transition',
                  active ? 'bg-ink text-cream shadow-soft' : 'text-muted hover:bg-sand/60',
                )}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider">
                  {weekdayShort(day)}
                </span>
                <span
                  className={cn(
                    'font-display text-lg font-medium leading-none',
                    day === today && !active ? 'text-rose' : '',
                  )}
                >
                  {dayNumber(day)}
                </span>
                {active && count !== undefined ? (
                  <span className="text-[9px] text-cream/60">{count} citas</span>
                ) : day === today ? (
                  <span className="h-1 w-1 rounded-full bg-rose" />
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
          <button
            type="button"
            onClick={() => changeStaff(null)}
            className={cn(
              'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-semibold transition',
              staffFilter === null
                ? 'border-ink bg-ink text-cream'
                : 'border-line bg-white text-muted hover:border-rose/30',
            )}
          >
            <Sparkles size={13} /> Todo el equipo
          </button>
          {staff.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => changeStaff(staffFilter === member.id ? null : member.id)}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-full border pl-1 pr-3 text-[11.5px] font-semibold transition',
                staffFilter === member.id
                  ? 'border-ink bg-white text-ink shadow-soft'
                  : 'border-line bg-white text-muted hover:border-rose/30',
              )}
            >
              <Avatar name={member.name} color={member.color} size="xs" />
              {member.name.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-semibold text-muted">
            <Check size={12} className="text-sage" /> {confirmed} confirmadas
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-semibold text-muted">
            <Clock3 size={12} className="text-gold" /> {pending} por confirmar
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-semibold text-muted">
            <Wallet size={12} className="text-rose" /> {money(expectedRevenue)}
          </span>
        </div>
      </div>

      {/* Agenda */}
      {appointmentsQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : appointmentsQuery.isError ? (
        <Card>
          <EmptyState
            icon={<CircleAlert size={22} />}
            title="No pudimos cargar la agenda"
            description="Revisa tu conexión e intenta de nuevo."
            action={<Button onClick={() => appointmentsQuery.refetch()}>Reintentar</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays size={23} />}
            title="Este día está libre"
            description="Abre un horario nuevo o comparte tu link de reservas para que las clientas elijan."
            action={
              <Button variant="rose" onClick={openNew}>
                <CalendarPlus size={16} /> Agendar cita
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map(([hour, items]) => (
            <div key={hour} className="flex gap-3 sm:gap-5">
              <div className="w-12 shrink-0 pt-2.5 text-right sm:w-16">
                <p className="text-[12px] font-bold text-ink">{hour}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted/60">{items.length} cita{items.length === 1 ? '' : 's'}</p>
              </div>
              <div className="relative flex-1 space-y-2 border-l border-line/70 pl-3 sm:pl-5">
                {items.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setSelected(appointment)}
                    className="group relative w-full overflow-hidden rounded-3xl border border-line bg-white/85 p-3.5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-rose/30 hover:shadow-lift sm:p-4"
                  >
                    <span
                      className="absolute inset-y-3 left-0 w-[3px] rounded-full"
                      style={{ backgroundColor: appointment.service.color }}
                    />
                    <div className="flex items-start gap-3 pl-1.5">
                      <div className="w-[72px] shrink-0">
                        <p className="whitespace-nowrap text-[12px] font-bold text-ink">
                          {formatTime(appointment.start_at, timezone)}
                        </p>
                        <p className="whitespace-nowrap text-[10px] text-muted">
                          {formatTime(appointment.end_at, timezone)}
                        </p>
                        <p className="mt-0.5 text-[9.5px] text-muted/70">
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
                          <p className="truncate text-[14px] font-bold text-ink">
                            {appointment.client.name}
                          </p>
                          <StatusBadge status={appointment.status} />
                          {appointment.payment ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sage">
                              <Check size={11} /> Pagado
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted">
                          {appointment.service.name} · {appointment.staff.name}
                        </p>
                        {appointment.notes ? (
                          <p className="mt-1 truncate text-[10.5px] italic text-muted/70">
                            {appointment.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="money text-[13px] font-bold text-ink">
                          {money(appointment.price_cents)}
                        </p>
                        <p className="mt-1 text-[9.5px] uppercase tracking-wider text-muted/60">
                          {appointment.source === 'public' ? 'En línea' : appointment.source === 'whatsapp' ? 'WhatsApp' : 'Mostrador'}
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
