import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Send,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatTime } from '../lib/format'
import { usePreferences } from '../lib/preferences'
import { catalogKeyLabel } from '../lib/vocabulary'
import { PageHeader } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Spinner,
  Textarea,
} from '../components/ui'
import type { ManualMessage } from '../lib/types'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  prepared: 'Preparado',
  opened: 'Abierto',
  confirmed: 'Confirmado',
  failed: 'Fallido',
}

function statusTone(status: string): string {
  if (status === 'confirmed') return 'bg-sage-soft text-sage'
  if (status === 'failed') return 'bg-blush-soft text-blush-deep'
  if (status === 'opened' || status === 'prepared') return 'bg-champagne-soft text-champagne-deep'
  return 'bg-sand text-muted'
}

export function ManualWhatsAppPage() {
  const { business } = useAuth()
  const timezone = business?.timezone ?? 'America/Mexico_City'
  const { toast } = useToast()
  const { t } = usePreferences()
  const queryClient = useQueryClient()
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()),
  )
  const [appointmentId, setAppointmentId] = useState('')
  const [templateKey, setTemplateKey] = useState('reminder_24h')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', date],
    queryFn: () => api.appointments.list(date),
  })
  const manualQuery = useQuery({
    queryKey: ['whatsapp-manual'],
    queryFn: api.whatsapp.manual.list,
  })

  const appointments = appointmentsQuery.data ?? []
  const messages = manualQuery.data ?? []

  const counts = useMemo(() => {
    return messages.reduce(
      (acc, message) => {
        acc.total += 1
        if (message.status === 'confirmed') acc.confirmed += 1
        else if (message.status === 'failed') acc.failed += 1
        else acc.pending += 1
        return acc
      },
      { total: 0, confirmed: 0, failed: 0, pending: 0 },
    )
  }, [messages])

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ['whatsapp-manual'] })
  }

  async function createMessage() {
    const selected = Number(appointmentId)
    if (!selected) {
      toast(t('manual.selectAppointmentError'), 'error')
      return
    }
    setSaving(true)
    try {
      await api.whatsapp.manual.create({
        appointment_id: selected,
        template_key: templateKey,
        body: body.trim() || null,
      })
      setBody('')
      await refresh()
      toast(t('manual.prepared'))
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : t('manual.prepareError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function action(message: ManualMessage, kind: 'opened' | 'confirm' | 'failed') {
    setBusyId(message.id)
    try {
      if (kind === 'failed') {
        const reason = window.prompt(t('manual.failedReasonPrompt')) ?? undefined
        await api.whatsapp.manual.failed(message.id, reason)
        toast(t('manual.failedToast'))
      } else if (kind === 'confirm') {
        await api.whatsapp.manual.confirm(message.id)
        toast(t('manual.confirmedToast'))
      } else {
        await api.whatsapp.manual.opened(message.id)
        toast(t('manual.openedToast'))
      }
      await refresh()
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : t('manual.updateError'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function markOpened(message: ManualMessage) {
    if (message.status === 'pending' || message.status === 'prepared') {
      try {
        await api.whatsapp.manual.opened(message.id)
        await refresh()
      } catch {
        // El enlace ya se abrió; no bloqueamos al operador por el registro.
      }
    }
  }

  async function copyBody(message: ManualMessage) {
    try {
      await navigator.clipboard.writeText(message.body)
      toast(t('manual.copied'))
    } catch {
      toast(t('manual.copyError'), 'error')
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={t('manual.eyebrow')}
        title={t('manual.title')}
        subtitle={t('manual.subtitle')}
        actions={
          <Link
            to="/whatsapp"
            className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-border bg-surface px-3.5 text-[12px] font-semibold text-licorice hover:bg-alabaster"
          >
            <ArrowLeft size={14} /> {t('manual.back')}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-medium text-licorice">{t('manual.prepareTitle')}</h2>
              <p className="mt-0.5 text-[11px] text-muted">{t('manual.prepareDesc')}</p>
            </div>
            <Badge className="bg-champagne-soft text-champagne-deep">
              <MessageCircle size={11} /> {t('manual.manual')}
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={t('manual.dateLabel')}
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  setAppointmentId('')
                }}
              />
              <Select
                label={t('manual.templateLabel')}
                value={templateKey}
                onChange={(event) => setTemplateKey(event.target.value)}
              >
                <option value="reminder_24h">{t('manual.tplReminder24')}</option>
                <option value="reminder_2h">{t('manual.tplReminder2')}</option>
                <option value="birthday">{t('manual.tplBirthday')}</option>
                <option value="review">{t('manual.tplReview')}</option>
                <option value="winback_30">{t('manual.tplWinback30')}</option>
              </Select>
            </div>

            <Select
              label={t('manual.appointmentLabel')}
              value={appointmentId}
              onChange={(event) => setAppointmentId(event.target.value)}
              hint={
                !appointments.length && !appointmentsQuery.isLoading
                  ? t('manual.noAppointments')
                  : undefined
              }
            >
              <option value="">{t('manual.selectAppointment')}</option>
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {formatTime(appointment.start_at, timezone)} · {appointment.client.name} ·{' '}
                  {appointment.service.name}
                </option>
              ))}
            </Select>

            <Textarea
              label={t('manual.customBody')}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t('manual.customBodyPlaceholder')}
            />

            <Button
              variant="rose"
              className="w-full"
              onClick={createMessage}
              loading={saving}
              disabled={!appointments.length}
            >
              <Send size={14} /> {t('manual.prepareInbox')}
            </Button>
            <p className="text-[10px] leading-relaxed text-muted">{t('manual.pendingNote')}</p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-display text-xl font-medium text-licorice">{t('manual.queueTitle')}</h2>
              <p className="text-[11px] text-muted">
                {t('manual.queueCounts', {
                  p: counts.pending,
                  c: counts.confirmed,
                  f: counts.failed,
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => manualQuery.refetch()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:text-licorice"
              aria-label={t('manual.refreshAria')}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {manualQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1].map((item) => (
                <Skeleton key={item} className="h-28" />
              ))}
            </div>
          ) : messages.length ? (
            <div className="divide-y divide-border/60">
              {messages.map((message) => (
                <div key={message.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-bold text-licorice">
                      {message.client_name ?? message.phone}
                    </p>
                    <Badge className={statusTone(message.status)}>
                      {catalogKeyLabel(
                        'manual.status',
                        message.status,
                        STATUS_LABEL[message.status] ?? message.status,
                        t,
                      )}
                    </Badge>
                    <span className="text-[10px] text-muted">
                      {message.template_key ?? 'manual'}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-muted">
                    {message.body}
                  </p>
                  {message.error ? (
                    <p className="mt-1 text-[10px] font-medium text-blush-deep">{message.error}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <a
                      href={message.wa_url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void markOpened(message)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-border bg-surface px-2.5 text-[10.5px] font-semibold text-licorice hover:border-sage/40"
                    >
                      <ExternalLink size={12} /> {t('manual.openWhatsapp')}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyBody(message)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-border bg-surface px-2.5 text-[10.5px] font-semibold text-muted hover:text-licorice"
                    >
                      <ClipboardCopy size={12} /> {t('manual.copy')}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === message.id || message.status === 'confirmed'}
                      onClick={() => action(message, 'confirm')}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-sage/30 bg-sage-soft px-2.5 text-[10.5px] font-semibold text-sage disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === message.id ? <Spinner size={12} /> : <Check size={12} />}
                      {t('manual.confirmSend')}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === message.id || message.status === 'failed'}
                      onClick={() => action(message, 'failed')}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose/20 bg-blush-soft px-2.5 text-[10.5px] font-semibold text-blush-deep disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={12} /> {t('manual.notSent')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={<MessageCircle size={22} />}
                title={t('manual.emptyTitle')}
                description={t('manual.emptyDesc')}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
