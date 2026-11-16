import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Cake,
  ChevronRight,
  CircleAlert,
  MessageCircle,
  Search,
  UserPlus,
  Users,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  cn,
  formatDateShort,
  initials,
  nextBirthdayDays,
  phoneDisplay,
  todayKey,
} from '../lib/format'
import type { Client } from '../lib/types'
import { PageHeader } from '../components/AppShell'
import { ClientFormModal } from '../components/ClientFormModal'
import { Avatar, Button, Card, EmptyState, Input, Skeleton } from '../components/ui'

const CLIENT_COLORS = ['#C2415A', '#3E5C50', '#D9A441', '#8E5572', '#5C8374', '#B56576']

function clientColor(id: number): string {
  return CLIENT_COLORS[id % CLIENT_COLORS.length]
}

export function ClientsPage() {
  const { business } = useAuth()
  const timezone = business?.timezone ?? 'America/Mexico_City'
  const today = todayKey(timezone)
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(params.get('nueva') === '1')

  const query = useQuery({ queryKey: ['clients'], queryFn: () => api.clients.list() })
  const clients = query.data ?? []

  const tags = useMemo(() => {
    const set = new Set<string>()
    clients.forEach((client) =>
      (client.tags ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => set.add(item)),
    )
    return Array.from(set).sort()
  }, [clients])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const digits = search.replace(/\D/g, '')
    return clients.filter((client) => {
      const matchesTag = !tag || (client.tags ?? '').includes(tag)
      const matchesSearch =
        !term ||
        client.name.toLowerCase().includes(term) ||
        client.phone.includes(digits) ||
        (client.email ?? '').toLowerCase().includes(term)
      return matchesTag && matchesSearch
    })
  }, [clients, search, tag])

  const vipCount = clients.filter((client) => (client.tags ?? '').includes('VIP')).length
  const birthdays = clients.filter(
    (client) => client.birthday && nextBirthdayDays(client.birthday, today) <= 7,
  ).length

  function openCreate() {
    setCreateOpen(true)
    if (params.get('nueva')) {
      const updated = new URLSearchParams(params)
      updated.delete('nueva')
      setParams(updated, { replace: true })
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Tu comunidad"
        title="Clientas"
        subtitle={`${clients.length} fichas · ${vipCount} VIP · ${birthdays} cumpleaños esta semana`}
        actions={
          <Button variant="rose" onClick={openCreate}>
            <UserPlus size={17} /> Nueva clienta
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          placeholder="Busca por nombre, WhatsApp o correo…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          leading={<Search size={16} />}
          aria-label="Buscar clientas"
        />
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-[11px] text-muted">
          <Users size={14} className="text-rose" />
          {filtered.length} de {clients.length}
        </div>
      </div>

      {tags.length ? (
        <div className="scrollbar-none mb-5 flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setTag(null)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
              tag === null
                ? 'border-ink bg-ink text-cream'
                : 'border-line bg-white text-muted hover:border-rose/30',
            )}
          >
            Todas
          </button>
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTag(tag === item ? null : item)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                tag === item
                  ? 'border-rose bg-rose-soft text-rose-deep'
                  : 'border-line bg-white text-muted hover:border-rose/30',
              )}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <EmptyState
            icon={<CircleAlert size={22} />}
            title="No pudimos cargar tus clientas"
            action={<Button onClick={() => query.refetch()}>Reintentar</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={23} />}
            title={search || tag ? 'Sin coincidencias' : 'Tu primera clienta te espera'}
            description={
              search || tag
                ? 'Prueba con otro nombre, teléfono o etiqueta.'
                : 'Agrega su ficha para guardar preferencias, cumpleaños e historial de servicios.'
            }
            action={
              search || tag ? (
                <Button variant="secondary" onClick={() => { setSearch(''); setTag(null) }}>
                  Limpiar filtros
                </Button>
              ) : (
                <Button variant="rose" onClick={openCreate}>
                  <UserPlus size={16} /> Agregar clienta
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} timezone={timezone} today={today} />
          ))}
        </div>
      )}

      <ClientFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

function ClientCard({
  client,
  timezone,
  today,
}: {
  client: Client
  timezone: string
  today: string
}) {
  const tags = (client.tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  const birthdaySoon = client.birthday ? nextBirthdayDays(client.birthday, today) : null
  return (
    <Link
      to={`/clientas/${client.id}`}
      className="group flex flex-col rounded-3xl border border-line bg-white/80 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-rose/30 hover:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <Avatar name={client.name} color={clientColor(client.id)} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-lg font-medium leading-tight text-ink">
              {client.name}
            </p>
            <ChevronRight
              size={16}
              className="shrink-0 text-muted/40 transition group-hover:translate-x-0.5 group-hover:text-rose"
            />
          </div>
          <p className="mt-0.5 text-[12px] text-muted">{phoneDisplay(client.phone)}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((item) => (
              <span
                key={item}
                className="rounded-full bg-sand px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-[11px]">
        <span className="text-muted">
          {client.last_visit_at
            ? `Última visita · ${formatDateShort(client.last_visit_at, timezone)}`
            : 'Sin visitas registradas'}
        </span>
        {birthdaySoon !== null && birthdaySoon <= 7 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-1 font-semibold text-[#7A5A18]">
            <Cake size={11} /> Pronto
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-sage">
            <MessageCircle size={11} /> WhatsApp
          </span>
        )}
      </div>
    </Link>
  )
}
