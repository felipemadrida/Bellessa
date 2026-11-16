import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleAlert,
  Clock3,
  Pencil,
  Plus,
  Scissors,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { api, ApiError, type ServiceInput } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cn, formatDuration, money, parseMoney } from '../lib/format'
import type { Service } from '../lib/types'
import { PageHeader } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  SectionTitle,
  Skeleton,
  Textarea,
} from '../components/ui'

const PALETTE = ['#C2415A', '#3E5C50', '#D9A441', '#D97757', '#8E5572', '#5C8374', '#7A4E3B', '#B56576']

export function ServicesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isOwner = user?.role === 'owner'

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  const query = useQuery({
    queryKey: ['services-all'],
    queryFn: () => api.services.list(true),
  })
  const services = query.data ?? []

  const visible = useMemo(
    () => services.filter((service) => showInactive || service.active),
    [services, showInactive],
  )
  const categories = useMemo(() => {
    const map = new Map<string, Service[]>()
    for (const service of visible) {
      const list = map.get(service.category) ?? []
      list.push(service)
      map.set(service.category, list)
    }
    return Array.from(map.entries())
  }, [visible])

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(service: Service) {
    setEditing(service)
    setFormOpen(true)
  }

  async function toggleActive(service: Service) {
    setToggling(service.id)
    try {
      await api.services.update(service.id, { active: !service.active })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services-all'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
      ])
      toast(service.active ? 'Servicio oculto del menú' : 'Servicio visible otra vez')
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos actualizar', 'error')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Tu menú"
        title="Servicios"
        subtitle={`${services.filter((service) => service.active).length} servicios activos · Precios con IVA incluido`}
        actions={
          isOwner ? (
            <Button variant="rose" onClick={openCreate}>
              <Plus size={17} /> Nuevo servicio
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-muted">
          <Sparkles size={13} className="text-gold" />
          Los colores te ayudan a leer la agenda de un vistazo
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-[11.5px] font-semibold text-muted">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="h-4 w-4 accent-[#C2415A]"
          />
          Ver servicios ocultos
        </label>
      </div>

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <EmptyState
            icon={<CircleAlert size={22} />}
            title="No pudimos cargar tu menú"
            action={<Button onClick={() => query.refetch()}>Reintentar</Button>}
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Scissors size={23} />}
            title="Tu menú está vacío"
            description="Agrega los servicios que ofreces con precio y duración para empezar a agendar."
            action={
              isOwner ? (
                <Button variant="rose" onClick={openCreate}>
                  <Plus size={16} /> Crear primer servicio
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-7">
          {categories.map(([category, items]) => (
            <section key={category}>
              <SectionTitle
                title={category}
                subtitle={`${items.length} servicio${items.length === 1 ? '' : 's'}`}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((service) => (
                  <Card
                    key={service.id}
                    className={cn(
                      'relative overflow-hidden p-4 transition sm:p-5',
                      !service.active && 'opacity-60',
                    )}
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ backgroundColor: service.color }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: service.color }}
                          />
                          <h3 className="truncate font-display text-lg font-medium text-ink">
                            {service.name}
                          </h3>
                        </div>
                        {service.description ? (
                          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                            {service.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isOwner ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(service)}
                              aria-label={`Editar ${service.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-ink"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleActive(service)}
                              disabled={toggling === service.id}
                              aria-label={service.active ? 'Ocultar servicio' : 'Mostrar servicio'}
                              className={cn(
                                'relative h-5 w-9 rounded-full transition',
                                service.active ? 'bg-sage' : 'bg-sand',
                              )}
                            >
                              <span
                                className={cn(
                                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
                                  service.active ? 'left-[18px]' : 'left-0.5',
                                )}
                              />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5 text-[10.5px] text-muted">
                        <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-1">
                          <Clock3 size={11} /> {formatDuration(service.duration_min)}
                        </span>
                        {service.buffer_min > 0 ? (
                          <span className="rounded-full bg-sand px-2 py-1">
                            +{service.buffer_min} min limpieza
                          </span>
                        ) : null}
                        {service.deposit_cents > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-1 font-semibold text-[#7A5A18]">
                            <Wallet size={11} /> Anticipo {money(service.deposit_cents)}
                          </span>
                        ) : null}
                      </div>
                      <p className="money shrink-0 font-display text-[24px] font-medium leading-none text-ink">
                        {money(service.price_cents)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ServiceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        service={editing}
        categories={Array.from(new Set(services.map((service) => service.category)))}
      />
    </div>
  )
}

function ServiceFormModal({
  open,
  onClose,
  service,
  categories,
}: {
  open: boolean
  onClose: () => void
  service: Service | null
  categories: string[]
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Cabello')
  const [duration, setDuration] = useState('60')
  const [buffer, setBuffer] = useState('10')
  const [price, setPrice] = useState('')
  const [deposit, setDeposit] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(service?.name ?? '')
    setDescription(service?.description ?? '')
    setCategory(service?.category ?? categories[0] ?? 'Cabello')
    setDuration(String(service?.duration_min ?? 60))
    setBuffer(String(service?.buffer_min ?? 10))
    setPrice(service ? String(service.price_cents / 100) : '')
    setDeposit(service && service.deposit_cents ? String(service.deposit_cents / 100) : '')
    setColor(service?.color ?? PALETTE[0])
    setActive(service?.active ?? true)
    setError(null)
    setSaving(false)
  }, [open, service, categories])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Ponle un nombre al servicio.')
      return
    }
    if (parseMoney(price) <= 0) {
      setError('Escribe un precio mayor a cero.')
      return
    }
    setSaving(true)
    setError(null)
    const payload: ServiceInput = {
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || 'General',
      duration_min: Math.max(5, Number(duration) || 60),
      buffer_min: Math.max(0, Number(buffer) || 0),
      price_cents: parseMoney(price),
      deposit_cents: parseMoney(deposit),
      color,
      sort_order: service?.sort_order ?? 99,
    }
    try {
      if (service) {
        await api.services.update(service.id, { ...payload, active })
      } else {
        await api.services.create(payload)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services-all'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      toast(service ? 'Servicio actualizado' : 'Servicio agregado a tu menú')
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar el servicio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? 'Editar servicio' : 'Nuevo servicio'}
      subtitle="Precio final con IVA incluido, como se lo dices a tu clienta."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="rose" type="submit" form="service-form" loading={saving}>
            {service ? 'Guardar cambios' : 'Agregar servicio'}
          </Button>
        </div>
      }
    >
      <form id="service-form" onSubmit={submit} className="space-y-4">
        <Input
          label="Nombre del servicio"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Balayage"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Categoría"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            list="service-categories"
            placeholder="Cabello, Uñas…"
          />
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
          <datalist id="service-categories">
            {categories.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
        <Textarea
          label="Descripción (opcional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Qué incluye, recomendaciones, duración real…"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Duración (min)"
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
          <Input
            label="Limpieza entre citas"
            type="number"
            min={0}
            step={5}
            value={buffer}
            onChange={(event) => setBuffer(event.target.value)}
            hint="Minutos de margen"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Precio"
            leading="$"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="380"
          />
          <Input
            label="Anticipo sugerido"
            leading="$"
            inputMode="decimal"
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
            placeholder="0"
            hint="Opcional"
          />
        </div>
        {service ? (
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-ink">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-4 w-4 accent-[#C2415A]"
            />
            Servicio visible para agendar
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
