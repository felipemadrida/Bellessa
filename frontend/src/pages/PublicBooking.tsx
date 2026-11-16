import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Scissors,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import {
  addDaysKey,
  cn,
  dayNumber,
  formatDuration,
  formatTime,
  money,
  monthShort,
  parseKey,
  todayKey,
  weekdayShort,
} from '../lib/format'
import type {
  AvailabilitySlot,
  PublicBookingResponse,
  PublicBusiness,
} from '../lib/types'
import { BrandMark, Wordmark } from '../components/AppShell'
import {
  Avatar,
  Button,
  EmptyState,
  Input,
  Skeleton,
  Spinner,
  Textarea,
} from '../components/ui'

const STEP_LABELS = ['Servicio', 'Horario', 'Tus datos']

export function PublicBookingPage() {
  const { slug } = useParams()
  const queryClient = useQueryClient()

  const businessQuery = useQuery({
    queryKey: ['public-business', slug],
    queryFn: () => api.public.business(slug!),
    enabled: !!slug,
    retry: false,
  })
  const business = businessQuery.data

  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [staffId, setStaffId] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [marketing, setMarketing] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<PublicBookingResponse | null>(null)

  const timezone = business?.timezone ?? 'America/Mexico_City'
  const today = todayKey(timezone)

  useEffect(() => {
    if (business && !date) setDate(today)
  }, [business, date, today])

  useEffect(() => {
    if (step === 0) setSlot(null)
  }, [serviceId, staffId, step])

  const selectedService = business?.services.find((service) => service.id === serviceId) ?? null

  const availabilityQuery = useQuery({
    queryKey: ['public-availability', slug, serviceId, staffId, date],
    queryFn: () => api.public.availability(slug!, serviceId!, date, staffId ?? undefined),
    enabled: !!slug && !!serviceId && !!date && step === 1,
  })

  const dateOptions = useMemo(
    () => Array.from({ length: 21 }, (_, index) => addDaysKey(today, index)),
    [today],
  )

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>()
    for (const item of availabilityQuery.data?.slots ?? []) {
      const label = formatTime(item.start_at, timezone)
      const list = map.get(label) ?? []
      list.push(item)
      map.set(label, list)
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  }, [availabilityQuery.data, timezone])

  if (businessQuery.isLoading) {
    return (
      <div className="min-h-dvh bg-cream px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-44 rounded-4xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      </div>
    )
  }

  if (businessQuery.isError || !business) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
        <BrandMark size={46} />
        <h1 className="mt-6 font-display text-3xl font-medium text-ink">No encontramos este salón</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Revisa que el link esté completo o pide a tu salón que te comparta su página de reservas.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-2xl bg-ink px-5 text-sm font-semibold text-cream"
        >
          Ir a Bellessa
        </a>
      </div>
    )
  }

  const openHour = business.hours.find(
    (hour) => hour.weekday === (parseKey(today).getUTCDay() + 6) % 7,
  )

  function chooseService(id: number) {
    setServiceId(id)
    setSlot(null)
    setError(null)
  }

  function goNext() {
    setError(null)
    if (step === 0 && !serviceId) {
      setError('Elige el servicio que quieres reservar.')
      return
    }
    if (step === 1 && !slot) {
      setError('Elige un horario disponible.')
      return
    }
    setStep((value) => Math.min(2, value + 1))
  }

  function goBack() {
    setError(null)
    setStep((value) => Math.max(0, value - 1))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!slot || !selectedService) return
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Escribe un WhatsApp a 10 dígitos para confirmarte.')
      return
    }
    setBooking(true)
    setError(null)
    try {
      const response = await api.public.book(slug!, {
        service_id: selectedService.id,
        staff_id: slot.staff_id,
        start_at: slot.start_utc,
        name: name.trim(),
        phone,
        email: email.trim() || null,
        notes: notes.trim() || null,
        accepts_marketing: marketing,
      })
      setConfirmation(response)
      setStep(3)
      queryClient.invalidateQueries({ queryKey: ['public-availability'] })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos apartar tu cita.')
    } finally {
      setBooking(false)
    }
  }

  function reset() {
    setConfirmation(null)
    setStep(0)
    setServiceId(null)
    setStaffId(null)
    setSlot(null)
    setName('')
    setPhone('')
    setEmail('')
    setNotes('')
    setError(null)
  }

  function addToCalendar(response: PublicBookingResponse) {
    const appointment = response.appointment
    const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const location = [business!.address, business!.neighborhood, business!.city].filter(Boolean).join(', ')
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bellessa//Reservas//MX',
      'BEGIN:VEVENT',
      `UID:${appointment.confirmation_code}@bellessa.mx`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(appointment.start_at)}`,
      `DTEND:${stamp(appointment.end_at)}`,
      `SUMMARY:${appointment.service.name} en ${business!.name}`,
      `LOCATION:${location}`,
      `DESCRIPTION:Cita con ${appointment.staff.name}. Código ${appointment.confirmation_code}.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ]
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `cita-${appointment.confirmation_code}.ics`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-cream">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <BrandMark size={36} />
          <div className="leading-none">
            <Wordmark className="text-[20px]" />
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">
              Reservas en línea
            </p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-semibold text-muted sm:flex">
          <Sparkles size={12} className="text-gold" /> Hecho en México
        </span>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        {/* Hero del salón */}
        <section className="relative overflow-hidden rounded-4xl bg-sage px-5 py-7 text-cream shadow-lift sm:px-8 sm:py-9">
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-60 blur-2xl"
            style={{ background: 'radial-gradient(circle, #D9A44166, transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full opacity-40 blur-2xl"
            style={{ background: 'radial-gradient(circle, #C2415A77, transparent 70%)' }}
          />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/50">
              Bienvenida a
            </p>
            <h1 className="mt-2 font-display text-[40px] font-normal leading-[0.98] tracking-[-0.03em] sm:text-[54px]">
              {business.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-cream/70">
              {business.address ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} className="text-gold" />
                  {business.address}
                  {business.neighborhood ? `, ${business.neighborhood}` : ''}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={13} className="text-gold" />
                {openHour && !openHour.closed
                  ? `Hoy ${minutesLabel(openHour.open_minute)} – ${minutesLabel(openHour.close_minute)}`
                  : 'Hoy cerrado'}
              </span>
              {business.instagram ? (
                <span className="inline-flex items-center gap-1.5">
                  <Instagram size={13} className="text-gold" /> {business.instagram}
                </span>
              ) : null}
            </div>
            <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-cream/70">
              Elige tu servicio, tu horario y listo. Nosotras confirmamos por WhatsApp y te esperamos
              con todo listo.
            </p>
          </div>
        </section>

        {step < 3 ? (
          <>
            {/* Progreso */}
            <div className="mx-auto mt-6 flex max-w-xl items-center gap-2 px-2">
              {STEP_LABELS.map((label, index) => (
                <div key={label} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      index < step
                        ? 'bg-sage text-white'
                        : index === step
                          ? 'bg-ink text-cream'
                          : 'bg-sand text-muted',
                    )}
                  >
                    {index < step ? <Check size={13} /> : index + 1}
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-semibold',
                      index === step ? 'text-ink' : 'text-muted',
                    )}
                  >
                    {label}
                  </span>
                  {index < STEP_LABELS.length - 1 ? <span className="h-px flex-1 bg-line" /> : null}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-4xl border border-line bg-white/80 p-4 shadow-soft sm:p-6">
              {step === 0 ? (
                <div className="animate-fade-up">
                  <h2 className="font-display text-2xl font-medium text-ink">¿Qué te vas a hacer?</h2>
                  <p className="mt-1 text-[12.5px] text-muted">
                    Elige el servicio. Los precios ya incluyen IVA.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {business.services.map((service) => {
                      const active = serviceId === service.id
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => chooseService(service.id)}
                          aria-pressed={active}
                          className={cn(
                            'flex items-center gap-3 rounded-2xl border p-3.5 text-left transition',
                            active
                              ? 'border-rose bg-rose-soft/60 shadow-soft'
                              : 'border-line bg-white hover:border-rose/30',
                          )}
                        >
                          <span
                            className="h-10 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: service.color }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-bold text-ink">{service.name}</p>
                            <p className="text-[11px] text-muted">
                              {formatDuration(service.duration_min)} · {money(service.price_cents)}
                            </p>
                          </div>
                          {active ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose text-white">
                              <Check size={13} />
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                  {business.services.length === 0 ? (
                    <EmptyState
                      icon={<Scissors size={20} />}
                      title="Sin servicios disponibles"
                      description="Este salón todavía no abrió su menú en línea."
                      className="py-8"
                    />
                  ) : null}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="animate-fade-up space-y-5">
                  <div>
                    <h2 className="font-display text-2xl font-medium text-ink">¿Con quién y cuándo?</h2>
                    <p className="mt-1 text-[12.5px] text-muted">
                      {selectedService?.name} · {formatDuration(selectedService?.duration_min ?? 0)}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-[12px] font-semibold text-ink">Profesional</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStaffId(null)
                          setSlot(null)
                        }}
                        className={cn(
                          'flex h-10 items-center gap-2 rounded-full border px-3 text-[11.5px] font-semibold transition',
                          staffId === null
                            ? 'border-ink bg-ink text-cream'
                            : 'border-line bg-white text-muted',
                        )}
                      >
                        <Sparkles size={13} /> Cualquiera disponible
                      </button>
                      {business.staff.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            setStaffId(member.id)
                            setSlot(null)
                          }}
                          className={cn(
                            'flex h-10 items-center gap-1.5 rounded-full border pl-1 pr-3 text-[11.5px] font-semibold transition',
                            staffId === member.id
                              ? 'border-ink bg-white text-ink shadow-soft'
                              : 'border-line bg-white text-muted',
                          )}
                        >
                          <Avatar name={member.name} color={member.color} size="xs" />
                          {member.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-ink">Fecha</p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label="Semana anterior"
                          onClick={() =>
                            setDate((current) => {
                              const next = addDaysKey(current, -7)
                              return next < today ? today : next
                            })
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-muted"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Semana siguiente"
                          onClick={() => setDate((current) => addDaysKey(current, 7))}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-muted"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                      {dateOptions.map((option) => {
                        const active = option === date
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setDate(option)
                              setSlot(null)
                            }}
                            aria-pressed={active}
                            className={cn(
                              'flex h-[66px] w-[56px] shrink-0 flex-col items-center justify-center rounded-2xl border transition',
                              active
                                ? 'border-ink bg-ink text-cream'
                                : 'border-line bg-white text-muted',
                            )}
                          >
                            <span className="text-[9px] font-bold uppercase tracking-wider">
                              {weekdayShort(option)}
                            </span>
                            <span className="font-display text-xl font-medium leading-none">
                              {dayNumber(option)}
                            </span>
                            <span className="text-[9px]">{monthShort(option)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-ink">Horarios disponibles</p>
                      {availabilityQuery.isFetching ? (
                        <Spinner size={13} className="text-rose" />
                      ) : null}
                    </div>
                    {availabilityQuery.isLoading ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {Array.from({ length: 8 }, (_, index) => (
                          <Skeleton key={index} className="h-10" />
                        ))}
                      </div>
                    ) : groupedSlots.length ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {groupedSlots.map((group) => {
                          const active = slot?.start_utc === group.items[0].start_utc
                          return (
                            <button
                              key={group.label}
                              type="button"
                              onClick={() => setSlot(group.items[0])}
                              aria-pressed={active}
                              className={cn(
                                'flex h-10 flex-col items-center justify-center rounded-xl border text-[11.5px] font-semibold transition',
                                active
                                  ? 'border-rose bg-rose text-white'
                                  : 'border-line bg-white text-ink hover:border-rose/40',
                              )}
                            >
                              {group.label}
                              {group.items.length > 1 ? (
                                <span
                                  className={cn(
                                    'text-[8.5px]',
                                    active ? 'text-white/70' : 'text-muted',
                                  )}
                                >
                                  {group.items.length} disponibles
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<CalendarDays size={20} />}
                        title="No hay horarios ese día"
                        description="Prueba con otra fecha o elige a otra profesional."
                        className="rounded-2xl bg-sand/40 py-7"
                      />
                    )}
                  </div>

                  {slot ? (
                    <div className="rounded-2xl border border-rose/15 bg-rose-soft/50 px-4 py-3 text-[12px]">
                      <p className="font-semibold text-rose-deep">
                        {weekdayShort(date)} {dayNumber(date)} · {formatTime(slot.start_at, timezone)}
                      </p>
                      <p className="mt-0.5 text-muted">
                        {selectedService?.name} con {slot.staff_name} · {money(selectedService?.price_cents ?? 0)}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 2 ? (
                <form onSubmit={submit} className="animate-fade-up space-y-4">
                  <div>
                    <h2 className="font-display text-2xl font-medium text-ink">Tus datos</h2>
                    <p className="mt-1 text-[12.5px] text-muted">
                      Te mandamos la confirmación por WhatsApp.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Nombre completo"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ej. Ana Sofía Martínez"
                      autoComplete="name"
                      required
                    />
                    <Input
                      label="WhatsApp"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="55 1234 5678"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <Input
                    label="Correo (opcional)"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tucorreo@ejemplo.mx"
                    autoComplete="email"
                  />
                  <Textarea
                    label="¿Algo que debamos saber? (opcional)"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Alergias, referencia de color, primera visita…"
                  />
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-line bg-white px-3.5 py-3">
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(event) => setMarketing(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#C2415A]"
                    />
                    <span className="text-[11.5px] leading-snug text-muted">
                      Quiero recibir recordatorios y promociones de {business.name}.
                    </span>
                  </label>

                  {selectedService && slot ? (
                    <div className="rounded-3xl border border-line bg-cream px-4 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                        Tu reserva
                      </p>
                      <div className="mt-2 space-y-1.5 text-[12px]">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted">Servicio</span>
                          <span className="text-right font-semibold text-ink">{selectedService.name}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted">Cuándo</span>
                          <span className="text-right font-semibold text-ink">
                            {weekdayShort(date)} {dayNumber(date)} ·{' '}
                            {formatTime(slot.start_at, timezone)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted">Profesional</span>
                          <span className="text-right font-semibold text-ink">{slot.staff_name}</span>
                        </div>
                        <div className="flex justify-between gap-3 border-t border-line/60 pt-2">
                          <span className="font-semibold text-ink">Total</span>
                          <span className="money font-display text-lg font-medium text-ink">
                            {money(selectedService.price_cents)}
                          </span>
                        </div>
                      </div>
                      {business.require_deposit ? (
                        <p className="mt-2 rounded-xl bg-gold-soft px-3 py-2 text-[10.5px] text-[#7A5A18]">
                          Para apartar se sugiere un anticipo de{' '}
                          {money((selectedService.price_cents * business.deposit_percent) / 100)}. El
                          salón te contactará por WhatsApp.
                        </p>
                      ) : null}
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

                  <Button type="submit" variant="rose" size="lg" className="w-full" loading={booking}>
                    Apartar mi cita <ArrowRight size={17} />
                  </Button>
                  <p className="text-center text-[10px] text-muted">
                    Aún no se cobra nada. El salón confirmará tu cita por WhatsApp.
                  </p>
                </form>
              ) : null}

              {error && step < 2 ? (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-2xl border border-rose/20 bg-rose-soft px-3.5 py-2.5 text-[12.5px] font-medium text-rose-deep"
                >
                  <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
                </div>
              ) : null}

              {step < 2 ? (
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-line/60 pt-4">
                  <Button
                    variant="ghost"
                    onClick={step === 0 ? () => window.history.back() : goBack}
                  >
                    <ArrowLeft size={15} /> {step === 0 ? 'Salir' : 'Atrás'}
                  </Button>
                  <Button variant="rose" onClick={goNext} disabled={step === 0 ? !serviceId : !slot}>
                    Continuar <ArrowRight size={16} />
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex justify-start">
                  <Button variant="ghost" onClick={goBack} disabled={booking}>
                    <ArrowLeft size={15} /> Atrás
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : null}

        {step === 3 && confirmation ? (
          <section className="animate-fade-up mt-6">
            <div className="overflow-hidden rounded-4xl border border-line bg-white shadow-lift">
              <div className="relative bg-sage px-5 py-8 text-center text-cream sm:px-8">
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{ background: 'radial-gradient(circle at 50% 0%, #D9A44166, transparent 60%)' }}
                />
                <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream text-sage">
                  <Check size={30} strokeWidth={2.5} />
                </span>
                <h2 className="relative mt-4 font-display text-[34px] font-normal leading-tight tracking-[-0.02em]">
                  ¡Tu cita está apartada!
                </h2>
                <p className="relative mt-2 text-[13px] text-cream/70">
                  Código <span className="font-mono font-bold text-gold">{confirmation.confirmation_code}</span>
                </p>
              </div>

              <div className="px-5 py-6 sm:px-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl bg-cream p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      Tu servicio
                    </p>
                    <p className="mt-1 font-display text-xl font-medium text-ink">
                      {confirmation.appointment.service.name}
                    </p>
                    <p className="mt-1 text-[12px] text-muted">
                      con {confirmation.appointment.staff.name} ·{' '}
                      {formatDuration(confirmation.appointment.service.duration_min)}
                    </p>
                    <p className="money mt-3 font-display text-2xl font-medium text-ink">
                      {money(confirmation.appointment.price_cents)}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-cream p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      Cuándo y dónde
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] font-bold text-ink">
                      <CalendarDays size={15} className="text-rose" />
                      {weekdayShort(dateKeyOf(confirmation.appointment.start_at, timezone))}{' '}
                      {dayNumber(dateKeyOf(confirmation.appointment.start_at, timezone))} ·{' '}
                      {formatTime(confirmation.appointment.start_at, timezone)}
                    </p>
                    <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-muted">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-rose" />
                      {[business.address, business.neighborhood, business.city]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
                      <Phone size={13} className="text-rose" /> {business.phone}
                    </p>
                  </div>
                </div>

                {confirmation.appointment.deposit_cents > 0 ? (
                  <div className="mt-4 rounded-2xl border border-gold/30 bg-gold-soft px-4 py-3 text-[11.5px] text-[#7A5A18]">
                    <p className="font-bold">
                      Anticipo sugerido: {money(confirmation.appointment.deposit_cents)}
                    </p>
                    <p className="mt-0.5">
                      El salón te contactará por WhatsApp para acordar el pago y dejar tu lugar fijo.
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <a href={confirmation.whatsapp_url} target="_blank" rel="noreferrer">
                    <Button variant="sage" className="w-full">
                      <MessageCircle size={17} /> Confirmar por WhatsApp
                    </Button>
                  </a>
                  <Button variant="secondary" onClick={() => addToCalendar(confirmation)}>
                    <Download size={16} /> Agregar al calendario
                  </Button>
                </div>

                <div className="mt-4 rounded-2xl bg-cream px-4 py-3 text-[11px] leading-relaxed text-muted">
                  <p className="flex items-center gap-1.5 font-semibold text-ink">
                    <UserRound size={13} className="text-sage" /> Guarda tu código
                  </p>
                  <p className="mt-1">
                    Si necesitas mover o cancelar tu cita, escribe al salón con tu código{' '}
                    <span className="font-mono font-bold text-ink">
                      {confirmation.confirmation_code}
                    </span>{' '}
                    y avísales con al menos {business.cancellation_hours} horas.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-4">
                  <button type="button" onClick={reset} className="text-[12px] font-semibold text-rose">
                    Reservar otra cita
                  </button>
                  <p className="text-[10px] text-muted">Te esperamos en {business.name} ✨</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="mt-8 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
            <BrandMark size={20} /> Agenda con Bellessa
          </div>
          <p className="max-w-md text-[10px] leading-relaxed text-muted/70">
            Reservas seguras · Precios en MXN con IVA incluido · Cancelación con{' '}
            {business.cancellation_hours} h de anticipación
          </p>
        </footer>
      </main>
    </div>
  )
}

function minutesLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function dateKeyOf(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
