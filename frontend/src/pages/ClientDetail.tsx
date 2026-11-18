import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Cake,
  CalendarPlus,
  Check,
  CircleAlert,
  FileText,
  Heart,
  MessageCircle,
  Pencil,
  Phone,
  ReceiptText,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePreferences } from '../lib/preferences'
import { splitTags, vocabularyLabel } from '../lib/vocabulary'
import {
  birthdayLabel,
  cn,
  formatDateLong,
  formatTime,
  money,
  nextBirthdayDays,
  phoneDisplay,
  todayKey,
} from '../lib/format'
import type { Appointment } from '../lib/types'
import { AppointmentSheet } from '../components/AppointmentSheet'
import { ClientFormModal } from '../components/ClientFormModal'
import { NewAppointmentModal } from '../components/NewAppointmentModal'
import { useToast } from '../components/Toast'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Menu,
  MenuItem,
  ProgressBar,
  SectionTitle,
  Skeleton,
  StatusBadge,
} from '../components/ui'

export function ClientDetailPage() {
  const { id } = useParams()
  const clientId = Number(id)
  const { business } = useAuth()
  const { t } = usePreferences()
  const timezone = business?.timezone ?? 'America/Mexico_City'
  const today = todayKey(timezone)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [editOpen, setEditOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [busy, setBusy] = useState(false)

  const query = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.clients.get(clientId),
    enabled: Number.isFinite(clientId),
  })
  const client = query.data

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 rounded-[28px]" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-3xl" />
          ))}
        </div>
      </div>
    )
  }

  if (query.isError || !client) {
    return (
      <Card>
        <EmptyState
          icon={<CircleAlert size={22} />}
          title={t('cd.notFound')}
          description={t('clients.notFoundDesc')}
          action={
            <Link to="/clientas">
              <Button variant="secondary">{t('page.clients.all')}</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  const tags = splitTags(client.tags)
  const upcoming = [...client.appointments]
    .filter(
      (appointment) =>
        (appointment.status === 'confirmed' || appointment.status === 'pending') &&
        new Date(appointment.start_at) >= new Date(),
    )
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0]
  const birthdayDays = client.birthday ? nextBirthdayDays(client.birthday, today) : null

  async function sendTemplate(template: 'cumpleanos' | 'reactivacion' | 'gracias') {
    setBusy(true)
    const popup = window.open('', '_blank')
    try {
      const result = await api.clients.whatsapp(client!.id, template)
      if (popup) {
        popup.opener = null
        popup.location.href = result.url
      } else {
        window.location.href = result.url
      }
    } catch (caught) {
      popup?.close()
      toast(caught instanceof ApiError ? caught.message : 'No pudimos abrir WhatsApp', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <button
        type="button"
        onClick={() => navigate('/clientas')}
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted transition hover:text-licorice"
      >
        <ArrowLeft size={15} /> {t('page.clients.all')}
      </button>

      <section className="relative overflow-hidden rounded-[28px] border border-border bg-surface/80 p-5 shadow-boutique sm:p-6">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-40 blur-2xl"
          style={{ background: 'radial-gradient(circle, #F0CDD4 0%, transparent 70%)' }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={client.name} color="#9C5566" size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[30px] font-medium leading-tight tracking-[-0.02em] text-licorice sm:text-[36px]">
                  {client.name}
                </h1>
                {birthdayDays !== null && birthdayDays <= 7 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-champagne-soft px-2.5 py-1 text-[10px] font-bold text-champagne-deep">
                    <Cake size={12} /> {t('cd.birthdayChip', { n: birthdayDays })}
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 hover:text-licorice">
                  <Phone size={12} /> {phoneDisplay(client.phone)}
                </a>
                {client.email ? <span>{client.email}</span> : null}
                <span className="text-line">·</span>
                <span>{t('cd.clientSince', { date: formatDateLong(client.created_at, timezone) })}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-sand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted"
                  >
                    {vocabularyLabel(tag, t)}
                  </span>
                ))}
                {!client.accepts_marketing ? (
                  <span className="rounded-full bg-blush-soft px-2.5 py-1 text-[10px] font-semibold text-blush-deep">
                    {t('cd.noPromos')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={15} /> {t('cd.edit')}
            </Button>
            <Menu
              trigger={
                <Button variant="secondary" disabled={busy}>
                  <MessageCircle size={15} /> WhatsApp
                </Button>
              }
            >
              <MenuItem onClick={() => sendTemplate('reactivacion')}>{t('cd.reactivateClient')}</MenuItem>
              <MenuItem onClick={() => sendTemplate('cumpleanos')}>{t('cd.birthdayGreeting')}</MenuItem>
              <MenuItem onClick={() => sendTemplate('gracias')}>{t('cd.thankVisit')}</MenuItem>
            </Menu>
            <Button variant="rose" onClick={() => setNewOpen(true)}>
              <CalendarPlus size={16} /> {t('common.newAppointment')}
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<ReceiptText size={16} />} label={t('cd.statVisits')} value={String(client.stats.visits)} tone="rose" />
        <Stat icon={<Wallet size={16} />} label={t('cd.statSpent')} value={money(client.stats.spent_cents)} tone="sage" />
        <Stat
          icon={<Sparkles size={16} />}
          label={t('cd.statAvgTicket')}
          value={money(client.stats.avg_ticket_cents)}
          tone="gold"
        />
        <Stat
          icon={<Heart size={16} />}
          label={t('cd.statFavorite')}
          value={client.stats.favorite_service ?? '—'}
          tone="ink"
          small
        />
      </div>

      <Card className="mt-3 overflow-hidden border-gold/25">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-gold-soft/70 to-cream p-4 sm:flex-row sm:items-center sm:p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-champagne text-licorice">
            <Sparkles size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-champagne-deep">
                {t('cd.loyalty')}
              </p>
              <Badge
                className={
                  client.stats.loyalty_level === 'vip'
                    ? 'bg-licorice text-gold'
                    : 'bg-surface/70 text-champagne-deep'
                }
              >
                {client.stats.loyalty_level === 'vip'
                  ? vocabularyLabel('VIP', t)
                  : client.stats.loyalty_level === 'frecuente'
                    ? vocabularyLabel('Frecuente', t)
                    : vocabularyLabel('Nueva', t)}
              </Badge>
            </div>
            <p className="mt-1 font-display text-[24px] font-medium leading-none text-licorice">
              {t('cd.points', { n: client.stats.loyalty_points })}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {t('cd.loyaltyRule', { amount: money(client.stats.loyalty_spent_12m_cents) })}
            </p>
            <div className="mt-3 max-w-sm">
              <ProgressBar
                value={
                  client.stats.loyalty_reward_available
                    ? 100
                    : ((5 - client.stats.loyalty_next_reward_in) / 5) * 100
                }
                color="#A8842C"
              />
              <p className="mt-1.5 text-[11px] font-semibold text-champagne-deep">
                {client.stats.loyalty_reward_available
                  ? t('cd.rewardAvailable')
                  : client.stats.loyalty_next_reward_in === 1
                    ? t('cd.rewardIn', { n: client.stats.loyalty_next_reward_in })
                    : t('cd.rewardInPlural', { n: client.stats.loyalty_next_reward_in })}
              </p>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-[10px] uppercase tracking-wider text-muted">{t('cd.visitsCompleted')}</p>
            <p className="font-display text-[28px] font-medium text-licorice">{client.stats.visits}</p>
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {upcoming ? (
            <Card className="overflow-hidden border-sage/25">
              <div className="flex items-center justify-between gap-3 bg-sage-soft/70 px-4 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sage">
                  {t('cd.nextAppointment')}
                </p>
                <StatusBadge status={upcoming.status} />
              </div>
              <button
                type="button"
                onClick={() => setSelected(upcoming)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-sand/30"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-licorice text-alabaster">
                  <span className="text-[9px] font-bold uppercase">
                    {new Intl.DateTimeFormat('es-MX', { timeZone: timezone, month: 'short' })
                      .format(new Date(upcoming.start_at))
                      .replace('.', '')}
                  </span>
                  <span className="font-display text-lg leading-none">
                    {new Intl.DateTimeFormat('es-MX', { timeZone: timezone, day: 'numeric' }).format(
                      new Date(upcoming.start_at),
                    )}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-licorice">{upcoming.service.name}</p>
                  <p className="text-[11.5px] text-muted">
                    {formatDateLong(upcoming.start_at, timezone)} ·{' '}
                    {formatTime(upcoming.start_at, timezone)} · {upcoming.staff.name}
                  </p>
                </div>
                <p className="money text-[13px] font-bold text-licorice">{money(upcoming.price_cents)}</p>
              </button>
            </Card>
          ) : null}

          <Card className="p-4 sm:p-5">
            <SectionTitle
              title={t('cd.history')}
              subtitle={t('cd.historySub', { n: client.appointments.length })}
              action={
                <Button size="sm" variant="ghost" onClick={() => setNewOpen(true)}>
                  <CalendarPlus size={14} /> {t('cd.schedule')}
                </Button>
              }
            />
            {client.appointments.length ? (
              <div className="space-y-1.5">
                {client.appointments.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setSelected(appointment)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-sand/40"
                  >
                    <div className="w-14 shrink-0">
                      <p className="text-[11.5px] font-bold text-licorice">
                        {formatDateShortLocal(appointment.start_at, timezone)}
                      </p>
                      <p className="text-[9.5px] text-muted">
                        {formatTime(appointment.start_at, timezone)}
                      </p>
                    </div>
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: appointment.service.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-licorice">
                        {appointment.service.name}
                      </p>
                      <p className="truncate text-[10.5px] text-muted">
                        {appointment.staff.name}
                        {appointment.payment
                          ? ` · ${money(appointment.payment.amount_cents + appointment.payment.tip_cents)}`
                          : ''}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarPlus size={20} />}
                title={t('cd.noAppointmentsTitle')}
                description={t('cd.noAppointmentsDesc')}
                action={
                  <Button size="sm" variant="secondary" onClick={() => setNewOpen(true)}>
                    {t('common.newAppointment')}
                  </Button>
                }
                className="py-8"
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <SectionTitle title={t('cd.profile')} />
            <div className="space-y-3 text-[12.5px]">
              <InfoRow label={t('cd.birthdayField')}>
                {client.birthday ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-licorice">
                    <Cake size={13} className="text-gold" />
                    {birthdayLabel(client.birthday, timezone)}
                  </span>
                ) : (
                  <span className="text-muted">{t('cd.notRegistered')}</span>
                )}
              </InfoRow>
              <InfoRow label={t('settings.whatsapp')}>
                <a href={`https://wa.me/52${client.phone}`} target="_blank" rel="noreferrer" className="font-semibold text-sage">
                  {phoneDisplay(client.phone)}
                </a>
              </InfoRow>
              <InfoRow label={t('cd.email')}>
                <span className="font-medium text-licorice">{client.email ?? '—'}</span>
              </InfoRow>
              <InfoRow label={t('cd.rfc')}>
                <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-licorice">
                  <FileText size={12} className="text-muted" />
                  {client.rfc ?? t('cd.publicGeneral')}
                </span>
              </InfoRow>
              <InfoRow label={t('cd.promotions')}>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    client.accepts_marketing
                      ? 'bg-sage-soft text-sage'
                      : 'bg-blush-soft text-blush-deep',
                  )}
                >
                  {client.accepts_marketing ? <Check size={11} /> : null}
                  {client.accepts_marketing ? t('cd.accepts') : t('cd.notAccepts')}
                </span>
              </InfoRow>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title={t('cd.notes')} />
            {client.notes ? (
              <p className="whitespace-pre-line rounded-2xl bg-sand/40 px-3.5 py-3 text-[12.5px] leading-relaxed text-licorice">
                {client.notes}
              </p>
            ) : (
              <p className="rounded-2xl bg-sand/40 px-3.5 py-4 text-center text-[12px] text-muted">
                {t('cd.noNotes')}
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setEditOpen(true)}
            >
              <Pencil size={13} /> {t('cd.editNotes')}
            </Button>
          </Card>

          <div className="rounded-3xl border border-dashed border-border bg-surface/40 p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              <MessageCircle size={13} className="text-sage" /> {t('cd.followUp')}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">{t('cd.followUpText')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => sendTemplate('reactivacion')}>
                {t('cd.reactivate')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => sendTemplate('cumpleanos')}>
                {t('cd.birthdayShort')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ClientFormModal open={editOpen} onClose={() => setEditOpen(false)} client={client} />
      <NewAppointmentModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        initialClient={client}
        onCreated={(appointment) => {
          setSelected(appointment)
          queryClient.invalidateQueries({ queryKey: ['client', client.id] })
        }}
      />
      <AppointmentSheet
        open={!!selected}
        appointment={selected}
        onClose={() => setSelected(null)}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['client', client.id] })}
      />
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  tone,
  small = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'rose' | 'sage' | 'gold' | 'ink'
  small?: boolean
}) {
  const tones = {
    rose: 'bg-blush-soft text-blush-deep',
    sage: 'bg-sage-soft text-sage',
    gold: 'bg-champagne-soft text-champagne-deep',
    ink: 'bg-sand text-licorice',
  }
  return (
    <Card className="p-4">
      <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl', tones[tone])}>
        {icon}
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate font-display font-medium leading-tight text-licorice',
          small ? 'text-[15px]' : 'text-[22px]',
        )}
      >
        {value}
      </p>
    </Card>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2.5 last:border-0 last:pb-0">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  )
}

function formatDateShortLocal(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    day: '2-digit',
    month: 'short',
  })
    .format(new Date(iso))
    .replace('.', '')
}
