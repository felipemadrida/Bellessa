import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  if (status === 'failed') return 'bg-rose-soft text-rose-deep'
  if (status === 'skipped') return 'bg-gold-soft text-[#7A5A18]'
  return 'bg-sand text-muted'
}

export function WhatsAppPage() {
  const { business, user } = useAuth()
  const { toast } = useToast()
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
      const messageText = caught instanceof ApiError ? caught.message : 'No pudimos procesar el mensaje.'
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
        `${result.queued} mensaje${result.queued === 1 ? '' : 's'} preparado${
          result.queued === 1 ? '' : 's'
        } · ${result.skipped} omitido${result.skipped === 1 ? '' : 's'}`,
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['whatsapp-outbox'] }),
        queryClient.invalidateQueries({ queryKey: ['marketing-segments'] }),
      ])
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos preparar la campaña', 'error')
    } finally {
      setCampaigning(false)
    }
  }

  async function copyWebhook() {
    if (!status?.webhook_url) return
    try {
      await navigator.clipboard.writeText(status.webhook_url)
      setCopied(true)
      toast('Webhook copiado')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('No pudimos copiar el webhook', 'error')
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Conversación y retención"
        title="WhatsApp & marketing"
        subtitle="Bot de citas, bandeja de mensajes y campañas automáticas para que tu agenda se llene sola."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['whatsapp-outbox'] })
              void statusQuery.refetch()
            }}
          >
            <RefreshCw size={15} /> Actualizar
          </Button>
        }
      />

      {status ? (
        <Card className="mb-4 flex flex-col gap-3 border-sage/20 bg-gradient-to-r from-sage-soft/70 to-cream p-4 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sage text-cream">
            <MessageCircle size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink">
              {mockMode ? 'Modo simulador local' : 'WhatsApp Cloud API conectada'}
              <span className="ml-2">
                <Badge className={status.configured ? 'bg-sage-soft text-sage' : 'bg-rose-soft text-rose-deep'}>
                  {status.configured ? 'Listo' : 'Falta configuración'}
                </Badge>
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {mockMode
                ? 'Los mensajes se registran en la bandeja y no salen a Meta. Perfecto para demo y pruebas.'
                : 'Los mensajes se envían por Meta. Para iniciar conversación necesitas plantillas aprobadas.'}{' '}
              · Recordatorios programados: {status.scheduler_enabled ? 'activos' : 'apagados'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-muted">
            <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1">
              <Users size={12} /> {phoneDisplay(status.bot_phone)}
            </span>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-cream">
                  <Bot size={16} />
                </span>
                <div>
                  <SectionTitle title="Simulador del bot" subtitle="Así conversa una clienta contigo." />
                </div>
              </div>
              <Badge className="bg-sand text-muted">Mock</Badge>
            </div>

            <div className="h-72 space-y-3 overflow-y-auto bg-[#F6F1EA] px-4 py-4">
              {chat.length === 0 ? (
                <EmptyState
                  icon={<MessageCircle size={21} />}
                  title="Prueba el flujo completo"
                  description='Escribe "Hola" para ver servicios, elegir día y confirmar una cita.'
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
                            ? 'rounded-bl-md bg-rose-soft text-rose-deep'
                            : 'rounded-bl-md bg-white text-ink',
                      )}
                    >
                      {message.body}
                    </div>
                  </div>
                ))
              )}
              {sending ? (
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Spinner size={13} /> Escribiendo…
                </div>
              ) : null}
            </div>

            <div className="flex gap-1.5 overflow-x-auto border-t border-line/60 px-3 py-2">
              {['Hola', '1', 'SI', 'HUMANO', 'CANCELAR'].map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => void send(command)}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-semibold text-muted transition hover:border-rose/40 hover:text-ink disabled:opacity-50"
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
              className="space-y-2 border-t border-line/60 p-3"
            >
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Teléfono de prueba (10 dígitos)"
                aria-label="Teléfono de prueba"
                inputMode="tel"
                className="h-9 text-[12px]"
              />
              <div className="flex gap-2">
                <Input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Escribe como clienta…"
                  aria-label="Mensaje para el bot"
                  disabled={sending}
                  className="h-10"
                />
                <Button type="submit" variant="rose" size="icon" loading={sending} aria-label="Enviar mensaje">
                  <Send size={16} />
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle
              title="Bandeja de salida"
              subtitle={`${outbox.length} mensajes recientes · ${mockMode ? 'mock, sin costo' : 'Cloud API'}`}
              action={
                <button
                  type="button"
                  onClick={() => outboxQuery.refetch()}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-sand"
                  aria-label="Actualizar bandeja"
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
                title="La bandeja está vacía"
                description="Los recordatorios y campañas aparecerán aquí."
                className="py-7"
              />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <SectionTitle
              title="Marketing por datos"
              subtitle="Elige un segmento y una plantilla. Nada se envía sin consentimiento."
            />

            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              1. Segmento
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
                        ? 'border-rose bg-rose-soft/60'
                        : 'border-line bg-white hover:border-rose/30',
                    )}
                  >
                    <p className="text-[11px] font-bold text-ink">{item.label}</p>
                    <p className="text-[10px] text-muted">{item.count} clientas</p>
                  </button>
                ))}
              </div>
            )}

            <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              2. Plantilla
            </p>
            {templatesQuery.isLoading ? (
              <Skeleton className="h-24" />
            ) : (
              <div className="space-y-1.5">
                <select
                  value={templateKey}
                  onChange={(event) => setTemplateKey(event.target.value)}
                  className="h-10 w-full rounded-2xl border border-line bg-white px-3 text-[12px] font-semibold text-ink focus:border-rose/50 focus:outline-none"
                  aria-label="Plantilla de campaña"
                >
                  {templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.label}
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

            <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-ink px-3.5 py-3 text-cream">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-cream/50">Campaña</p>
                <p className="text-[12px] font-semibold">
                  {selectedTemplate?.label ?? 'Selecciona plantilla'}
                </p>
                <p className="text-[10px] text-cream/60">
                  {selectedSegment?.count ?? 0} clientas en {selectedSegment?.label ?? 'el segmento'}
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
              <Sparkles size={15} /> Preparar campaña
            </Button>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-muted">
              {isOwner
                ? 'En modo mock queda en la bandeja. En Cloud API se envían mensajes; usa plantillas aprobadas por Meta.'
                : 'Solo la persona dueña puede lanzar campañas.'}
            </p>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title="Conectar Meta" subtitle="WhatsApp Cloud API real." />
            <div className="space-y-2 text-[11px] text-muted">
              <p className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand text-[9px] font-bold text-ink">
                  1
                </span>
                Crea una app en Meta for Developers → WhatsApp → Configuration.
              </p>
              <p className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand text-[9px] font-bold text-ink">
                  2
                </span>
                Configura el webhook y el verify token en tu `.env`.
              </p>
              <p className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand text-[9px] font-bold text-ink">
                  3
                </span>
                Aprueba plantillas para mensajes iniciados por el negocio y activa
                `WHATSAPP_PROVIDER=cloud`.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-cream px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate text-[9.5px] text-muted">
                {status?.webhook_url ?? 'Cargando webhook…'}
              </code>
              <button
                type="button"
                onClick={copyWebhook}
                aria-label="Copiar webhook"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-muted hover:text-ink"
              >
                {copied ? <Check size={13} className="text-sage" /> : <Copy size={13} />}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge className="bg-sand text-muted">
                <Gift size={11} /> {templates.length} plantillas
              </Badge>
              <Badge className="bg-sand text-muted">
                <Users size={11} /> {segments.find((item) => item.key === 'all')?.count ?? 0} clientas
              </Badge>
            </div>
          </Card>

          <div className="rounded-3xl border border-dashed border-line bg-white/40 p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold text-ink">
              <CircleAlert size={14} className="text-gold" /> Política de Meta
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
              Los recordatorios transaccionales y las campañas respetan el consentimiento de la
              clienta. Para iniciar conversación fuera de la ventana de 24 h se necesitan plantillas
              aprobadas; el simulador local es el modo seguro para pruebas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageRow({ log, timezone }: { log: MessageLog; timezone: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-line/70 bg-white px-3 py-2.5">
      <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', log.status === 'failed' ? 'bg-rose' : log.status === 'skipped' ? 'bg-gold' : 'bg-sage')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-bold text-ink">
            {KIND_LABELS[log.kind] ?? log.kind}
          </span>
          <Badge className={statusTone(log.status)}>{log.status.replace('_', ' ')}</Badge>
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
