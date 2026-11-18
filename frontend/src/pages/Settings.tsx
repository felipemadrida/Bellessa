import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowUpRight,
  Building2,
  Check,
  Clock3,
  Coins,
  Copy,
  Globe2,
  Languages,
  LogOut,
  Palette,
  Percent,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cn, formatDateShort, formatTime, parseMoney, weekdayNameByIndex } from '../lib/format'
import { usePreferences } from '../lib/preferences'
import type { BusinessHour } from '../lib/types'
import { PageHeader } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Select,
} from '../components/ui'

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
  const { t, locale } = usePreferences()
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
  const [experience, setExperience] = useState({
    currency: 'MXN',
    locale: 'es-MX',
    brand_color: '#9C5566',
  })
  const [account, setAccount] = useState({ name: '', phone: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingExperience, setSavingExperience] = useState(false)
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
    setExperience({
      currency: business.currency,
      locale: business.locale,
      brand_color: business.brand_color,
    })
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
      toast(t('settings.profileSaved'))
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : t('settings.saveError'), 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveExperience(event: React.FormEvent) {
    event.preventDefault()
    setSavingExperience(true)
    try {
      await api.business.update({
        currency: experience.currency,
        locale: experience.locale,
        brand_color: experience.brand_color,
      })
      await refresh()
      toast(t('settings.experienceSaved'))
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : t('settings.saveError'), 'error')
    } finally {
      setSavingExperience(false)
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
      toast(t('settings.rulesSaved'))
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : t('settings.saveError'), 'error')
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
      toast(t('team.hoursSaved'))
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : t('team.hoursSaveError'), 'error')
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
      toast(t('settings.accountSaved'))
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : t('settings.saveError'), 'error')
    } finally {
      setSavingAccount(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast(t('settings.linkCopied'))
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(t('settings.linkCopyError'), 'error')
    }
  }

  if (!business || !user) return null

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        subtitle={`${business.name} · ${isOwner ? t('settings.viewOwner') : t('settings.viewStaff')}`}
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <SectionTitle
              title={t('settings.profileTitle')}
              subtitle={t('settings.profileSubtitle')}
            />
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={t('settings.nameLabel')}
                  value={profile.name}
                  onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  disabled={!isOwner}
                />
                <Input
                  label={t('settings.legalName')}
                  value={profile.legal_name}
                  onChange={(event) => setProfile({ ...profile, legal_name: event.target.value })}
                  disabled={!isOwner}
                  placeholder={t('settings.legalNamePlaceholder')}
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
                  hint={t('settings.rfcHint')}
                />
                <Input
                  label={t('settings.instagram')}
                  value={profile.instagram}
                  onChange={(event) => setProfile({ ...profile, instagram: event.target.value })}
                  disabled={!isOwner}
                  placeholder="@tusalon"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={t('settings.phone')}
                  value={profile.phone}
                  onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                  disabled={!isOwner}
                  inputMode="tel"
                />
                <Input
                  label={t('settings.whatsapp')}
                  value={profile.whatsapp}
                  onChange={(event) => setProfile({ ...profile, whatsapp: event.target.value })}
                  disabled={!isOwner}
                  inputMode="tel"
                />
              </div>
              <Input
                label={t('settings.email')}
                type="email"
                value={profile.email}
                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                disabled={!isOwner}
              />
              <Input
                label={t('settings.address')}
                value={profile.address}
                onChange={(event) => setProfile({ ...profile, address: event.target.value })}
                disabled={!isOwner}
                placeholder={t('settings.addressPlaceholder')}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label={t('settings.neighborhood')}
                  value={profile.neighborhood}
                  onChange={(event) => setProfile({ ...profile, neighborhood: event.target.value })}
                  disabled={!isOwner}
                />
                <Input
                  label={t('settings.city')}
                  value={profile.city}
                  onChange={(event) => setProfile({ ...profile, city: event.target.value })}
                  disabled={!isOwner}
                />
                <Input
                  label={t('settings.state')}
                  value={profile.state}
                  onChange={(event) => setProfile({ ...profile, state: event.target.value })}
                  disabled={!isOwner}
                />
              </div>
              {isOwner ? (
                <div className="flex justify-end">
                  <Button type="submit" variant="rose" loading={savingProfile}>
                    {t('settings.saveProfile')}
                  </Button>
                </div>
              ) : null}
            </form>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle
              title={t('settings.expTitle')}
              subtitle={t('settings.expSubtitle')}
            />
            <form onSubmit={saveExperience} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('settings.currency')} hint={t('settings.currencyHint')} htmlFor="settings-currency">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                      <Coins size={16} />
                    </span>
                    <Select
                      id="settings-currency"
                      value={experience.currency}
                      onChange={(event) => setExperience({ ...experience, currency: event.target.value })}
                      disabled={!isOwner}
                      className="pl-9"
                    >
                      <option value="MXN">{t('settings.currencyMxn')}</option>
                      <option value="USD">{t('settings.currencyUsd')}</option>
                    </Select>
                  </div>
                </Field>
                <Field label={t('settings.locale')} hint={t('settings.localeHint')} htmlFor="settings-locale">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                      <Languages size={16} />
                    </span>
                    <Select
                      id="settings-locale"
                      value={experience.locale}
                      onChange={(event) => setExperience({ ...experience, locale: event.target.value })}
                      disabled={!isOwner}
                      className="pl-9"
                    >
                      <option value="es-MX">{t('settings.localeEs')}</option>
                      <option value="en-US">{t('settings.localeEn')}</option>
                    </Select>
                  </div>
                </Field>
              </div>
              <Field
                label={t('settings.accent')}
                hint={t('settings.accentHint')}
                htmlFor="settings-color"
              >
                <div className="flex items-center gap-3">
                  <span className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface text-muted">
                    <Palette size={18} />
                  </span>
                  <input
                    type="color"
                    aria-label={t('settings.pickColorAria')}
                    value={experience.brand_color}
                    onChange={(event) => setExperience({ ...experience, brand_color: event.target.value })}
                    disabled={!isOwner}
                    className="h-11 w-16 cursor-pointer rounded-xl border border-border bg-surface p-1"
                  />
                  <Input
                    id="settings-color"
                    aria-label={t('settings.colorCodeAria')}
                    value={experience.brand_color}
                    onChange={(event) => setExperience({ ...experience, brand_color: event.target.value })}
                    disabled={!isOwner}
                    maxLength={7}
                    placeholder="#9C5566"
                    className="max-w-[140px] font-mono uppercase"
                  />
                </div>
              </Field>
              {isOwner ? (
                <div className="flex justify-end">
                  <Button type="submit" variant="rose" loading={savingExperience}>
                    {t('settings.saveExperience')}
                  </Button>
                </div>
              ) : null}
            </form>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle
              title={t('settings.bookingTitle')}
              subtitle={t('settings.bookingSubtitle')}
            />
            {isOwner ? (
              <form onSubmit={saveBooking} className="space-y-4">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={booking.require_deposit}
                    onChange={(event) =>
                      setBooking({ ...booking, require_deposit: event.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 accent-[#9C5566]"
                  />
                  <span className="text-[12px] leading-snug">
                    <span className="font-semibold text-licorice">{t('settings.requireDeposit')}</span>
                    <br />
                    <span className="text-muted">{t('settings.requireDepositHint')}</span>
                  </span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={t('settings.depositPercent')}
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
                    label={t('settings.cancellationHours')}
                    type="number"
                    min={0}
                    value={booking.cancellation_hours}
                    onChange={(event) =>
                      setBooking({ ...booking, cancellation_hours: event.target.value })
                    }
                  />
                  <Input
                    label={t('settings.minNotice')}
                    type="number"
                    min={0}
                    value={booking.min_notice_minutes}
                    onChange={(event) =>
                      setBooking({ ...booking, min_notice_minutes: event.target.value })
                    }
                  />
                  <Input
                    label={t('settings.windowDays')}
                    type="number"
                    min={1}
                    value={booking.booking_window_days}
                    onChange={(event) =>
                      setBooking({ ...booking, booking_window_days: event.target.value })
                    }
                  />
                </div>
                <Input
                  label={t('settings.monthlyGoal')}
                  leading="$"
                  inputMode="decimal"
                  value={booking.monthly_goal}
                  onChange={(event) => setBooking({ ...booking, monthly_goal: event.target.value })}
                  hint={t('settings.monthlyGoalHint')}
                />
                <div className="flex justify-end">
                  <Button type="submit" variant="rose" loading={savingBooking}>
                    {t('settings.saveRules')}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="rounded-2xl bg-sand/40 px-4 py-5 text-center text-xs text-muted">
                {t('settings.ownerOnlyRules')}
              </p>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle
              title={t('settings.hoursTitle')}
              subtitle={t('settings.hoursSubtitle')}
              action={
                isOwner ? (
                  <Button size="sm" variant="secondary" onClick={saveHours} loading={savingHours}>
                    {t('settings.saveHours')}
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
                    row.closed ? 'border-border bg-sand/40' : 'border-border bg-surface',
                  )}
                >
                  <span className="w-20 text-[12px] font-semibold text-licorice">
                    {weekdayNameByIndex(row.weekday, locale, 'long')}
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
                      className="h-3.5 w-3.5 accent-[#9C5566]"
                    />
                    {t('settings.open')}
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
                      className="h-8 rounded-xl border border-border bg-alabaster px-2 text-[11px] disabled:opacity-40"
                      aria-label={t('settings.openAria', {
                        day: weekdayNameByIndex(row.weekday, locale, 'long'),
                      })}
                    />
                    <span className="text-[10px] text-muted">{t('settings.timeSeparator')}</span>
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
                      className="h-8 rounded-xl border border-border bg-alabaster px-2 text-[11px] disabled:opacity-40"
                      aria-label={t('settings.closeAria', {
                        day: weekdayNameByIndex(row.weekday, locale, 'long'),
                      })}
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
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-blush-deep">
                <Globe2 size={13} /> {t('settings.publicTitle')}
              </p>
              <p className="mt-2 font-display text-[22px] font-medium leading-tight text-licorice">
                {t('settings.publicClaim')}
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-alabaster px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted">
                  {publicUrl}
                </span>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label={t('settings.copyLinkAria')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted transition hover:text-licorice"
                >
                  {copied ? <Check size={14} className="text-sage" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={copyLink}>
                  <Copy size={14} /> {t('settings.copy')}
                </Button>
                <a href={`/reservar/${business.slug}`} target="_blank" rel="noreferrer">
                  <Button variant="rose" size="sm" className="w-full">
                    <ArrowUpRight size={14} /> {t('settings.openBtn')}
                  </Button>
                </a>
              </div>
              <p className="text-[10.5px] leading-relaxed text-muted">{t('settings.publicHint')}</p>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title={t('settings.mexicoTitle')} subtitle={t('settings.mexicoSubtitle')} />
            <div className="space-y-3">
              {[
                { icon: Percent, title: t('settings.mexicoVat'), text: t('settings.mexicoVatText') },
                { icon: ShieldCheck, title: t('settings.mexicoRfc'), text: t('settings.mexicoRfcText') },
                { icon: Sparkles, title: t('settings.mexicoWa'), text: t('settings.mexicoWaText') },
                { icon: Clock3, title: t('settings.mexicoTz'), text: t('settings.mexicoTzText') },
              ].map((item) => (
                <div key={item.title} className="flex gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sage-soft text-sage">
                    <item.icon size={14} />
                  </span>
                  <div>
                    <p className="text-[11.5px] font-bold text-licorice">{item.title}</p>
                    <p className="text-[10.5px] leading-snug text-muted">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {isOwner ? (
            <Card className="p-4 sm:p-5">
              <SectionTitle
                title={t('settings.auditTitle')}
                subtitle={t('settings.auditSubtitle')}
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
                        <p className="text-[11.5px] font-semibold leading-snug text-licorice">
                          {AUDIT_LABELS[entry.action]
                            ? t(`audit.${entry.action}`)
                            : entry.action}
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
                  {t('settings.auditEmpty')}
                </p>
              )}
            </Card>
          ) : null}

          <Card className="p-4 sm:p-5">
            <SectionTitle title={t('settings.accountTitle')} />
            <form onSubmit={saveAccount} className="space-y-3">
              <Input
                label={t('settings.accountName')}
                value={account.name}
                onChange={(event) => setAccount({ ...account, name: event.target.value })}
              />
              <Input
                label={t('settings.accountPhone')}
                value={account.phone}
                onChange={(event) => setAccount({ ...account, phone: event.target.value })}
                inputMode="tel"
              />
              <Input label={t('settings.accountEmail')} value={user.email} disabled />
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-sand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                  {isOwner ? t('settings.roleOwner') : t('settings.roleStaff')}
                </span>
                <Button type="submit" size="sm" variant="secondary" loading={savingAccount}>
                  {t('settings.save')}
                </Button>
              </div>
            </form>
            <div className="mt-4 border-t border-border/60 pt-3">
              <Button variant="ghost" size="sm" className="w-full text-blush-deep" onClick={signOut}>
                <LogOut size={14} /> {t('settings.signOut')}
              </Button>
            </div>
          </Card>

          <div className="rounded-3xl border border-dashed border-border bg-surface/40 p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold text-licorice">
              <Building2 size={14} className="text-rose" /> {business.name}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
              {business.address ?? t('settings.noAddress')} · {business.neighborhood ?? ''}{' '}
              {business.city ?? ''}
            </p>
            <p className="mt-2 text-[10px] text-muted/70">
              {t('settings.planLine', { currency: business.currency })}
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
