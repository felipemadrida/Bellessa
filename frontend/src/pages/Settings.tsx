import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowUpRight,
  Building2,
  Check,
  Clock3,
  Copy,
  Globe2,
  LogOut,
  Percent,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cn, formatDateShort, formatTime, money, parseMoney } from '../lib/format'
import type { BusinessHour } from '../lib/types'
import { PageHeader } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Segmented,
  Textarea,
} from '../components/ui'

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const AUDIT_LABELS: Record<string, string> = {
  'sesion.iniciada': 'Inicio de sesión',
  'negocio.registrado': 'Salón registrado',
  'negocio.actualizado': 'Perfil del salón actualizado',
  'horario.actualizado': 'Horario del salón actualizado',
  'horario.equipo_actualizado': 'Horario del equipo actualizado',
  'equipo.agregado': 'Persona agregada al equipo',
  'equipo.actualizado': 'Datos del equipo actualizados',
  'agenda.bloqueada': 'Agenda bloqueada',
  'agenda.desbloqueada': 'Bloqueo eliminado',
  'clienta.creada': 'Clienta creada',
  'clienta.actualizada': 'Ficha de clienta actualizada',
  'cita.creada': 'Cita creada',
  'cita.reagendada': 'Cita reagendada',
  'cita.actualizada': 'Cita actualizada',
  'cita.estado_cambiado': 'Estado de cita actualizado',
  'cita.reservada_en_linea': 'Reserva en línea',
  'cobro.registrado': 'Cobro registrado',
  'gasto.registrado': 'Gasto registrado',
}

export function SettingsPage() {
  const { user, business, refresh, signOut } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isOwner = user?.role === 'owner'

  const [profile, setProfile] = useState({
    name: '',
    legal_name: '',
    rfc: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    neighborhood: '',
    city: '',
    state: '',
    instagram: '',
  })
  const [booking, setBooking] = useState({
    require_deposit: false,
    deposit_percent: '30',
    cancellation_hours: '12',
    min_notice_minutes: '60',
    booking_window_days: '60',
    monthly_goal: '',
  })
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [account, setAccount] = useState({ name: '', phone: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingBooking, setSavingBooking] = useState(false)
  const [savingHours, setSavingHours] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [copied, setCopied] = useState(false)

  const auditQuery = useQuery({
    queryKey: ['audit', 'settings'],
    queryFn: () => api.audit.list(8),
    enabled: isOwner,
    staleTime: 0,
  })

  useEffect(() => {
    if (!business) return
    setProfile({
      name: business.name,
      legal_name: business.legal_name ?? '',
      rfc: business.rfc ?? '',
      phone: business.phone ?? '',
      whatsapp: business.whatsapp ?? '',
      email: business.email ?? '',
      address: business.address ?? '',
      neighborhood: business.neighborhood ?? '',
      city: business.city ?? '',
      state: business.state ?? '',
      instagram: business.instagram ?? '',
    })
    setBooking({
      require_deposit: business.require_deposit,
      deposit_percent: String(business.deposit_percent),
      cancellation_hours: String(business.cancellation_hours),
      min_notice_minutes: String(business.min_notice_minutes),
      booking_window_days: String(business.booking_window_days),
      monthly_goal: String(business.monthly_goal_cents / 100),
    })
    setHours(
      [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
        const existing = business.hours.find((hour) => hour.weekday === weekday)
        return (
          existing ?? {
            weekday,
            closed: weekday === 6,
            open_minute: 540,
            close_minute: 1140,
          }
        )
      }),
    )
  }, [business])

  useEffect(() => {
    if (!user) return
    setAccount({ name: user.name, phone: user.phone ?? '' })
  }, [user])

  const publicUrl = business ? `${window.location.origin}/reservar/${business.slug}` : ''

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!business) return
    setSavingProfile(true)
    try {
      await api.business.update({
        ...profile,
        rfc: profile.rfc.toUpperCase() || null,
      })
      await refresh()
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast('Datos del salón guardados')
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos guardar', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveBooking(event: React.FormEvent) {
    event.preventDefault()
    setSavingBooking(true)
    try {
      await api.business.update({
        require_deposit: booking.require_deposit,
        deposit_percent: Number(booking.deposit_percent) || 0,
        cancellation_hours: Number(booking.cancellation_hours) || 0,
        min_notice_minutes: Number(booking.min_notice_minutes) || 0,
        booking_window_days: Number(booking.booking_window_days) || 60,
        monthly_goal_cents: parseMoney(booking.monthly_goal),
      })
      await refresh()
      toast('Reglas de reserva actualizadas')
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos guardar', 'error')
    } finally {
      setSavingBooking(false)
    }
  }

  async function saveHours() {
    setSavingHours(true)
    try {
      await api.business.updateHours(hours)
      await refresh()
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      toast('Horario del salón actualizado')
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos guardar el horario', 'error')
    } finally {
      setSavingHours(false)
    }
  }

  async function saveAccount(event: React.FormEvent) {
    event.preventDefault()
    setSavingAccount(true)
    try {
      await api.auth.updateMe(account)
      await refresh()
      toast('Tu cuenta está actualizada')
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos guardar', 'error')
    } finally {
      setSavingAccount(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast('Link copiado')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('No pudimos copiar el link', 'error')
    }
  }

  if (!business || !user) return null

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Tu negocio"
        title="Ajustes"
        subtitle={`${business.name} · ${isOwner ? 'Vista de dueña' : 'Vista de equipo'}`}
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <SectionTitle
              title="Perfil del salón"
              subtitle="Así te ven tus clientas y cómo apareces en los recibos."
            />
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Nombre comercial"
                  value={profile.name}
                  onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  disabled={!isOwner}
                />
                <Input
                  label="Razón social"
                  value={profile.legal_name}
                  onChange={(event) => setProfile({ ...profile, legal_name: event.target.value })}
                  disabled={!isOwner}
                  placeholder="Para tu recibo"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="RFC"
                  value={profile.rfc}
                  onChange={(event) => setProfile({ ...profile, rfc: event.target.value.toUpperCase() })}
                  maxLength={13}
                  disabled={!isOwner}
                  placeholder="XAXX010101000"
                  hint="Datos fiscales para CFDI 4.0"
                />
                <Input
                  label="Instagram"
                  value={profile.instagram}
                  onChange={(event) => setProfile({ ...profile, instagram: event.target.value })}
                  disabled={!isOwner}
                  placeholder="@tusalon"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Teléfono"
                  value={profile.phone}
                  onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                  disabled={!isOwner}
                  inputMode="tel"
                />
                <Input
                  label="WhatsApp"
                  value={profile.whatsapp}
                  onChange={(event) => setProfile({ ...profile, whatsapp: event.target.value })}
                  disabled={!isOwner}
                  inputMode="tel"
                />
              </div>
              <Input
                label="Correo del salón"
                type="email"
                value={profile.email}
                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                disabled={!isOwner}
              />
              <Input
                label="Dirección"
                value={profile.address}
                onChange={(event) => setProfile({ ...profile, address: event.target.value })}
                disabled={!isOwner}
                placeholder="Calle y número"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Colonia"
                  value={profile.neighborhood}
                  onChange={(event) => setProfile({ ...profile, neighborhood: event.target.value })}
                  disabled={!isOwner}
                />
                <Input
                  label="Ciudad"
                  value={profile.city}
                  onChange={(event) => setProfile({ ...profile, city: event.target.value })}
                  disabled={!isOwner}
                />
                <Input
                  label="Estado"
                  value={profile.state}
                  onChange={(event) => setProfile({ ...profile, state: event.target.value })}
                  disabled={!isOwner}
                />
              </div>
              {isOwner ? (
                <div className="flex justify-end">
                  <Button type="submit" variant="rose" loading={savingProfile}>
                    Guardar perfil
                  </Button>
                </div>
              ) : null}
            </form>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle
              title="Reservas y anticipos"
              subtitle="Reglas claras para cuidar tu tiempo y tu agenda."
            />
            {isOwner ? (
              <form onSubmit={saveBooking} className="space-y-4">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={booking.require_deposit}
                    onChange={(event) =>
                      setBooking({ ...booking, require_deposit: event.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 accent-[#C2415A]"
                  />
                  <span className="text-[12px] leading-snug">
                    <span className="font-semibold text-ink">Pedir anticipo para reservar</span>
                    <br />
                    <span className="text-muted">
                      Se muestra el monto sugerido y el link de WhatsApp para acordarlo.
                    </span>
                  </span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Anticipo (%)"
                    type="number"
                    min={0}
                    max={100}
                    value={booking.deposit_percent}
                    onChange={(event) =>
                      setBooking({ ...booking, deposit_percent: event.target.value })
                    }
                    disabled={!booking.require_deposit}
                  />
                  <Input
                    label="Cancelación sin cargo (horas)"
                    type="number"
                    min={0}
                    value={booking.cancellation_hours}
                    onChange={(event) =>
                      setBooking({ ...booking, cancellation_hours: event.target.value })
                    }
                  />
                  <Input
                    label="Aviso mínimo para agendar (min)"
                    type="number"
                    min={0}
                    value={booking.min_notice_minutes}
                    onChange={(event) =>
                      setBooking({ ...booking, min_notice_minutes: event.target.value })
                    }
                  />
                  <Input
                    label="Reservas a futuro (días)"
                    type="number"
                    min={1}
                    value={booking.booking_window_days}
                    onChange={(event) =>
                      setBooking({ ...booking, booking_window_days: event.target.value })
                    }
                  />
                </div>
                <Input
                  label="Meta mensual de ingresos"
                  leading="$"
                  inputMode="decimal"
                  value={booking.monthly_goal}
                  onChange={(event) => setBooking({ ...booking, monthly_goal: event.target.value })}
                  hint="Se usa en el anillo de tu dashboard"
                />
                <div className="flex justify-end">
                  <Button type="submit" variant="rose" loading={savingBooking}>
                    Guardar reglas
                  </Button>
                </div>
              </form>
            ) : (
              <p className="rounded-2xl bg-sand/40 px-4 py-5 text-center text-xs text-muted">
                Solo la persona dueña puede editar las reglas de reserva.
              </p>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle
              title="Horario del salón"
              subtitle="La agenda y las reservas solo usarán estas horas."
              action={
                isOwner ? (
                  <Button size="sm" variant="secondary" onClick={saveHours} loading={savingHours}>
                    Guardar horario
                  </Button>
                ) : null
              }
            />
            <div className="space-y-2">
              {hours.map((row, index) => (
                <div
                  key={row.weekday}
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5',
                    row.closed ? 'border-line bg-sand/40' : 'border-line bg-white',
                  )}
                >
                  <span className="w-20 text-[12px] font-semibold text-ink">
                    {WEEKDAYS[row.weekday]}
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      checked={!row.closed}
                      disabled={!isOwner}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, closed: !event.target.checked } : item,
                          ),
                        )
                      }
                      className="h-3.5 w-3.5 accent-[#C2415A]"
                    />
                    Abierto
                  </label>
                  <div className="ml-auto flex items-center gap-1.5">
                    <input
                      type="time"
                      value={minutesToTime(row.open_minute)}
                      disabled={row.closed || !isOwner}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, open_minute: timeToMinutes(event.target.value) }
                              : item,
                          ),
                        )
                      }
                      className="h-8 rounded-xl border border-line bg-cream px-2 text-[11px] disabled:opacity-40"
                      aria-label={`Apertura ${WEEKDAYS[row.weekday]}`}
                    />
                    <span className="text-[10px] text-muted">a</span>
                    <input
                      type="time"
                      value={minutesToTime(row.close_minute)}
                      disabled={row.closed || !isOwner}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, close_minute: timeToMinutes(event.target.value) }
                              : item,
                          ),
                        )
                      }
                      className="h-8 rounded-xl border border-line bg-cream px-2 text-[11px] disabled:opacity-40"
                      aria-label={`Cierre ${WEEKDAYS[row.weekday]}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-rose-soft to-cream px-4 py-4">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-rose-deep">
                <Globe2 size={13} /> Tu página pública
              </p>
              <p className="mt-2 font-display text-[22px] font-medium leading-tight text-ink">
                Reservas en línea, sin mensajes a medianoche.
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2 rounded-xl border border-line bg-cream px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted">
                  {publicUrl}
                </span>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label="Copiar link"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-muted transition hover:text-ink"
                >
                  {copied ? <Check size={14} className="text-sage" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={copyLink}>
                  <Copy size={14} /> Copiar
                </Button>
                <a href={`/reservar/${business.slug}`} target="_blank" rel="noreferrer">
                  <Button variant="rose" size="sm" className="w-full">
                    <ArrowUpRight size={14} /> Abrir
                  </Button>
                </a>
              </div>
              <p className="text-[10.5px] leading-relaxed text-muted">
                Compártelo en Instagram, Google Maps y tu link de WhatsApp. Tus clientas eligen
                servicio, día y hora; tú solo confirmas.
              </p>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title="Modo México" subtitle="Hecho para operar aquí." />
            <div className="space-y-3">
              {[
                { icon: Percent, title: 'IVA incluido', text: 'Precios finales con 16% y desglose en recibos.' },
                { icon: ShieldCheck, title: 'RFC y CFDI 4.0', text: 'Datos fiscales listos; recibo interno descargable.' },
                { icon: Sparkles, title: 'WhatsApp +52', text: 'Links wa.me con formato mexicano y plantillas.' },
                { icon: Clock3, title: 'Hora de CDMX', text: 'Zona America/Mexico_City, sin importar dónde estés.' },
              ].map((item) => (
                <div key={item.title} className="flex gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sage-soft text-sage">
                    <item.icon size={14} />
                  </span>
                  <div>
                    <p className="text-[11.5px] font-bold text-ink">{item.title}</p>
                    <p className="text-[10.5px] leading-snug text-muted">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {isOwner ? (
            <Card className="p-4 sm:p-5">
              <SectionTitle
                title="Actividad reciente"
                subtitle="Quién hizo qué y cuándo, sin datos sensibles."
                action={
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sand text-muted">
                    <Activity size={15} />
                  </span>
                }
              />
              {auditQuery.isLoading ? (
                <div className="space-y-2">
                  <div className="h-10 animate-pulse rounded-xl bg-sand/60" />
                  <div className="h-10 animate-pulse rounded-xl bg-sand/60" />
                  <div className="h-10 animate-pulse rounded-xl bg-sand/60" />
                </div>
              ) : auditQuery.data?.length ? (
                <div className="space-y-2">
                  {auditQuery.data.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] font-semibold leading-snug text-ink">
                          {AUDIT_LABELS[entry.action] ?? entry.action}
                        </p>
                        <p className="truncate text-[10px] text-muted">
                          {entry.detail ?? entry.entity_type}
                          {entry.user_name ? ` · ${entry.user_name}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-[9.5px] text-muted/70">
                        {formatDateShort(entry.created_at, business.timezone)} ·{' '}
                        {formatTime(entry.created_at, business.timezone)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-sand/40 px-3 py-4 text-center text-[11px] text-muted">
                  La actividad aparecerá aquí en cuanto el equipo empiece a operar.
                </p>
              )}
            </Card>
          ) : null}

          <Card className="p-4 sm:p-5">
            <SectionTitle title="Tu cuenta" />
            <form onSubmit={saveAccount} className="space-y-3">
              <Input
                label="Nombre"
                value={account.name}
                onChange={(event) => setAccount({ ...account, name: event.target.value })}
              />
              <Input
                label="WhatsApp personal"
                value={account.phone}
                onChange={(event) => setAccount({ ...account, phone: event.target.value })}
                inputMode="tel"
              />
              <Input label="Correo" value={user.email} disabled />
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-sand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                  {isOwner ? 'Dueña' : 'Equipo'}
                </span>
                <Button type="submit" size="sm" variant="secondary" loading={savingAccount}>
                  Guardar
                </Button>
              </div>
            </form>
            <div className="mt-4 border-t border-line/60 pt-3">
              <Button variant="ghost" size="sm" className="w-full text-rose-deep" onClick={signOut}>
                <LogOut size={14} /> Cerrar sesión
              </Button>
            </div>
          </Card>

          <div className="rounded-3xl border border-dashed border-line bg-white/40 p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold text-ink">
              <Building2 size={14} className="text-rose" /> {business.name}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
              {business.address ?? 'Sin dirección'} · {business.neighborhood ?? ''}{' '}
              {business.city ?? ''}
            </p>
            <p className="mt-2 text-[10px] text-muted/70">
              Plan Bellessa · Datos en tu propia nube · Precios en {business.currency}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function timeToMinutes(value: string): number {
  const [hours, mins] = value.split(':').map(Number)
  return (hours || 0) * 60 + (mins || 0)
}
