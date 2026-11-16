import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Search,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  addDaysKey,
  cn,
  dayNumber,
  formatDuration,
  formatTime,
  initials,
  money,
  monthShort,
  todayKey,
  weekdayShort,
} from '../lib/format'
import type { Appointment, AvailabilitySlot, Client, Service, Staff } from '../lib/types'
import { useToast } from './Toast'
import {
  Avatar,
  Button,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  Spinner,
  Textarea,
} from './ui'

interface Props {
  open: boolean
  onClose: () => void
  initialDate?: string
  initialStaffId?: number
  initialClient?: Client | null
  onCreated?: (appointment: Appointment) => void
}

const STEPS = ['Servicio', 'Horario', 'Clienta']

export function NewAppointmentModal({
  open,
  onClose,
  initialDate,
  initialStaffId,
  initialClient,
  onCreated,
}: Props) {
  const { business } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [staffId, setStaffId] = useState<number | null>(initialStaffId ?? null)
  const [date, setDate] = useState(initialDate ?? todayKey(business?.timezone ?? 'America/Mexico_City'))
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(initialClient ?? null)
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const timezone = business?.timezone ?? 'America/Mexico_City'
  const today = todayKey(timezone)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setServiceId(null)
    setStaffId(initialStaffId ?? null)
    setDate(initialDate ?? todayKey(business?.timezone ?? 'America/Mexico_City'))
    setSlot(null)
    setClientSearch('')
    setSelectedClient(initialClient ?? null)
    setCreatingClient(false)
    setNewClientName('')
    setNewClientPhone('')
    setNotes('')
    setError(null)
    setSaving(false)
  }, [open, initialDate, initialStaffId, initialClient, business?.timezone])

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: () => api.services.list(),
    enabled: open,
  })
  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.staff.list(),
    enabled: open,
  })
  const clientsQuery = useQuery({
    queryKey: ['clients-search', clientSearch],
    queryFn: () => api.clients.list(clientSearch || undefined),
    enabled: open && step === 2 && clientSearch.trim().length >= 2,
  })

  const availabilityQuery = useQuery({
    queryKey: ['availability', serviceId, staffId, date],
    queryFn: () => api.appointments.availability(serviceId!, date, staffId ?? undefined),
    enabled: open && !!serviceId && !!date && step === 1,
  })

  const services = servicesQuery.data ?? []
  const staff = staffQuery.data ?? []
  const selectedService = services.find((service) => service.id === serviceId) ?? null
  const selectedStaff = staff.find((member) => member.id === staffId) ?? null

  const dateOptions = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => addDaysKey(today, index))
  }, [today])

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

  function chooseService(service: Service) {
    setServiceId(service.id)
    setSlot(null)
    setError(null)
  }

  function chooseStaff(id: number | null) {
    setStaffId(id)
    setSlot(null)
  }

  function goNext() {
    setError(null)
    if (step === 0) {
      if (!serviceId) {
        setError('Elige el servicio que vas a realizar.')
        return
      }
      setStep(1)
      return
    }
    if (step === 1) {
      if (!slot) {
        setError('Elige un horario disponible.')
        return
      }
      setStep(2)
    }
  }

  function goBack() {
    setError(null)
    if (step === 0) onClose()
    else setStep((value) => value - 1)
  }

  async function submit() {
    if (!selectedService || !slot) return
    if (!selectedClient && !creatingClient) {
      setError('Elige una clienta o crea una nueva.')
      return
    }
    if (creatingClient && (!newClientName.trim() || newClientPhone.replace(/\D/g, '').length < 10)) {
      setError('Escribe el nombre y un WhatsApp a 10 dígitos.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let clientId = selectedClient?.id
      if (creatingClient) {
        const created = await api.clients.create({
          name: newClientName.trim(),
          phone: newClientPhone,
        })
        clientId = created.id
      }
      const appointment = await api.appointments.create({
        client_id: clientId!,
        service_id: selectedService.id,
        staff_id: slot.staff_id,
        start_at: slot.start_utc,
        notes: notes.trim() || null,
        status: 'confirmed',
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agenda'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['client'] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
      ])
      toast('Cita agendada. Ya puedes mandar el recordatorio.')
      onCreated?.(appointment)
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos crear la cita.')
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" onClick={goBack} disabled={saving}>
        <ArrowLeft size={16} />
        {step === 0 ? 'Cancelar' : 'Atrás'}
      </Button>
      <div className="flex-1" />
      {step < 2 ? (
        <Button variant="rose" onClick={goNext} disabled={saving}>
          Continuar <ArrowRight size={16} />
        </Button>
      ) : (
        <Button variant="rose" onClick={submit} loading={saving}>
          <Check size={17} /> Confirmar cita
        </Button>
      )}
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva cita"
      subtitle={selectedService ? `${selectedService.name} · ${formatDuration(selectedService.duration_min)}` : 'Agenda en tres pasos'}
      footer={footer}
      size="lg"
    >
      {/* Progreso */}
      <div className="mb-5 flex items-center gap-1.5">
        {STEPS.map((label, index) => (
          <div key={label} className="flex flex-1 items-center gap-1.5">
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition',
                index < step
                  ? 'bg-sage text-white'
                  : index === step
                    ? 'bg-ink text-cream'
                    : 'bg-sand text-muted',
              )}
            >
              {index < step ? <Check size={12} /> : index + 1}
            </div>
            <span
              className={cn(
                'text-[11px] font-semibold',
                index === step ? 'text-ink' : 'text-muted',
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 ? <span className="h-px flex-1 bg-line" /> : null}
          </div>
        ))}
      </div>

      {step === 0 ? (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">¿Qué servicio va a llevar?</p>
            {servicesQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-[74px]" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {services.map((service) => {
                  const active = serviceId === service.id
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => chooseService(service)}
                      aria-pressed={active}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                        active
                          ? 'border-rose bg-rose-soft/60 shadow-soft'
                          : 'border-line bg-white hover:border-rose/30',
                      )}
                    >
                      <span
                        className="h-9 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: service.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-ink">{service.name}</p>
                        <p className="text-[11px] text-muted">
                          {formatDuration(service.duration_min)} · {money(service.price_cents)}
                        </p>
                      </div>
                      {active ? <Check size={16} className="text-rose" /> : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">¿Quién la atiende?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => chooseStaff(null)}
                aria-pressed={staffId === null}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition',
                  staffId === null
                    ? 'border-ink bg-ink text-cream'
                    : 'border-line bg-white text-muted hover:border-rose/30',
                )}
              >
                <Sparkles size={14} /> Cualquiera disponible
              </button>
              {staff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => chooseStaff(member.id)}
                  aria-pressed={staffId === member.id}
                  className={cn(
                    'flex h-11 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition',
                    staffId === member.id
                      ? 'border-ink bg-ink text-cream'
                      : 'border-line bg-white text-muted hover:border-rose/30',
                  )}
                >
                  <Avatar name={member.name} color={member.color} size="xs" />
                  {member.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">Elige el día</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Días anteriores"
                  onClick={() =>
                    setDate((value) => {
                      const next = addDaysKey(value, -7)
                      return next < today ? today : next
                    })
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-muted"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Días siguientes"
                  onClick={() => setDate((value) => addDaysKey(value, 7))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-muted"
                >
                  <ChevronRight size={15} />
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
                      'flex h-[68px] w-[58px] shrink-0 flex-col items-center justify-center rounded-2xl border transition',
                      active
                        ? 'border-ink bg-ink text-cream'
                        : 'border-line bg-white text-muted hover:border-rose/30',
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      {weekdayShort(option)}
                    </span>
                    <span className="font-display text-xl font-medium leading-none">{dayNumber(option)}</span>
                    <span className="text-[9px]">{monthShort(option)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="flex-1 text-[13px] font-semibold text-ink">Horarios libres</p>
              {availabilityQuery.isFetching ? <Spinner size={14} className="text-rose" /> : null}
              <span className="text-[11px] text-muted">
                {selectedStaff ? `con ${selectedStaff.name.split(' ')[0]}` : 'cualquier profesional'}
              </span>
            </div>
            {availabilityQuery.isLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} className="h-11" />
                ))}
              </div>
            ) : groupedSlots.length ? (
              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                {groupedSlots.map((group) => {
                  const active = slot?.start_utc === group.items[0].start_utc
                  return (
                    <button
                      key={group.label}
                      type="button"
                      onClick={() => setSlot(group.items[0])}
                      aria-pressed={active}
                      className={cn(
                        'flex h-11 flex-col items-center justify-center rounded-xl border text-[12px] font-semibold transition',
                        active
                          ? 'border-rose bg-rose text-white'
                          : 'border-line bg-white text-ink hover:border-rose/40',
                      )}
                    >
                      {group.label}
                      {group.items.length > 1 ? (
                        <span className={cn('text-[9px] font-medium', active ? 'text-white/70' : 'text-muted')}>
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
                title="No hay horarios este día"
                description="Prueba otro día o cambia de profesional."
                className="rounded-2xl bg-sand/40 py-7"
              />
            )}
          </div>

          {selectedService && slot ? (
            <div className="rounded-2xl border border-rose/15 bg-rose-soft/50 px-4 py-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-semibold text-rose-deep">
                  <Clock3 size={14} />
                  {weekdayShort(date)} {dayNumber(date)} · {formatTime(slot.start_at, timezone)}
                </span>
                <span className="money font-bold text-ink">{money(selectedService.price_cents)}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                {selectedService.name} con {slot.staff_name}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">¿Para quién es la cita?</p>
            {selectedClient ? (
              <div className="flex items-center gap-3 rounded-2xl border border-sage/20 bg-sage-soft/50 p-3">
                <Avatar name={selectedClient.name} color="#3E5C50" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-ink">{selectedClient.name}</p>
                  <p className="text-[11.5px] text-muted">{selectedClient.phone}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClient(null)}
                >
                  Cambiar
                </Button>
              </div>
            ) : creatingClient ? (
              <div className="space-y-3 rounded-2xl border border-line bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold text-ink">Clienta nueva</p>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-rose"
                    onClick={() => setCreatingClient(false)}
                  >
                    Buscar existente
                  </button>
                </div>
                <Input
                  label="Nombre completo"
                  value={newClientName}
                  onChange={(event) => setNewClientName(event.target.value)}
                  placeholder="Ej. Fernanda Castillo"
                  autoFocus
                />
                <Input
                  label="WhatsApp"
                  value={newClientPhone}
                  onChange={(event) => setNewClientPhone(event.target.value)}
                  placeholder="55 1234 5678"
                  inputMode="tel"
                />
              </div>
            ) : (
              <>
                <Input
                  placeholder="Busca por nombre o teléfono…"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  leading={<Search size={15} />}
                  aria-label="Buscar clienta"
                />
                {clientSearch.trim().length >= 2 ? (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-line bg-white">
                    {clientsQuery.isLoading ? (
                      <div className="space-y-1 p-2">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : clientsQuery.data?.length ? (
                      clientsQuery.data.slice(0, 8).map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setSelectedClient(client)
                            setClientSearch('')
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-sand/50"
                        >
                          <Avatar name={client.name} color="#C2415A" size="xs" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-semibold text-ink">{client.name}</p>
                            <p className="text-[10.5px] text-muted">{client.phone}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-4 text-center text-xs text-muted">Sin resultados.</p>
                    )}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setCreatingClient(true)
                    setNewClientName(clientSearch)
                    setClientSearch('')
                  }}
                  className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-rose"
                >
                  <UserPlus size={14} /> Crear clienta nueva
                </button>
              </>
            )}
          </div>

          <Textarea
            label="Notas para el equipo"
            placeholder="Alergias, preferencias, referencias de color…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          {selectedService && slot ? (
            <div className="rounded-3xl border border-line bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Resumen</p>
              <div className="mt-3 space-y-2 text-[13px]">
                <div className="flex justify-between gap-3">
                  <span className="text-muted">Servicio</span>
                  <span className="text-right font-semibold text-ink">{selectedService.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted">Cuándo</span>
                  <span className="text-right font-semibold text-ink">
                    {weekdayShort(date)} {dayNumber(date)} · {formatTime(slot.start_at, timezone)}
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
              {selectedService.deposit_cents > 0 ? (
                <p className="mt-2 rounded-xl bg-gold-soft px-3 py-2 text-[11px] text-[#7A5A18]">
                  Sugerido pedir anticipo de {money(selectedService.deposit_cents)}.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl border border-rose/20 bg-rose-soft px-3.5 py-2.5 text-[12.5px] font-medium text-rose-deep"
        >
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}
    </Modal>
  )
}
