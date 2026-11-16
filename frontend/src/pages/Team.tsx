import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  CalendarOff,
  CircleAlert,
  Clock3,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import { api, ApiError, type StaffInput } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  addDaysKey,
  cn,
  dateKey,
  dateLongFromKey,
  minutesToTime,
  timeToMinutes,
  todayKey,
} from '../lib/format'
import type { Staff, WorkingHour } from '../lib/types'
import { PageHeader } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  Spinner,
  Textarea,
} from '../components/ui'

const PALETTE = ['#C2415A', '#3E5C50', '#D9A441', '#D97757', '#8E5572', '#5C8374', '#7A4E3B', '#B56576']
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function TeamPage() {
  const { user, business } = useAuth()
  const isOwner = user?.role === 'owner'
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [hoursFor, setHoursFor] = useState<Staff | null>(null)
  const [timeOffFor, setTimeOffFor] = useState<Staff | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  const query = useQuery({ queryKey: ['staff-all'], queryFn: () => api.staff.list(true) })
  const staff = query.data ?? []

  async function toggleActive(member: Staff) {
    setToggling(member.id)
    try {
      await api.staff.update(member.id, { active: !member.active })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-all'] }),
        queryClient.invalidateQueries({ queryKey: ['staff'] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
      ])
      toast(member.active ? 'Profesional desactivada' : 'Profesional activa otra vez')
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos actualizar', 'error')
    } finally {
      setToggling(null)
    }
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Tu equipo"
        title="Equipo"
        subtitle={`${staff.filter((member) => member.active).length} personas activas · Su agenda, comisiones y horarios`}
        actions={
          isOwner ? (
            <Button variant="rose" onClick={openCreate}>
              <Plus size={17} /> Agregar al equipo
            </Button>
          ) : null
        }
      />

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-64 rounded-3xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <EmptyState
            icon={<CircleAlert size={22} />}
            title="No pudimos cargar el equipo"
            action={<Button onClick={() => query.refetch()}>Reintentar</Button>}
          />
        </Card>
      ) : staff.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserRound size={23} />}
            title="Tu equipo está vacío"
            description="Agrega a las personas que atienden en tu salón para asignar citas y comisiones."
            action={
              isOwner ? (
                <Button variant="rose" onClick={openCreate}>
                  <Plus size={16} /> Agregar persona
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((member) => (
            <Card
              key={member.id}
              className={cn('relative overflow-hidden p-5', !member.active && 'opacity-65')}
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: member.color }}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} color={member.color} size="lg" />
                  <div>
                    <p className="font-display text-lg font-medium leading-tight text-ink">
                      {member.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {member.role === 'owner' ? 'Dueña del salón' : 'Profesional'}
                      {!member.active ? ' · Inactiva' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isOwner ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(member)
                          setFormOpen(true)
                        }}
                        aria-label={`Editar a ${member.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                      {member.id !== user?.id ? (
                        <button
                          type="button"
                          onClick={() => toggleActive(member)}
                          disabled={toggling === member.id}
                          aria-label={member.active ? 'Desactivar' : 'Activar'}
                          className={cn(
                            'relative h-5 w-9 rounded-full transition',
                            member.active ? 'bg-sage' : 'bg-sand',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
                              member.active ? 'left-[18px]' : 'left-0.5',
                            )}
                          />
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              {member.bio ? (
                <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-muted">{member.bio}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-1.5">
                <Badge className="bg-sand text-muted">
                  <Sparkles size={11} /> {member.commission_bps ? `${member.commission_bps / 100}% comisión` : 'Sin comisión'}
                </Badge>
                <Badge className="bg-sand text-muted">
                  <Clock3 size={11} /> {hoursSummary(member.working_hours)}
                </Badge>
              </div>

              <div className="mt-4 border-t border-line/60 pt-3">
                <p className="truncate text-[11px] text-muted">{member.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {isOwner ? (
                    <Button size="sm" variant="secondary" onClick={() => setHoursFor(member)}>
                      <CalendarClock size={13} /> Horario
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setHoursFor(member)}>
                      Ver horario
                    </Button>
                  )}
                  {isOwner || member.id === user?.id ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setTimeOffFor(member)}
                    >
                      <CalendarOff size={13} /> Bloqueos
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <InfoCard
          title="Cada quien su horario"
          text="Ajusta los días y horas de cada profesional. La agenda solo ofrecerá horarios reales."
        />
        <InfoCard
          title="Comisiones claras"
          text="Configura el porcentaje de cada persona y revísalo en los reportes del periodo."
        />
        <InfoCard
          title="Acceso propio"
          text="Cada profesional puede entrar con su correo para ver su agenda, sin tocar la configuración."
        />
      </div>

      <StaffFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        member={editing}
        isOwner={isOwner}
        isSelf={editing?.id === user?.id}
      />
      <HoursModal open={!!hoursFor} onClose={() => setHoursFor(null)} member={hoursFor} isOwner={isOwner} />
      <TimeOffModal
        open={!!timeOffFor}
        onClose={() => setTimeOffFor(null)}
        member={timeOffFor}
        timezone={business?.timezone ?? 'America/Mexico_City'}
      />
    </div>
  )
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white/40 p-4">
      <p className="text-[12px] font-bold text-ink">{title}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{text}</p>
    </div>
  )
}

function hoursSummary(hours: WorkingHour[]): string {
  const open = hours.filter((hour) => !hour.closed).sort((a, b) => a.weekday - b.weekday)
  if (!open.length) return 'Sin horario'
  const signatures = new Set(open.map((hour) => `${hour.start_minute}-${hour.end_minute}`))
  if (signatures.size === 1) {
    const first = open[0]
    return `${open.map((hour) => WEEKDAYS_SHORT[hour.weekday]).join(' ')} ${minutesToTime(first.start_minute)}–${minutesToTime(first.end_minute)}`
  }
  return `${open.length} días con horario`
}

function StaffFormModal({
  open,
  onClose,
  member,
  isOwner,
  isSelf,
}: {
  open: boolean
  onClose: () => void
  member: Staff | null
  isOwner: boolean
  isSelf?: boolean
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [commission, setCommission] = useState('0')
  const [bio, setBio] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(member?.name ?? '')
    setEmail(member?.email ?? '')
    setPhone(member?.phone ?? '')
    setPassword('')
    setColor(member?.color ?? PALETTE[0])
    setCommission(String((member?.commission_bps ?? 0) / 100))
    setBio(member?.bio ?? '')
    setActive(member?.active ?? true)
    setError(null)
    setSaving(false)
  }, [open, member])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!member && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (member) {
        await api.staff.update(member.id, {
          name: name.trim(),
          phone: phone || undefined,
          color,
          commission_bps: Math.round(Number(commission || 0) * 100),
          bio: bio.trim() || null,
          active,
          ...(password ? { password } : {}),
        })
      } else {
        const payload: StaffInput = {
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone || null,
          color,
          commission_bps: Math.round(Number(commission || 0) * 100),
          bio: bio.trim() || null,
          role: 'staff',
        }
        await api.staff.create(payload)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-all'] }),
        queryClient.invalidateQueries({ queryKey: ['staff'] }),
      ])
      toast(member ? 'Equipo actualizado' : 'Persona agregada al equipo')
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? 'Editar persona' : 'Agregar al equipo'}
      subtitle={member ? 'Datos, comisión y acceso.' : 'Crea su acceso para que vea su agenda.'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="rose" type="submit" form="staff-form" loading={saving}>
            {member ? 'Guardar cambios' : 'Agregar persona'}
          </Button>
        </div>
      }
    >
      <form id="staff-form" onSubmit={submit} className="space-y-4">
        <Input
          label="Nombre completo"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Ximena Ríos"
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Correo de acceso"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ximena@salon.mx"
            disabled={!!member}
            required
          />
          <Input
            label="WhatsApp"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="55 1234 5678"
            inputMode="tel"
          />
        </div>
        <Input
          label={member ? 'Nueva contraseña (opcional)' : 'Contraseña'}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={member ? 'Solo si quieres cambiarla' : 'Mínimo 8 caracteres'}
          minLength={member ? undefined : 8}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink">Color en agenda</p>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`Color ${item}`}
                  onClick={() => setColor(item)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition',
                    color === item ? 'border-ink scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: item }}
                />
              ))}
            </div>
          </div>
          <Input
            label="Comisión (%)"
            type="number"
            min={0}
            max={100}
            step={1}
            value={commission}
            onChange={(event) => setCommission(event.target.value)}
            hint="Sobre el servicio, sin propina"
          />
        </div>
        <Textarea
          label="Especialidad (opcional)"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Color y balayage, uñas de gel…"
        />
        {member && isOwner && !isSelf ? (
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-ink">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-4 w-4 accent-[#C2415A]"
            />
            Puede recibir citas nuevas
          </label>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-rose/20 bg-rose-soft px-3.5 py-2.5 text-[12.5px] font-medium text-rose-deep"
          >
            <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        ) : null}
      </form>
    </Modal>
  )
}

function TimeOffModal({
  open,
  onClose,
  member,
  timezone,
}: {
  open: boolean
  onClose: () => void
  member: Staff | null
  timezone: string
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const today = todayKey(timezone)
  const tomorrow = addDaysKey(today, 1)
  const [startDate, setStartDate] = useState(tomorrow)
  const [endDate, setEndDate] = useState(tomorrow)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['time-off', member?.id],
    queryFn: () => api.staff.timeOff(member!.id),
    enabled: open && !!member,
  })
  const blocks = query.data ?? []

  useEffect(() => {
    if (!open) return
    setStartDate(addDaysKey(todayKey(timezone), 1))
    setEndDate(addDaysKey(todayKey(timezone), 1))
    setReason('')
    setError(null)
    setSaving(false)
    setDeleting(null)
  }, [open, member?.id, timezone])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!member) return
    if (endDate < startDate) {
      setError('La fecha final no puede ser anterior a la inicial.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.staff.createTimeOff(member.id, {
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['time-off', member.id] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
        queryClient.invalidateQueries({ queryKey: ['agenda'] }),
      ])
      toast('Agenda bloqueada. Ya no se ofrecerán esos horarios.')
      setReason('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos bloquear la agenda.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(blockId: number) {
    if (!member) return
    setDeleting(blockId)
    setError(null)
    try {
      await api.staff.deleteTimeOff(member.id, blockId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['time-off', member.id] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
        queryClient.invalidateQueries({ queryKey: ['agenda'] }),
      ])
      toast('Bloqueo eliminado')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos quitar el bloqueo.')
    } finally {
      setDeleting(null)
    }
  }

  function rangeLabel(block: { start_at: string; end_at: string }): string {
    const first = dateKey(block.start_at, timezone)
    const last = addDaysKey(dateKey(block.end_at, timezone), -1)
    return first === last
      ? dateLongFromKey(first)
      : `${dateLongFromKey(first)} — ${dateLongFromKey(last)}`
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Bloqueos de ${member?.name.split(' ')[0] ?? ''}`}
      subtitle="Días que no estarán disponibles para agendar."
      footer={
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-3 rounded-3xl border border-line bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Desde"
            type="date"
            min={today}
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value)
              if (endDate < event.target.value) setEndDate(event.target.value)
            }}
          />
          <Input
            label="Hasta"
            type="date"
            min={startDate}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <Input
          label="Motivo (opcional)"
          placeholder="Vacaciones, curso, día personal…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={160}
        />
        <p className="rounded-xl bg-gold-soft/70 px-3 py-2 text-[10.5px] leading-relaxed text-[#7A5A18]">
          Si hay citas pendientes o confirmadas en el rango, primero muévelas o cancélalas.
          La agenda dejará de ofrecer estos horarios automáticamente.
        </p>
        <div className="flex justify-end">
          <Button type="submit" variant="rose" size="sm" loading={saving}>
            <CalendarOff size={14} /> Bloquear días
          </Button>
        </div>
      </form>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          Próximos bloqueos
        </p>
        {query.isLoading ? (
          <div className="flex justify-center py-6 text-muted">
            <Spinner />
          </div>
        ) : blocks.length ? (
          <div className="space-y-2">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center gap-2 rounded-2xl border border-line bg-cream px-3 py-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sand text-muted">
                  <CalendarOff size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-ink">{rangeLabel(block)}</p>
                  <p className="truncate text-[10.5px] text-muted">
                    {block.reason || 'Día bloqueado'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(block.id)}
                  disabled={deleting === block.id}
                  aria-label="Quitar bloqueo"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-rose-soft hover:text-rose-deep disabled:opacity-40"
                >
                  {deleting === block.id ? <Spinner size={13} /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarOff size={19} />}
            title="Sin bloqueos próximos"
            description="La agenda está abierta según el horario habitual."
            className="rounded-2xl bg-sand/40 py-7"
          />
        )}
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-2xl border border-rose/20 bg-rose-soft px-3.5 py-2.5 text-[12.5px] font-medium text-rose-deep"
        >
          <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
        </div>
      ) : null}
    </Modal>
  )
}

function HoursModal({
  open,
  onClose,
  member,
  isOwner,
}: {
  open: boolean
  onClose: () => void
  member: Staff | null
  isOwner: boolean
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [rows, setRows] = useState<WorkingHour[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initial = useMemo(() => {
    return WEEKDAYS.map((_, weekday) => {
      const existing = member?.working_hours.find((hour) => hour.weekday === weekday)
      return (
        existing ?? {
          weekday,
          closed: weekday === 6,
          start_minute: 540,
          end_minute: 1140,
        }
      )
    })
  }, [member])

  useEffect(() => {
    if (!open) return
    setRows(initial.map((row) => ({ ...row })))
    setError(null)
    setSaving(false)
  }, [open, initial])

  function update(index: number, patch: Partial<WorkingHour>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    )
  }

  async function save() {
    if (!member) return
    for (const row of rows) {
      if (!row.closed && row.end_minute <= row.start_minute) {
        setError(`Revisa el horario del ${WEEKDAYS[row.weekday].toLowerCase()}.`)
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      await api.staff.updateHours(member.id, rows)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-all'] }),
        queryClient.invalidateQueries({ queryKey: ['staff'] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
      ])
      toast('Horario actualizado')
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar el horario.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Horario de ${member?.name.split(' ')[0] ?? ''}`}
      subtitle="Solo se ofrecerán citas dentro de estas horas."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
          {isOwner ? (
            <Button variant="rose" onClick={save} loading={saving}>
              Guardar horario
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.weekday}
            className={cn(
              'flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5 sm:flex-nowrap',
              row.closed ? 'border-line bg-sand/40' : 'border-line bg-white',
            )}
          >
            <span className="w-20 text-[12px] font-semibold text-ink">{WEEKDAYS[row.weekday]}</span>
            <label className="flex items-center gap-1.5 text-[11px] text-muted">
              <input
                type="checkbox"
                checked={!row.closed}
                disabled={!isOwner}
                onChange={(event) => update(index, { closed: !event.target.checked })}
                className="h-3.5 w-3.5 accent-[#C2415A]"
              />
              Abierto
            </label>
            <div className="ml-auto flex items-center gap-1.5">
              <input
                type="time"
                value={minutesToTime(row.start_minute)}
                disabled={row.closed || !isOwner}
                onChange={(event) => update(index, { start_minute: timeToMinutes(event.target.value) })}
                className="h-8 rounded-xl border border-line bg-cream px-2 text-[11px] text-ink disabled:opacity-40"
                aria-label={`Entrada ${WEEKDAYS[row.weekday]}`}
              />
              <span className="text-[10px] text-muted">a</span>
              <input
                type="time"
                value={minutesToTime(row.end_minute)}
                disabled={row.closed || !isOwner}
                onChange={(event) => update(index, { end_minute: timeToMinutes(event.target.value) })}
                className="h-8 rounded-xl border border-line bg-cream px-2 text-[11px] text-ink disabled:opacity-40"
                aria-label={`Salida ${WEEKDAYS[row.weekday]}`}
              />
            </div>
          </div>
        ))}
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-rose/20 bg-rose-soft px-3.5 py-2.5 text-[12.5px] font-medium text-rose-deep"
          >
            <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
