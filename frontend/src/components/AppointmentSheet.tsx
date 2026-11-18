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
  CreditCard,
  MessageCircle,
  Phone,
  Receipt,
  RotateCcw,
  Scissors,
  UserX,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePreferences } from '../lib/preferences'
import {
  addDaysKey,
  cn,
  dateKey,
  dayNumber,
  formatDateLong,
  formatDuration,
  formatTime,
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
  const { t } = usePreferences()
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
      toast(t('sheet.chargeRegistered', { amount: money(payment.total_cents) }))
      setMode('view')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('sheet.chargeError'))
    } finally {
      setPaying(false)
    }
  }

  async function submitReschedule() {
    if (!rescheduleSlot) {
      setError(t('sheet.pickNewTime'))
      return
    }
    if (rescheduleSlot === current!.start_at) {
      setError(t('sheet.sameTime'))
      return
    }
    setRescheduling(true)
    setError(null)
    try {
      await api.appointments.update(current!.id, { start_at: rescheduleSlot })
      await refresh()
      toast(t('sheet.moved'))
      setMode('view')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('sheet.moveError'))
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
      subtitle={t('sheet.timeRange', {
        date: formatDateLong(current.start_at, timezone),
        start: time,
        end: endTime,
      })}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-surface p-4">
          <Avatar name={current.client.name} color={current.staff.color} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/clientas/${current.client.id}`}
                className="truncate font-display text-xl font-medium text-licorice hover:underline"
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
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-licorice"
              >
                <Phone size={12} /> {phoneDisplay(current.client.phone)}
              </a>
              <button
                type="button"
                onClick={sendWhatsApp}
                disabled={busy === 'whatsapp'}
                className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-sage-soft px-3 text-[11px] font-bold text-sage-deep disabled:opacity-60"
              >
                {busy === 'whatsapp' ? <Spinner size={12} /> : <MessageCircle size={13} />}
                WhatsApp
              </button>
              <span className="money ml-auto font-display text-lg font-medium text-licorice">
                {money(current.price_cents)}
              </span>
            </div>
          </div>
        </div>

        {current.notes ? (
          <div className="rounded-2xl bg-sand/50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{t('sheet.notes')}</p>
            <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-licorice">{current.notes}</p>
          </div>
        ) : null}

        {current.payment ? (
          <div className="flex items-center gap-3 rounded-2xl border border-sage/20 bg-sage-soft/60 px-4 py-3">
            <CheckCircle2 size={19} className="shrink-0 text-sage" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold text-sage">
                {t('sheet.charged', { method: t(`method.${current.payment.method}`) })}
              </p>
              <p className="money text-[11.5px] text-muted">
                {money(current.payment.amount_cents)}{' '}
                {t('sheet.tipSuffix', { amount: money(current.payment.tip_cents) })}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => api.payments.downloadReceipt(current.payment!.id)}
            >
              <Receipt size={14} /> {t('sheet.receipt')}
            </Button>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-rose/20 bg-blush-soft px-3.5 py-2.5 text-[12.5px] font-medium text-blush-deep"
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
                    <Check size={16} /> {t('sheet.confirm')}
                  </Button>
                ) : (
                  <Button variant="rose" className="col-span-2" onClick={() => setMode('pay')}>
                    <Banknote size={17} /> {t('sheet.completeAndCharge')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setMode('reschedule')}>
                  <RotateCcw size={15} /> {t('sheet.reschedule')}
                </Button>
                <Button variant="secondary" onClick={sendWhatsApp} disabled={busy === 'whatsapp'}>
                  <MessageCircle size={15} /> {t('sheet.reminder')}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmAction('no_show')}>
                  <UserX size={15} /> {t('sheet.noShow')}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmAction('cancel')}>
                  {t('sheet.cancelAppointment')}
                </Button>
              </div>
            ) : current.status === 'completed' ? (
              <div className="grid grid-cols-2 gap-2">
                {!current.payment ? (
                  <Button variant="rose" className="col-span-2" onClick={() => setMode('pay')}>
                    <Banknote size={17} /> {t('sheet.registerPayment')}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={sendWhatsApp}>
                  <MessageCircle size={15} /> {t('sheet.thank')}
                </Button>
                <Link to={`/clientas/${current.client.id}`}>
                  <Button variant="ghost" className="w-full">
                    {t('sheet.viewRecord')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl bg-sand/40 px-4 py-3 text-center text-[12px] text-muted">
                {current.status === 'canceled' ? t('sheet.canceledMsg') : t('sheet.noShowMsg')}
                <div className="mt-2">
                  <Link to={`/clientas/${current.client.id}`} className="font-semibold text-rose">
                    {t('sheet.viewClientRecord')}
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : null}

        {mode === 'pay' ? (
          <div className="space-y-3 rounded-3xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blush-soft text-blush-deep">
                <Banknote size={16} />
              </span>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-licorice">{t('sheet.registerPayment')}</p>
                <p className="text-[11px] text-muted">{t('sheet.vatIncluded')}</p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-muted"
                onClick={() => setMode('view')}
              >
                {t('sheet.close')}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('sheet.serviceAmount')}
                leading="$"
                inputMode="decimal"
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
              />
              <Input
                label={t('sheet.tip')}
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
                    'border-border bg-alabaster text-muted hover:border-rose/40 hover:text-licorice',
                  )}
                >
                  {percent === 0 ? t('sheet.noTip') : `${percent}%`}
                </button>
              ))}
            </div>

            <Field label={t('sheet.paymentMethod')}>
              <Segmented
                options={[
                  { value: 'cash', label: t('method.cash') },
                  { value: 'card', label: t('method.card') },
                  { value: 'transfer', label: t('sheet.transferShort') },
                  { value: 'other', label: t('method.other') },
                ]}
                value={payMethod}
                onChange={(value) => setPayMethod(value as PaymentMethod)}
                size="sm"
                className="w-full justify-between"
              />
            </Field>

            <Input
              label={t('sheet.reference')}
              placeholder={t('sheet.referencePlaceholder')}
              value={payReference}
              onChange={(event) => setPayReference(event.target.value)}
            />

            <div className="flex items-center justify-between rounded-2xl bg-licorice px-4 py-3 text-alabaster">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-alabaster/50">{t('sheet.totalToCharge')}</p>
                <p className="money font-display text-2xl font-medium">{money(totalCents)}</p>
              </div>
              <div className="text-right text-[10px] text-alabaster/60">
                <p>{t('sheet.service')} {money(amountCents)}</p>
                <p>{t('sheet.tip')} {money(tipCents)}</p>
              </div>
            </div>

            <Button variant="rose" className="w-full" loading={paying} onClick={submitPayment}>
              <CreditCard size={16} /> {t('sheet.registerPayment')}
            </Button>
          </div>
        ) : null}

        {mode === 'reschedule' ? (
          <div className="space-y-3 rounded-3xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sand text-licorice">
                <CalendarClock size={16} />
              </span>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-licorice">{t('sheet.moveTitle')}</p>
                <p className="text-[11px] text-muted">{t('sheet.moveSubtitle')}</p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-muted"
                onClick={() => setMode('view')}
              >
                {t('sheet.close')}
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
                      ? 'border-licorice bg-licorice text-alabaster'
                      : 'border-border bg-alabaster text-muted',
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
                        : 'border-border bg-alabaster text-licorice',
                    )}
                  >
                    {formatTime(slot.start_at, timezone)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-sand/50 px-3 py-4 text-center text-xs text-muted">
                {t('sheet.noSlots')}
              </p>
            )}
            <Button variant="rose" className="w-full" loading={rescheduling} onClick={submitReschedule}>
              <ArrowRight size={16} /> {t('sheet.saveNewTime')}
            </Button>
          </div>
        ) : null}

        {confirmAction ? (
          <div className="rounded-3xl border border-rose/25 bg-blush-soft/70 p-4">
            <p className="text-[13px] font-bold text-blush-deep">
              {confirmAction === 'cancel' ? t('sheet.cancelQuestion') : t('sheet.noShowQuestion')}
            </p>
            <p className="mt-1 text-[11.5px] text-blush-deep/80">
              {confirmAction === 'cancel' ? t('sheet.cancelBody') : t('sheet.noShowBody')}
            </p>
            <div className="mt-3">
              <Input
                label={t('sheet.reason')}
                placeholder={t('sheet.reasonPlaceholder')}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmAction(null)}>
                {t('sheet.betterNot')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={busy === 'canceled' || busy === 'no_show'}
                onClick={() =>
                  changeStatus(confirmAction === 'cancel' ? 'canceled' : 'no_show', reason || undefined)
                }
              >
                {confirmAction === 'cancel' ? t('sheet.yesCancel') : t('sheet.yesNoShow')}
              </Button>
            </div>
          </div>
        ) : null}

        <p className="text-center text-[10px] text-muted/60">
          {t('sheet.code', { code: current.confirmation_code })}
        </p>
      </div>
    </Modal>
  )
}
