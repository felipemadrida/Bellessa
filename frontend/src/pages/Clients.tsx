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
import { usePreferences } from '../lib/preferences'
import { vocabularyLabel, splitTags } from '../lib/vocabulary'
import {
  cn,
  formatDateShort,
  nextBirthdayDays,
  phoneDisplay,
  todayKey,
} from '../lib/format'
import type { Client } from '../lib/types'
import { PageHeader } from '../components/AppShell'
import { ClientFormModal } from '../components/ClientFormModal'
import { Avatar, Button, Card, EmptyState, Input, Skeleton } from '../components/ui'

const CLIENT_COLORS = ['#9C5566', '#4A6B5D', '#A8842C', '#7E3F4E', '#6B8A7D', '#C08A96']

function clientColor(id: number): string {
  return CLIENT_COLORS[id % CLIENT_COLORS.length]
}

export function ClientsPage() {
  const { business } = useAuth()
  const { t } = usePreferences()
  const timezone = business?.timezone ?? 'America/Mexico_City'
  const today = todayKey(timezone)
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
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
        eyebrow={t('page.clients.eyebrow')}
        title={t('page.clients.title')}
        subtitle={`${clients.length} ${t('page.clients.cards')} · ${vipCount} VIP · ${birthdays} ${t('page.clients.birthdays')}`}
        actions={
          <Button variant="rose" onClick={openCreate} className="rounded-pill bg-licorice hover:bg-licorice/90">
            <UserPlus size={17} /> {t('page.clients.newClient')}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          placeholder={t('common.searchClientsPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          leading={<Search size={16} />}
          aria-label={t('common.searchClients')}
        />
        <div className="flex items-center gap-2 rounded-pill border border-border bg-alabaster px-3 py-2 text-[11px] text-taupe">
          <Users size={14} className="text-blush" />
          {filtered.length} de {clients.length}
        </div>
      </div>

      {tags.length ? (
        <div className="scrollbar-none mb-5 flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setTag(null)}
            className={cn(
              'shrink-0 rounded-pill border px-3 py-1.5 text-[11px] font-semibold transition',
              tag === null
                ? 'border-licorice bg-licorice text-alabaster'
                : 'border-border bg-alabaster text-taupe hover:border-blush/30',
            )}
          >
            {t('common.all')}
          </button>
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTag(tag === item ? null : item)}
              className={cn(
                'shrink-0 rounded-pill border px-3 py-1.5 text-[11px] font-semibold transition',
                tag === item
                  ? 'border-blush bg-blush-soft text-blush-deep'
                  : 'border-border bg-alabaster text-taupe hover:border-blush/30',
              )}
            >
              {vocabularyLabel(item, t)}
            </button>
          ))}
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-card" />
          ))}
        </div>
      ) : query.isError ? (
        <Card className="shadow-boutique">
          <EmptyState
            icon={<CircleAlert size={22} />}
            title={t('page.clients.errorTitle')}
            action={<Button onClick={() => query.refetch()}>{t('common.retry')}</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="shadow-boutique">
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
                <Button variant="rose" onClick={openCreate} className="rounded-pill bg-licorice hover:bg-licorice/90">
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
  const { t } = usePreferences()
  const tags = splitTags(client.tags)
  const birthdaySoon = client.birthday ? nextBirthdayDays(client.birthday, today) : null
  return (
    <Link
      to={`/clientas/${client.id}`}
      className="group flex flex-col rounded-card border border-border bg-alabaster/80 p-4 shadow-boutique transition hover:-translate-y-0.5 hover:border-blush/30 hover:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <Avatar name={client.name} color={clientColor(client.id)} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-lg font-medium leading-tight text-licorice">
              {client.name}
            </p>
            <ChevronRight
              size={16}
              className="shrink-0 text-muted/40 transition group-hover:translate-x-0.5 group-hover:text-blush"
            />
          </div>
          <p className="mt-0.5 text-[12px] text-muted">{phoneDisplay(client.phone)}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((item) => (
              <span
                key={item}
                className="rounded-full bg-champ px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted"
              >
                {vocabularyLabel(item, t)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px]">
        <span className="text-muted">
          {client.last_visit_at
            ? `Última visita · ${formatDateShort(client.last_visit_at, timezone)}`
            : 'Sin visitas registradas'}
        </span>
        {birthdaySoon !== null && birthdaySoon <= 7 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-champagne-soft px-2 py-1 font-semibold text-champagne-deep">
            <Cake size={11} /> Pronto
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-taupe">
            <MessageCircle size={11} /> WhatsApp
          </span>
        )}
      </div>
    </Link>
  )
}
