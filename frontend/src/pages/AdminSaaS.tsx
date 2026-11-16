import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CircleAlert,
  Copy,
  CreditCard,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { BrandMark, Wordmark } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Skeleton,
  Spinner,
  Textarea,
} from '../components/ui'
import { PlatformApiError, getPlatformToken, platformApi, setPlatformToken } from '../lib/platform'
import type {
  PlatformAdmin,
  PlatformTenant,
  PlatformTenantCreate,
  PlatformTenantUpdate,
} from '../lib/types'
import { cn, formatDateShort, money } from '../lib/format'

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', salon: 'Salón' }
const PLAN_PRICE: Record<string, number> = { free: 0, pro: 299, salon: 599 }
const PLAN_TONE: Record<string, string> = {
  free: 'bg-sand text-muted',
  pro: 'bg-sage-soft text-sage',
  salon: 'bg-gold-soft text-[#7A5A18]',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  trial: 'Prueba',
  suspended: 'Suspendido',
  archived: 'Archivado',
}
const STATUS_TONE: Record<string, string> = {
  active: 'bg-sage-soft text-sage',
  trial: 'bg-gold-soft text-[#7A5A18]',
  suspended: 'bg-rose-soft text-rose-deep',
  archived: 'bg-sand text-muted',
}
const EDITABLE_STATUSES = ['active', 'trial', 'suspended'] as const

interface CreatedCredentials {
  name: string
  email: string
  password: string
}

export function AdminSaaSPage() {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null)
  const [booting, setBooting] = useState(true)
  const [email, setEmail] = useState('admin@bellessa.mx')
  const [password, setPassword] = useState('admin1234')
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!getPlatformToken()) {
      setBooting(false)
      return
    }
    platformApi
      .me()
      .then(setAdmin)
      .catch(() => {
        setPlatformToken(null)
        setAdmin(null)
      })
      .finally(() => setBooting(false))
  }, [])

  async function login(event: React.FormEvent) {
    event.preventDefault()
    setLoggingIn(true)
    setError(null)
    try {
      const result = await platformApi.login(email, password)
      setPlatformToken(result.access_token)
      setAdmin(result.admin)
    } catch (caught) {
      setError(caught instanceof PlatformApiError ? caught.message : 'No pudimos entrar.')
    } finally {
      setLoggingIn(false)
    }
  }

  function logout() {
    setPlatformToken(null)
    setAdmin(null)
  }

  if (booting) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Cargando plataforma…
        </div>
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="grid min-h-dvh bg-cream lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-ink px-12 py-12 text-cream lg:flex lg:flex-col">
          <div
            className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full opacity-60 blur-3xl"
            style={{ background: 'radial-gradient(circle, #D9A44155, transparent 70%)' }}
          />
          <div className="relative flex items-center gap-2.5">
            <BrandMark size={40} />
            <Wordmark className="text-cream" />
          </div>
          <div className="relative my-auto max-w-lg">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cream/15 bg-cream/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cream/70">
              <ShieldCheck size={13} className="text-gold" /> Plataforma Bellessa
            </p>
            <h1 className="font-display text-[54px] font-normal leading-[0.98] tracking-[-0.035em]">
              Los salones,
              <br />
              <span className="italic text-[#F0CFA7]">en una vista.</span>
            </h1>
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-cream/65">
              Administra tenants, planes, uso y estado comercial. El panel de plataforma está
              separado del panel operativo de cada salón.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-2 text-center">
              {[
                ['Tenants', 'aislados'],
                ['Planes', 'Free/Pro/Salón'],
                ['Métricas', 'globales'],
              ].map(([title, subtitle]) => (
                <div key={title} className="rounded-2xl border border-cream/10 bg-cream/5 px-2 py-3">
                  <p className="font-display text-lg text-cream">{title}</p>
                  <p className="text-[9px] uppercase tracking-wider text-cream/45">{subtitle}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="relative text-[10px] text-cream/35">Admin SaaS · acceso separado del salón</p>
        </section>

        <section className="flex flex-col px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
          <div className="lg:hidden">
            <div className="flex items-center gap-2">
              <BrandMark size={36} />
              <Wordmark />
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose">Plataforma</p>
            <h2 className="mt-2 font-display text-[38px] font-medium leading-tight tracking-[-0.025em] text-ink">
              Admin SaaS
            </h2>
            <p className="mt-2 text-sm text-muted">Acceso de superadministrador de Bellessa.</p>

            <form onSubmit={login} className="mt-8 space-y-4">
              <Input
                label="Correo de plataforma"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-2xl border border-rose/20 bg-rose-soft px-3.5 py-2.5 text-[12.5px] font-medium text-rose-deep"
                >
                  <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
                </div>
              ) : null}
              <Button type="submit" variant="rose" size="lg" className="w-full" loading={loggingIn}>
                Entrar a la plataforma
              </Button>
            </form>
            <p className="mt-5 rounded-2xl bg-sand/50 px-4 py-3 text-center text-[11px] leading-relaxed text-muted">
              Demo: <span className="font-mono text-ink">admin@bellessa.mx</span> /{' '}
              <span className="font-mono text-ink">admin1234</span>
              <br />
              En producción cambia esta contraseña.
            </p>
            <a
              href="/login"
              className="mt-6 text-center text-[11px] font-semibold text-muted hover:text-ink"
            >
              Volver al panel del salón
            </a>
          </div>
        </section>
      </div>
    )
  }

  return <AdminDashboard admin={admin} onLogout={logout} />
}

function AdminDashboard({ admin, onLogout }: { admin: PlatformAdmin; onLogout: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<number | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PlatformTenant | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<PlatformTenant | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null)

  const overviewQuery = useQuery({ queryKey: ['platform-overview'], queryFn: platformApi.overview })
  const tenantsQuery = useQuery({
    queryKey: ['platform-tenants', showArchived],
    queryFn: () => platformApi.tenants(showArchived),
  })
  const overview = overviewQuery.data
  const tenants = tenantsQuery.data ?? []

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tenants
    return tenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(term) ||
        tenant.slug.toLowerCase().includes(term) ||
        (tenant.owner_email ?? '').toLowerCase().includes(term),
    )
  }, [tenants, search])

  function refreshTenants() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-overview'] }),
    ])
  }

  async function updateTenant(tenant: PlatformTenant, payload: PlatformTenantUpdate) {
    setUpdating(tenant.business_id)
    try {
      await platformApi.updateTenant(tenant.business_id, payload)
      await refreshTenants()
      toast('Salón actualizado')
    } catch (caught) {
      toast(caught instanceof PlatformApiError ? caught.message : 'No pudimos actualizar', 'error')
    } finally {
      setUpdating(null)
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      await platformApi.archiveTenant(archiveTarget.business_id)
      await refreshTenants()
      toast('Salón archivado; sus datos se conservan')
      setArchiveTarget(null)
    } catch (caught) {
      toast(caught instanceof PlatformApiError ? caught.message : 'No pudimos archivar', 'error')
    } finally {
      setArchiving(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(tenant: PlatformTenant) {
    setEditing(tenant)
    setFormOpen(true)
  }

  function onTenantSaved() {
    setFormOpen(false)
    setEditing(null)
    void refreshTenants()
  }

  function onTenantCreated(result: PlatformTenant, email: string, password: string) {
    setFormOpen(false)
    setEditing(null)
    void refreshTenants()
    setCredentials({ name: result.name, email, password })
  }

  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-line/80 bg-ink text-cream">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark size={34} />
            <div className="leading-none">
              <Wordmark className="text-cream" />
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-cream/40">
                Admin SaaS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[11px] font-semibold">{admin.name}</p>
              <p className="text-[9px] text-cream/40">{admin.email}</p>
            </div>
            <Avatar name={admin.name} color="#D9A441" size="sm" />
            <button
              type="button"
              onClick={onLogout}
              aria-label="Cerrar sesión de plataforma"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/15 text-cream/60 transition hover:bg-cream/10 hover:text-cream"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose">
              Plataforma Bellessa
            </p>
            <h1 className="mt-1 font-display text-[34px] font-medium leading-none text-ink sm:text-[42px]">
              Salones y planes
            </h1>
            <p className="mt-2 text-[13px] text-muted">
              Vista global de tenants, uso y estado comercial.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-sage-soft text-sage">
              <ShieldCheck size={11} /> Superadmin
            </Badge>
            <Button size="sm" variant="rose" onClick={openCreate}>
              <Plus size={14} /> Nuevo salón
            </Button>
          </div>
        </div>

        {overviewQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-3xl" />
            ))}
          </div>
        ) : overview ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <PlatformKpi
                icon={<Building2 size={17} />}
                label="Salones"
                value={String(overview.total_tenants)}
                hint={`${overview.active_tenants} activos · ${overview.trial_tenants} prueba · ${overview.archived_tenants} archivados`}
                tone="ink"
              />
              <PlatformKpi
                icon={<CreditCard size={17} />}
                label="MRR estimado"
                value={money(overview.mrr_cents)}
                hint="Planes activos, referencia"
                tone="gold"
              />
              <PlatformKpi
                icon={<Wallet size={17} />}
                label="Ingresos 30 días"
                value={money(overview.revenue_30d_cents)}
                hint={`${overview.appointments_30d} citas en la plataforma`}
                tone="sage"
              />
              <PlatformKpi
                icon={<Users size={17} />}
                label="Base total"
                value={String(overview.total_clients)}
                hint={`${overview.total_staff} profesionales activos`}
                tone="rose"
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {overview.plans.map((plan) => (
                <Card key={plan.key} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-[11px] font-bold text-ink">{plan.label}</p>
                    <p className="text-[10px] text-muted">
                      {overview.plan_counts[plan.key] ?? 0} salones · hasta {plan.max_staff} staff
                    </p>
                  </div>
                  <span className="money text-[13px] font-bold text-ink">
                    ${plan.price_mxn}
                    <span className="text-[9px] font-normal text-muted"> MXN/mes</span>
                  </span>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card className="p-4 text-sm text-muted">No pudimos cargar las métricas globales.</Card>
        )}

        <Card className="mt-5 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="font-display text-xl font-medium text-ink">Tenants</h2>
              <p className="text-[11px] text-muted">
                {filtered.length} de {tenants.length} salones
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setShowArchived((value) => !value)}
                className={cn(
                  'h-10 rounded-2xl border px-3 text-[11px] font-semibold transition',
                  showArchived
                    ? 'border-ink bg-ink text-cream'
                    : 'border-line bg-white text-muted hover:text-ink',
                )}
              >
                <Archive size={13} className="mr-1.5 inline" />
                {showArchived ? 'Ocultar archivados' : 'Ver archivados'}
              </button>
              <Input
                placeholder="Buscar salón, slug o correo…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                leading={<Search size={15} />}
                aria-label="Buscar tenant"
                className="h-10 sm:w-72"
              />
            </div>
          </div>

          {tenantsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-20" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="divide-y divide-line/60">
              {filtered.map((tenant) => (
                <div
                  key={tenant.business_id}
                  className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[1.4fr_.8fr_.7fr_.8fr] lg:items-center"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={tenant.name} color="#C2415A" size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] font-bold text-ink">{tenant.name}</p>
                        <Badge className={STATUS_TONE[tenant.status] ?? 'bg-sand text-muted'}>
                          {STATUS_LABEL[tenant.status] ?? tenant.status}
                        </Badge>
                      </div>
                      <p className="truncate text-[11px] text-muted">
                        /{tenant.slug} · {tenant.owner_name ?? 'Sin dueña'} ·{' '}
                        {tenant.owner_email ?? 'sin correo'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted/70">
                        Alta {formatDateShort(tenant.created_at, 'America/Mexico_City')} ·{' '}
                        {tenant.clients_count} clientas · {tenant.staff_count} staff
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted">Plan</span>
                    <select
                      value={tenant.plan}
                      disabled={updating === tenant.business_id}
                      onChange={(event) => updateTenant(tenant, { plan: event.target.value })}
                      className="h-8 rounded-xl border border-line bg-white px-2 text-[11px] font-semibold text-ink"
                      aria-label={`Plan de ${tenant.name}`}
                    >
                      {Object.keys(PLAN_LABEL).map((plan) => (
                        <option key={plan} value={plan}>
                          {PLAN_LABEL[plan]} · ${PLAN_PRICE[plan]}
                        </option>
                      ))}
                    </select>
                    <Badge className={PLAN_TONE[tenant.plan] ?? 'bg-sand text-muted'}>
                      {PLAN_LABEL[tenant.plan] ?? tenant.plan}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={12} /> {tenant.appointments_30d} citas
                    </span>
                    <span className="money font-semibold text-ink">
                      {money(tenant.revenue_30d_cents)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {tenant.status === 'archived' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateTenant(tenant, { status: 'active' })}
                        loading={updating === tenant.business_id}
                      >
                        <RotateCcw size={12} /> Restaurar
                      </Button>
                    ) : (
                      <select
                        value={tenant.status}
                        disabled={updating === tenant.business_id}
                        onChange={(event) => updateTenant(tenant, { status: event.target.value })}
                        className="h-8 rounded-xl border border-line bg-white px-2 text-[10.5px] font-semibold text-ink"
                        aria-label={`Estado de ${tenant.name}`}
                      >
                        {EDITABLE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(tenant)}
                      aria-label={`Editar ${tenant.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-white text-muted transition hover:border-ink/30 hover:text-ink"
                    >
                      <Pencil size={13} />
                    </button>
                    <a
                      href={`/reservar/${tenant.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-8 items-center gap-1 rounded-xl border border-line bg-white px-2.5 text-[10.5px] font-semibold text-ink hover:border-rose/40"
                    >
                      Web <ArrowUpRight size={12} />
                    </a>
                    {tenant.status !== 'archived' ? (
                      <button
                        type="button"
                        onClick={() => setArchiveTarget(tenant)}
                        aria-label={`Archivar ${tenant.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-white text-muted transition hover:border-rose/30 hover:text-rose-deep"
                      >
                        <Archive size={13} />
                      </button>
                    ) : null}
                    {updating === tenant.business_id ? <Spinner size={13} /> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted">Sin salones que coincidan.</div>
          )}
        </Card>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={12} className="text-gold" /> Bellessa Admin SaaS · aislamiento por tenant
          </span>
          <span>El panel del salón sigue en /login</span>
        </div>
      </main>

      <TenantFormModal
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSaved={onTenantSaved}
        onCreated={onTenantCreated}
      />

      <Modal
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        title="Archivar salón"
        subtitle={archiveTarget?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setArchiveTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmArchive} loading={archiving}>
              <Archive size={14} /> Archivar
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          El salón dejará de tener acceso y se ocultará de la lista principal. Sus clientas, citas y
          cobros se conservan; puedes restaurarlo desde “Ver archivados”.
        </p>
      </Modal>

      <Modal
        open={Boolean(credentials)}
        onClose={() => setCredentials(null)}
        title="Salón creado"
        subtitle="Guarda estas credenciales antes de cerrar"
        size="sm"
        footer={
          <Button variant="rose" className="w-full" onClick={() => setCredentials(null)}>
            Entendido
          </Button>
        }
      >
        {credentials ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted">
              <strong className="text-ink">{credentials.name}</strong> ya puede entrar al panel del
              salón.
            </p>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Correo</p>
              <p className="mt-0.5 break-all font-mono text-[12px] text-ink">{credentials.email}</p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                Contraseña temporal
              </p>
              <p className="mt-0.5 break-all font-mono text-[12px] text-ink">
                {credentials.password || 'La contraseña definida al crear el salón'}
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                await navigator.clipboard?.writeText(
                  `${credentials.email}\n${credentials.password}`,
                )
                toast('Credenciales copiadas')
              }}
            >
              <Copy size={14} /> Copiar credenciales
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function TenantFormModal({
  open,
  editing,
  onClose,
  onSaved,
  onCreated,
}: {
  open: boolean
  editing: PlatformTenant | null
  onClose: () => void
  onSaved: () => void
  onCreated: (tenant: PlatformTenant, email: string, password: string) => void
}) {
  const [form, setForm] = useState<PlatformTenantCreate>({
    name: '',
    slug: '',
    owner_name: '',
    owner_email: '',
    owner_password: '',
    phone: '',
    city: 'Ciudad de México',
    state: 'CDMX',
    plan: 'free',
    status: 'trial',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setForm({
        name: editing.name,
        slug: editing.slug,
        owner_name: editing.owner_name ?? '',
        owner_email: editing.owner_email ?? '',
        owner_password: '',
        phone: editing.phone ?? '',
        city: editing.city ?? 'Ciudad de México',
        state: 'CDMX',
        plan: editing.plan,
        status: editing.status === 'archived' ? 'active' : editing.status,
        notes: editing.notes ?? '',
      })
    } else {
      setForm({
        name: '',
        slug: '',
        owner_name: '',
        owner_email: '',
        owner_password: '',
        phone: '',
        city: 'Ciudad de México',
        state: 'CDMX',
        plan: 'free',
        status: 'trial',
        notes: '',
      })
    }
  }, [open, editing])

  function set<K extends keyof PlatformTenantCreate>(key: K, value: PlatformTenantCreate[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        const payload: PlatformTenantUpdate = {
          name: form.name,
          slug: form.slug || undefined,
          owner_name: form.owner_name,
          owner_email: form.owner_email,
          phone: form.phone ?? '',
          city: form.city || undefined,
          plan: form.plan,
          status: form.status,
          notes: form.notes || null,
        }
        if (form.owner_password) payload.owner_password = form.owner_password
        await platformApi.updateTenant(editing.business_id, payload)
        onSaved()
      } else {
        const result = await platformApi.createTenant({
          ...form,
          slug: form.slug || null,
          owner_password: form.owner_password || null,
          notes: form.notes || null,
        })
        onCreated(
          result,
          result.owner_email ?? form.owner_email,
          form.owner_password || result.generated_password || '',
        )
      }
    } catch (caught) {
      setError(caught instanceof PlatformApiError ? caught.message : 'No pudimos guardar el salón.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar salón' : 'Nuevo salón'}
      subtitle={editing ? editing.name : 'Crea el tenant y su cuenta de dueña'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="tenant-form" variant="rose" loading={saving}>
            {editing ? 'Guardar cambios' : 'Crear salón'}
          </Button>
        </div>
      }
    >
      <form id="tenant-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Nombre del salón"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Ej. Salón Aurora"
            required
          />
          <Input
            label="Slug"
            value={form.slug ?? ''}
            onChange={(event) => set('slug', event.target.value)}
            placeholder="se genera del nombre"
            hint="URL pública: /reservar/slug"
          />
          <Input
            label="Dueña"
            value={form.owner_name}
            onChange={(event) => set('owner_name', event.target.value)}
            placeholder="Nombre completo"
            required
          />
          <Input
            label="Correo de acceso"
            type="email"
            value={form.owner_email}
            onChange={(event) => set('owner_email', event.target.value)}
            placeholder="duena@salon.mx"
            required
          />
          <Input
            label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña (opcional)'}
            type="password"
            value={form.owner_password ?? ''}
            onChange={(event) => set('owner_password', event.target.value)}
            placeholder={editing ? 'Dejar vacío para conservar' : 'Se genera automáticamente'}
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            label="Teléfono"
            value={form.phone ?? ''}
            onChange={(event) => set('phone', event.target.value)}
            placeholder="55 1234 5678"
          />
          <Input
            label="Ciudad"
            value={form.city ?? ''}
            onChange={(event) => set('city', event.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Plan"
              value={form.plan}
              onChange={(event) => set('plan', event.target.value)}
            >
              {Object.keys(PLAN_LABEL).map((plan) => (
                <option key={plan} value={plan}>
                  {PLAN_LABEL[plan]}
                </option>
              ))}
            </Select>
            <Select
              label="Estado"
              value={form.status}
              onChange={(event) => set('status', event.target.value)}
            >
              {EDITABLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Textarea
          label="Notas internas"
          value={form.notes ?? ''}
          onChange={(event) => set('notes', event.target.value)}
          placeholder="Contexto de la cuenta, condiciones especiales…"
        />
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

function PlatformKpi({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone: 'ink' | 'gold' | 'sage' | 'rose'
}) {
  const tones = {
    ink: 'bg-sand text-ink',
    gold: 'bg-gold-soft text-[#7A5A18]',
    sage: 'bg-sage-soft text-sage',
    rose: 'bg-rose-soft text-rose-deep',
  }
  return (
    <Card className="p-4">
      <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl', tones[tone])}>
        {icon}
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="money mt-0.5 font-display text-[24px] font-medium leading-none text-ink">{value}</p>
      <p className="mt-1 text-[10px] text-muted">{hint}</p>
    </Card>
  )
}
