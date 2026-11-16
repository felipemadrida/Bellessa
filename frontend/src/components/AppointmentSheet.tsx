import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  Download,
  MessageCircle,
  Phone,
  Receipt,
  RotateCcw,
  Scissors,
  UserX,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  addDaysKey,
  cn,
  dateKey,
  dayNumber,
  formatDateLong,
  formatDuration,
  formatTime,
  METHOD_LABEL,
  money,
  parseMoney,
  phoneDisplay,
  todayKey,
  weekdayShort,
} from '../lib/format'
import type { Appointment, AppointmentStatus, PaymentMethod } from '../lib/types'
import { useToast } from './Toast'
import {
  Avatar,
  Button,
  Field,
  Input,
  Modal,
  Segmented,
  Spinner,
  StatusBadge,
  Textarea,
} from './ui'

interface Props {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

type Mode = 'view' | 'pay' | 'reschedule'
type ConfirmAction = 'cancel' | 'no_show' | null

export function AppointmentSheet({ appointment, open, onClose, onChanged }: Props) {
  const { business } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['appointment', appointment?.id],
    queryFn: () => api.appointments.get(appointment!.id),
    enabled: open && !!appointment?.id,
  })
  const current: Appointment | undefined = detailQuery.data ?? appointment ?? undefined
  const timezone = business?.timezone ?? 'America/Mexico_City'

  const [mode, setMode] = useState<Mode>('view')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [payAmount, setPayAmount] = useState('')
  const [payTip, setPayTip] = useState('0')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payReference, setPayReference] = useState('')
  const [paying, setPaying] = useState(false)

  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('view')
    setConfirmAction(null)
    setReason('')
    setError(null)
    setBusy(null)
    setPaying(false)
    setRescheduling(false)
    setRescheduleSlot(null)
    if (appointment) {
      setPayAmount((appointment.price_cents / 100).toFixed(0))
      setRescheduleDate(dateKey(appointment.start_at, timezone))
    }
  }, [open, appointment?.id])

  useEffect(() => {
    if (!current) return
    setPayAmount((current.price_cents / 100).toFixed(0))
  }, [current?.id, current?.price_cents])

  const availability = useQuery({
    queryKey: ['reschedule-availability', current?.id, rescheduleDate],
    queryFn: () => api.appointments.availability(current!.service.id, rescheduleDate, current!.staff.id),
    enabled: open && mode === 'reschedule' && !!current && !!rescheduleDate,
  })

  const timeSlots = useMemo(() => {
    return (availability.data?.slots ?? []).slice(0, 80)
  }, [availability.data])

  if (!current) return null

  const time = formatTime(current.start_at, timezone)
  const endTime = formatTime(current.end_at, timezone)
  const isActive = current.status === 'pending' || current.status === 'confirmed'
  const tipCents = parseMoney(payTip || '0')
  const amountCents = parseMoney(payAmount || '0')
  const totalCents = amountCents + tipCents

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['agenda'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['appointment', current!.id] }),
      queryClient.invalidateQueries({ queryKey: ['client', current!.client.id] }),
      queryClient.invalidateQueries({ queryKey: ['clients'] }),
      queryClient.invalidateQueries({ queryKey: ['cash'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ])
    onChanged?.()
  }

  async function changeStatus(status: AppointmentStatus, note?: string) {
    setBusy(status)
    setError(null)
    try {
      await api.appointments.setStatus(current!.id, status, note)
      await refresh()
      toast(
        status === 'confirmed'
          ? 'Cita confirmada'
          : status === 'canceled'
            ? 'Cita cancelada'
            : status === 'no_show'
              ? 'Registrada como no asistió'
              : 'Cita completada',
        status === 'canceled' || status === 'no_show' ? 'info' : 'success',
      )
      setConfirmAction(null)
      setReason('')
      if (status === 'canceled' || status === 'no_show') onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos actualizar la cita.')
    } finally {
      setBusy(null)
    }
  }

  async function sendWhatsApp() {
    setBusy('whatsapp')
    setError(null)
    const template = current!.status === 'completed' ? 'gracias' : 'recordatorio'
    const popup = window.open('', '_blank')
    try {
      const data = await api.appointments.whatsapp(current!.id, template)
      if (popup) {
        popup.opener = null
        popup.location.href = data.url
      } else {
        window.location.href = data.url
      }
    } catch (caught) {
      popup?.close()
      setError(caught instanceof ApiError ? caught.message : 'No pudimos abrir WhatsApp.')
    } finally {
      setBusy(null)
    }
  }

  async function submitPayment() {
    if (!amountCents && !tipCents) {
      setError('Escribe el monto cobrado.')
      return
    }
    setPaying(true)
    setError(null)
    try {
      const payment = await api.payments.create({
        appointment_id: current!.id,
        amount_cents: amountCents,
        tip_cents: tipCents,
        method: payMethod,
        reference: payReference.trim() || null,
      })
      await refresh()
      toast(`Cobro registrado por ${money(payment.total_cents)}`)
      setMode('view')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos registrar el cobro.')
    } finally {
      setPaying(false)
    }
  }

  async function submitReschedule() {
    if (!rescheduleSlot) {
      setError('Elige el nuevo horario.')
      return
    }
    if (rescheduleSlot === current!.start_at) {
      setError('Ese es el mismo horario actual.')
      return
    }
    setRescheduling(true)
    setError(null)
    try {
      await api.appointments.update(current!.id, { start_at: rescheduleSlot })
      await refresh()
      toast('Cita movida de horario')
      setMode('view')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos mover la cita.')
    } finally {
      setRescheduling(false)
    }
  }

  const title = `${current.client.name.split(' ')[0]} · ${time}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={`${formatDateLong(current.start_at, timezone)} · ${time} a ${endTime}`}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-3xl border border-line bg-white p-4">
          <Avatar name={current.client.name} color={current.staff.color} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/clientas/${current.client.id}`}
                className="truncate font-display text-xl font-medium text-ink hover:underline"
              >
                {current.client.name}
              </Link>
              <StatusBadge status={current.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1">
                <Scissors size={12} /> {current.service.name}
              </span>
              <span>·</span>
              <span>{current.staff.name}</span>
              <span>·</span>
              <span>{formatDuration(current.service.duration_min)}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={`tel:${current.client.phone}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[11px] font-semibold text-ink"
              >
                <Phone size={12} /> {phoneDisplay(current.client.phone)}
              </a>
              <button
                type="button"
                onClick={sendWhatsApp}
                disabled={busy === 'whatsapp'}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#E7F3E9] px-3 text-[11px] font-bold text-[#2E6B3A] disabled:opacity-60"
              >
                {busy === 'whatsapp' ? <Spinner size={12} /> : <MessageCircle size={13} />}
                WhatsApp
              </button>
              <span className="money ml-auto font-display text-lg font-medium text-ink">
                {money(current.price_cents)}
              </span>
            </div>
          </div>
        </div>

        {current.notes ? (
          <div className="rounded-2xl bg-sand/50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Notas</p>
            <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-ink">{current.notes}</p>
          </div>
        ) : null}

        {current.payment ? (
          <div className="flex items-center gap-3 rounded-2xl border border-sage/20 bg-sage-soft/60 px-4 py-3">
            <CheckCircle2 size={19} className="shrink-0 text-sage" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold text-sage">Cobrado · {METHOD_LABEL[current.payment.method]}</p>
              <p className="money text-[11.5px] text-muted">
                {money(current.payment.amount_cents)} + {money(current.payment.tip_cents)} propina
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => api.payments.downloadReceipt(current.payment!.id)}
            >
              <Receipt size={14} /> Recibo
            </Button>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-rose/20 bg-rose-soft px-3.5 py-2.5 text-[12.5px] font-medium text-rose-deep"
          >
            <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        ) : null}

        {mode === 'view' ? (
          <>
            {isActive ? (
              <div className="grid grid-cols-2 gap-2">
                {current.status === 'pending' ? (
                  <Button
                    variant="sage"
                    className="col-span-2"
                    loading={busy === 'confirmed'}
                    onClick={() => changeStatus('confirmed')}
                  >
                    <Check size={16} /> Confirmar cita
                  </Button>
                ) : (
                  <Button variant="rose" className="col-span-2" onClick={() => setMode('pay')}>
                    <Banknote size={17} /> Completar y cobrar
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setMode('reschedule')}>
                  <RotateCcw size={15} /> Reagendar
                </Button>
                <Button variant="secondary" onClick={sendWhatsApp} disabled={busy === 'whatsapp'}>
                  <MessageCircle size={15} /> Recordatorio
                </Button>
                <Button variant="ghost" onClick={() => setConfirmAction('no_show')}>
                  <UserX size={15} /> No asistió
                </Button>
                <Button variant="ghost" onClick={() => setConfirmAction('cancel')}>
                  Cancelar cita
                </Button>
              </div>
            ) : current.status === 'completed' ? (
              <div className="grid grid-cols-2 gap-2">
                {!current.payment ? (
                  <Button variant="rose" className="col-span-2" onClick={() => setMode('pay')}>
                    <Banknote size={17} /> Registrar cobro
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={sendWhatsApp}>
                  <MessageCircle size={15} /> Agradecer
                </Button>
                <Link to={`/clientas/${current.client.id}`}>
                  <Button variant="ghost" className="w-full">
                    Ver ficha
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl bg-sand/40 px-4 py-3 text-center text-[12px] text-muted">
                Esta cita está {current.status === 'canceled' ? 'cancelada' : 'marcada como no asistió'}.
                <div className="mt-2">
                  <Link to={`/clientas/${current.client.id}`} className="font-semibold text-rose">
                    Ver ficha de la clienta
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : null}

        {mode === 'pay' ? (
          <div className="space-y-3 rounded-3xl border border-line bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-soft text-rose-deep">
                <Banknote size={16} />
              </span>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-ink">Registrar cobro</p>
                <p className="text-[11px] text-muted">El IVA ya está incluido en el precio.</p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-muted"
                onClick={() => setMode('view')}
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Monto del servicio"
                leading="$"
                inputMode="decimal"
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
              />
              <Input
                label="Propina"
                leading="$"
                inputMode="decimal"
                value={payTip}
                onChange={(event) => setPayTip(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[0, 10, 15, 20].map((percent) => (
                <button
                  key={percent}
                  type="button"
                  onClick={() =>
                    setPayTip(((current.price_cents * percent) / 10000).toFixed(percent ? 2 : 0))
                  }
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                    'border-line bg-cream text-muted hover:border-rose/40 hover:text-ink',
                  )}
                >
                  {percent === 0 ? 'Sin propina' : `${percent}%`}
                </button>
              ))}
            </div>

            <Field label="Forma de pago">
              <Segmented
                options={[
                  { value: 'cash', label: 'Efectivo' },
                  { value: 'card', label: 'Tarjeta' },
                  { value: 'transfer', label: 'Transfer.' },
                  { value: 'other', label: 'Otro' },
                ]}
                value={payMethod}
                onChange={(value) => setPayMethod(value as PaymentMethod)}
                size="sm"
                className="w-full justify-between"
              />
            </Field>

            <Input
              label="Referencia (opcional)"
              placeholder="Clip, terminal, últimos 4…"
              value={payReference}
              onChange={(event) => setPayReference(event.target.value)}
            />

            <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-cream">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-cream/50">Total a cobrar</p>
                <p className="money font-display text-2xl font-medium">{money(totalCents)}</p>
              </div>
              <div className="text-right text-[10px] text-cream/60">
                <p>Servicio {money(amountCents)}</p>
                <p>Propina {money(tipCents)}</p>
              </div>
            </div>

            <Button variant="rose" className="w-full" loading={paying} onClick={submitPayment}>
              <CreditCard size={16} /> Registrar cobro
            </Button>
          </div>
        ) : null}

        {mode === 'reschedule' ? (
          <div className="space-y-3 rounded-3xl border border-line bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sand text-ink">
                <CalendarClock size={16} />
              </span>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-ink">Mover la cita</p>
                <p className="text-[11px] text-muted">Mismo servicio y profesional.</p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-muted"
                onClick={() => setMode('view')}
              >
                Cerrar
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: 10 }, (_, index) =>
                addDaysKey(todayKey(timezone), index),
              ).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setRescheduleDate(option)
                    setRescheduleSlot(null)
                  }}
                  className={cn(
                    'flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border text-[11px] transition',
                    option === rescheduleDate
                      ? 'border-ink bg-ink text-cream'
                      : 'border-line bg-cream text-muted',
                  )}
                >
                  <span className="text-[9px] font-bold uppercase">{weekdayShort(option)}</span>
                  <span className="font-display text-lg leading-none">{dayNumber(option)}</span>
                </button>
              ))}
            </div>
            {availability.isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted">
                <Spinner />
              </div>
            ) : timeSlots.length ? (
              <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.start_utc}
                    type="button"
                    onClick={() => setRescheduleSlot(slot.start_utc)}
                    className={cn(
                      'h-9 rounded-lg border text-[11px] font-semibold',
                      slot.start_utc === rescheduleSlot
                        ? 'border-rose bg-rose text-white'
                        : 'border-line bg-cream text-ink',
                    )}
                  >
                    {formatTime(slot.start_at, timezone)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-sand/50 px-3 py-4 text-center text-xs text-muted">
                Sin horarios disponibles ese día.
              </p>
            )}
            <Button variant="rose" className="w-full" loading={rescheduling} onClick={submitReschedule}>
              <ArrowRight size={16} /> Guardar nuevo horario
            </Button>
          </div>
        ) : null}

        {confirmAction ? (
          <div className="rounded-3xl border border-rose/25 bg-rose-soft/70 p-4">
            <p className="text-[13px] font-bold text-rose-deep">
              {confirmAction === 'cancel' ? '¿Cancelar esta cita?' : '¿Marcar como no asistió?'}
            </p>
            <p className="mt-1 text-[11.5px] text-rose-deep/80">
              {confirmAction === 'cancel'
                ? 'Se liberará el horario y la clienta ya no aparecerá en tu agenda.'
                : 'Contaremos la cita como perdida en tus reportes.'}
            </p>
            <div className="mt-3">
              <Input
                label="Motivo (opcional)"
                placeholder="Ej. Clienta canceló, se enfermó…"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmAction(null)}>
                Mejor no
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={busy === 'canceled' || busy === 'no_show'}
                onClick={() =>
                  changeStatus(confirmAction === 'cancel' ? 'canceled' : 'no_show', reason || undefined)
                }
              >
                {confirmAction === 'cancel' ? 'Sí, cancelar' : 'Sí, no asistió'}
              </Button>
            </div>
          </div>
        ) : null}

        <p className="text-center text-[10px] text-muted/60">
          Código de cita · {current.confirmation_code}
        </p>
      </div>
    </Modal>
  )
}
