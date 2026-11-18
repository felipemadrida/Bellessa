import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Bot,
  Check,
  CircleAlert,
  Copy,
  Gift,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Users,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  cn,
  formatDateShort,
  formatTime,
  phoneDisplay,
} from '../lib/format'
import type { MessageLog } from '../lib/types'
import { catalogKeyLabel } from '../lib/vocabulary'
import { usePreferences } from '../lib/preferences'
import { PageHeader } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SectionTitle,
  Skeleton,
  Spinner,
} from '../components/ui'

type ChatMessage = { role: 'user' | 'bot' | 'error'; body: string }

const KIND_LABELS: Record<string, string> = {
  bot: 'Respuesta del bot',
  reminder: 'Recordatorio',
  internal_reception: 'Aviso a recepción',
  handoff: 'Atención humana',
  campaign: 'Campaña',
  marketing: 'Marketing',
}

function statusTone(status: string): string {
  if (status === 'sent' || status === 'mock_sent') return 'bg-sage-soft text-sage'
  if (status === 'failed') return 'bg-blush-soft text-blush-deep'
  if (status === 'skipped') return 'bg-champagne-soft text-champagne-deep'
  return 'bg-sand text-muted'
}

export function WhatsAppPage() {
  const { business, user } = useAuth()
  const { toast } = useToast()
  const { t } = usePreferences()
  const queryClient = useQueryClient()
  const isOwner = user?.role === 'owner'
  const timezone = business?.timezone ?? 'America/Mexico_City'

  const statusQuery = useQuery({ queryKey: ['whatsapp-status'], queryFn: api.whatsapp.status })
  const outboxQuery = useQuery({
    queryKey: ['whatsapp-outbox'],
    queryFn: () => api.whatsapp.outbox(40),
  })
  const templatesQuery = useQuery({
    queryKey: ['marketing-templates'],
    queryFn: api.marketing.templates,
  })
  const segmentsQuery = useQuery({
    queryKey: ['marketing-segments'],
    queryFn: api.marketing.segments,
  })

  const [phone, setPhone] = useState('5512340000')
  const [text, setText] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [templateKey, setTemplateKey] = useState('valley')
  const [segment, setSegment] = useState('all')
  const [campaigning, setCampaigning] = useState(false)
  const [copied, setCopied] = useState(false)

  const templates = templatesQuery.data ?? []
  const segments = segmentsQuery.data ?? []
  const selectedTemplate = templates.find((template) => template.key === templateKey)
  const selectedSegment = segments.find((item) => item.key === segment)
  const status = statusQuery.data
  const outbox = outboxQuery.data ?? []

  const mockMode = status?.provider === 'mock'
  const busy = sending || campaigning

  async function send(message?: string) {
    const body = (message ?? text).trim()
    if (!body || sending) return
    setText('')
    setChat((current) => [...current, { role: 'user', body }])
    setSending(true)
    try {
      const result = await api.whatsapp.mock(phone, body)
      setChat((current) => [
        ...current,
        ...result.replies.map((reply) => ({ role: 'bot' as const, body: reply })),
      ])
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-outbox'] })
    } catch (caught) {
      const messageText = caught instanceof ApiError ? caught.message : t('wa.processError')
      setChat((current) => [...current, { role: 'error', body: messageText }])
      toast(messageText, 'error')
    } finally {
      setSending(false)
    }
  }

  async function runCampaign() {
    if (!isOwner) return
    setCampaigning(true)
    try {
      const result = await api.marketing.campaign(templateKey, segment)
      toast(
        t('wa.campaignToast', { queued: result.queued, skipped: result.skipped }),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['whatsapp-outbox'] }),
        queryClient.invalidateQueries({ queryKey: ['marketing-segments'] }),
      ])
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : t('wa.campaignError'), 'error')
    } finally {
      setCampaigning(false)
    }
  }

  async function copyWebhook() {
    if (!status?.webhook_url) return
    try {
      await navigator.clipboard.writeText(status.webhook_url)
      setCopied(true)
      toast(t('wa.webhookCopied'))
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(t('wa.webhookCopyError'), 'error')
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={t('wa.eyebrow')}
        title={t('wa.title')}
        subtitle={t('wa.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/whatsapp/manual"
              className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-border bg-surface px-3.5 text-[12px] font-semibold text-licorice hover:bg-alabaster"
            >
              <Send size={14} /> {t('wa.manualInbox')}
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: ['whatsapp-outbox'] })
                void statusQuery.refetch()
              }}
            >
              <RefreshCw size={15} /> {t('wa.refresh')}
            </Button>
          </div>
        }
      />

      {status ? (
        <Card className="mb-4 flex flex-col gap-3 border-sage/20 bg-gradient-to-r from-sage-soft/70 to-cream p-4 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sage text-alabaster">
            <MessageCircle size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-licorice">
              {mockMode ? t('wa.mockMode') : t('wa.cloudMode')}
              <span className="ml-2">
                <Badge className={status.configured ? 'bg-sage-soft text-sage' : 'bg-blush-soft text-blush-deep'}>
                  {status.configured ? t('wa.ready') : t('wa.notConfigured')}
                </Badge>
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {mockMode ? t('wa.mockDesc') : t('wa.cloudDesc')}{' '}
              · {status.scheduler_enabled ? t('wa.remindersOn') : t('wa.remindersOff')}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-muted">
            <span className="flex items-center gap-1 rounded-full bg-surface/70 px-2.5 py-1">
              <Users size={12} /> {phoneDisplay(status.bot_phone)}
            </span>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-licorice text-alabaster">
                  <Bot size={16} />
                </span>
                <div>
                  <SectionTitle title={t('wa.simulatorTitle')} subtitle={t('wa.simulatorSubtitle')} />
                </div>
              </div>
              <Badge className="bg-sand text-muted">{t('wa.mock')}</Badge>
            </div>

            <div className="h-72 space-y-3 overflow-y-auto bg-alabaster px-4 py-4">
              {chat.length === 0 ? (
                <EmptyState
                  icon={<MessageCircle size={21} />}
                  title={t('wa.tryFlowTitle')}
                  description={t('wa.tryFlowDesc')}
                  className="py-10"
                />
              ) : (
                chat.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[86%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-sm',
                        message.role === 'user'
                          ? 'rounded-br-md bg-[#DCF8C6] text-[#183A1D]'
                          : message.role === 'error'
                            ? 'rounded-bl-md bg-blush-soft text-blush-deep'
                            : 'rounded-bl-md bg-surface text-licorice',
                      )}
                    >
                      {message.body}
                    </div>
                  </div>
                ))
              )}
              {sending ? (
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Spinner size={13} /> {t('wa.typing')}
                </div>
              ) : null}
            </div>

            <div className="flex gap-1.5 overflow-x-auto border-t border-border/60 px-3 py-2">
              {['Hola', '1', 'SI', 'HUMANO', 'CANCELAR'].map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => void send(command)}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-muted transition hover:border-rose/40 hover:text-licorice disabled:opacity-50"
                >
                  {command}
                </button>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
              className="space-y-2 border-t border-border/60 p-3"
            >
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={t('wa.testPhone')}
                aria-label={t('wa.testPhoneAria')}
                inputMode="tel"
                className="h-9 text-[12px]"
              />
              <div className="flex gap-2">
                <Input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={t('wa.messagePlaceholder')}
                  aria-label={t('wa.messageAria')}
                  disabled={sending}
                  className="h-10"
                />
                <Button type="submit" variant="rose" size="icon" loading={sending} aria-label={t('wa.sendAria')}>
                  <Send size={16} />
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle
              title={t('wa.outboxTitle')}
              subtitle={t('wa.outboxSubtitle', {
                n: outbox.length,
                mode: mockMode ? t('wa.mockNoCost') : t('wa.cloudApi'),
              })}
              action={
                <button
                  type="button"
                  onClick={() => outboxQuery.refetch()}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-sand"
                  aria-label={t('wa.refreshInboxAria')}
                >
                  <RefreshCw size={14} />
                </button>
              }
            />
            {outboxQuery.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-16" />
                ))}
              </div>
            ) : outbox.length ? (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-0.5">
                {outbox.map((log) => (
                  <MessageRow key={log.id} log={log} timezone={timezone} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Send size={19} />}
                title={t('wa.emptyInboxTitle')}
                description={t('wa.emptyInboxDesc')}
                className="py-7"
              />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <SectionTitle
              title={t('wa.marketingTitle')}
              subtitle={t('wa.marketingSubtitle')}
            />

            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              {t('wa.step1')}
            </p>
            {segmentsQuery.isLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {segments.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSegment(item.key)}
                    className={cn(
                      'rounded-2xl border p-2.5 text-left transition',
                      segment === item.key
                        ? 'border-rose bg-blush-soft/60'
                        : 'border-border bg-surface hover:border-rose/30',
                    )}
                  >
                    <p className="text-[11px] font-bold text-licorice">
                      {catalogKeyLabel('wa.seg', item.key, item.label, t)}
                    </p>
                    <p className="text-[10px] text-muted">{t('wa.clientsCount', { n: item.count })}</p>
                  </button>
                ))}
              </div>
            )}

            <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              {t('wa.step2')}
            </p>
            {templatesQuery.isLoading ? (
              <Skeleton className="h-24" />
            ) : (
              <div className="space-y-1.5">
                <select
                  value={templateKey}
                  onChange={(event) => setTemplateKey(event.target.value)}
                  className="h-10 w-full rounded-2xl border border-border bg-surface px-3 text-[12px] font-semibold text-licorice focus:border-rose/50 focus:outline-none"
                  aria-label={t('wa.templateAria')}
                >
                  {templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {catalogKeyLabel('wa.tpl', template.key, template.label, t)}
                    </option>
                  ))}
                </select>
                {selectedTemplate ? (
                  <p className="rounded-2xl bg-sand/40 px-3 py-2 text-[10.5px] leading-relaxed text-muted">
                    {selectedTemplate.description}
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-licorice px-3.5 py-3 text-alabaster">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-alabaster/50">
                  {t('wa.campaign')}
                </p>
                <p className="text-[12px] font-semibold">
                  {selectedTemplate
                    ? catalogKeyLabel('wa.tpl', selectedTemplate.key, selectedTemplate.label, t)
                    : t('wa.selectTemplate')}
                </p>
                <p className="text-[10px] text-alabaster/60">
                  {t('wa.clientsIn', {
                    n: selectedSegment?.count ?? 0,
                    segment: selectedSegment
                      ? catalogKeyLabel('wa.seg', selectedSegment.key, selectedSegment.label, t)
                      : '',
                  })}
                </p>
              </div>
              <Megaphone size={22} className="text-gold" />
            </div>

            <Button
              variant="rose"
              className="mt-3 w-full"
              loading={campaigning}
              disabled={!isOwner || !selectedTemplate || !selectedSegment}
              onClick={runCampaign}
            >
              <Sparkles size={15} /> {t('wa.prepare')}
            </Button>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-muted">
              {isOwner ? t('wa.ownerHint') : t('wa.notOwnerHint')}
            </p>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title={t('wa.connectTitle')} subtitle={t('wa.connectSubtitle')} />
            <div className="space-y-2 text-[11px] text-muted">
              <p className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand text-[9px] font-bold text-licorice">
                  1
                </span>
                {t('wa.connectStep1')}
              </p>
              <p className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand text-[9px] font-bold text-licorice">
                  2
                </span>
                {t('wa.connectStep2')}
              </p>
              <p className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand text-[9px] font-bold text-licorice">
                  3
                </span>
                {t('wa.connectStep3')}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-alabaster px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate text-[9.5px] text-muted">
                {status?.webhook_url ?? t('wa.loadingWebhook')}
              </code>
              <button
                type="button"
                onClick={copyWebhook}
                aria-label={t('wa.copyWebhookAria')}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted hover:text-licorice"
              >
                {copied ? <Check size={13} className="text-sage" /> : <Copy size={13} />}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge className="bg-sand text-muted">
                <Gift size={11} /> {t('wa.templatesCount', { n: templates.length })}
              </Badge>
              <Badge className="bg-sand text-muted">
                <Users size={11} />{' '}
                {t('wa.clientsCount', {
                  n: segments.find((item) => item.key === 'all')?.count ?? 0,
                })}
              </Badge>
            </div>
          </Card>

          <div className="rounded-3xl border border-dashed border-border bg-surface/40 p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold text-licorice">
              <CircleAlert size={14} className="text-gold" /> {t('wa.policyTitle')}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{t('wa.policyBody')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageRow({ log, timezone }: { log: MessageLog; timezone: string }) {
  const { t } = usePreferences()
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-border/70 bg-surface px-3 py-2.5">
      <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', log.status === 'failed' ? 'bg-rose' : log.status === 'skipped' ? 'bg-gold' : 'bg-sage')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-bold text-licorice">
            {catalogKeyLabel('wa.kind', log.kind, KIND_LABELS[log.kind] ?? log.kind, t)}
          </span>
          <Badge className={statusTone(log.status)}>
            {catalogKeyLabel('wa.st', log.status, log.status.replace('_', ' '), t)}
          </Badge>
          <span className="text-[9.5px] text-muted">
            {formatDateShort(log.created_at, timezone)} · {formatTime(log.created_at, timezone)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[10.5px] leading-snug text-muted">
          {log.body}
        </p>
        <p className="mt-0.5 text-[9.5px] text-muted/70">
          {log.client_name ?? phoneDisplay(log.phone)} · {log.provider}
        </p>
      </div>
    </div>
  )
}
