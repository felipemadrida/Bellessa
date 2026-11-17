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
  if (status === 'failed') return 'bg-rose-soft text-rose-deep'
  if (status === 'opened' || status === 'prepared') return 'bg-gold-soft text-[#7A5A18]'
  return 'bg-sand text-muted'
}

export function ManualWhatsAppPage() {
  const { business } = useAuth()
  const timezone = business?.timezone ?? 'America/Mexico_City'
  const { toast } = useToast()
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
  const templatesQuery = useQuery({
    queryKey: ['marketing-templates'],
    queryFn: api.marketing.templates,
  })
  const manualQuery = useQuery({
    queryKey: ['whatsapp-manual'],
    queryFn: api.whatsapp.manual.list,
  })

  const appointments = appointmentsQuery.data ?? []
  const templates = templatesQuery.data ?? []
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
      toast('Selecciona una cita para preparar el mensaje', 'error')
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
      toast('Mensaje preparado en la bandeja manual')
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos preparar el mensaje', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function action(message: ManualMessage, kind: 'opened' | 'confirm' | 'failed') {
    setBusyId(message.id)
    try {
      if (kind === 'failed') {
        const reason = window.prompt('Motivo por el que no se envió (opcional):') ?? undefined
        await api.whatsapp.manual.failed(message.id, reason)
        toast('Marcado como fallido; no se registrará como enviado')
      } else if (kind === 'confirm') {
        await api.whatsapp.manual.confirm(message.id)
        toast('Envío confirmado por el operador')
      } else {
        await api.whatsapp.manual.opened(message.id)
        toast('Abierto en WhatsApp; confirma el envío al terminar')
      }
      await refresh()
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos actualizar el mensaje', 'error')
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
      toast('Mensaje copiado')
    } catch {
      toast('No pudimos copiar el mensaje', 'error')
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="WhatsApp sin API"
        title="Bandeja manual"
        subtitle="Prepara mensajes con datos reales, abre WhatsApp y confirma el envío. Abrir el chat no significa que el mensaje se haya enviado."
        actions={
          <Link
            to="/whatsapp"
            className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-line bg-white px-3.5 text-[12px] font-semibold text-ink hover:bg-[#FCFAF7]"
          >
            <ArrowLeft size={14} /> Volver
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-medium text-ink">Preparar mensaje</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                La app registra el mensaje, pero el envío lo haces tú.
              </p>
            </div>
            <Badge className="bg-gold-soft text-[#7A5A18]">
              <MessageCircle size={11} /> Manual
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Fecha de citas"
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  setAppointmentId('')
                }}
              />
              <Select
                label="Plantilla"
                value={templateKey}
                onChange={(event) => setTemplateKey(event.target.value)}
              >
                <option value="reminder_24h">Recordatorio 24 h</option>
                <option value="reminder_2h">Recordatorio 2 h</option>
                <option value="birthday">Cumpleaños</option>
                <option value="review">Solicitar reseña</option>
                <option value="winback_30">Reactivación</option>
              </Select>
            </div>

            <Select
              label="Cita"
              value={appointmentId}
              onChange={(event) => setAppointmentId(event.target.value)}
              hint={
                !appointments.length && !appointmentsQuery.isLoading
                  ? 'No hay citas para esta fecha. Cambia la fecha o agenda una cita.'
                  : undefined
              }
            >
              <option value="">Selecciona una cita…</option>
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {formatTime(appointment.start_at, timezone)} · {appointment.client.name} ·{' '}
                  {appointment.service.name}
                </option>
              ))}
            </Select>

            <Textarea
              label="Mensaje personalizado (opcional)"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Si lo dejas vacío, se usa la plantilla con los datos de la cita."
            />

            <Button
              variant="rose"
              className="w-full"
              onClick={createMessage}
              loading={saving}
              disabled={!appointments.length}
            >
              <Send size={14} /> Preparar en bandeja
            </Button>
            <p className="text-[10px] leading-relaxed text-muted">
              El mensaje queda <strong>pendiente</strong>. Al abrir WhatsApp pasa a{' '}
              <strong>abierto</strong> y solo se marca <strong>confirmado</strong> cuando el
              operador lo confirma.
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-display text-xl font-medium text-ink">Cola manual</h2>
              <p className="text-[11px] text-muted">
                {counts.pending} pendientes · {counts.confirmed} confirmados · {counts.failed}{' '}
                fallidos
              </p>
            </div>
            <button
              type="button"
              onClick={() => manualQuery.refetch()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-muted transition hover:text-ink"
              aria-label="Actualizar cola manual"
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
            <div className="divide-y divide-line/60">
              {messages.map((message) => (
                <div key={message.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-bold text-ink">
                      {message.client_name ?? message.phone}
                    </p>
                    <Badge className={statusTone(message.status)}>
                      {STATUS_LABEL[message.status] ?? message.status}
                    </Badge>
                    <span className="text-[10px] text-muted">
                      {message.template_key ?? 'manual'}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-muted">
                    {message.body}
                  </p>
                  {message.error ? (
                    <p className="mt-1 text-[10px] font-medium text-rose-deep">{message.error}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <a
                      href={message.wa_url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void markOpened(message)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-line bg-white px-2.5 text-[10.5px] font-semibold text-ink hover:border-sage/40"
                    >
                      <ExternalLink size={12} /> Abrir WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => copyBody(message)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-line bg-white px-2.5 text-[10.5px] font-semibold text-muted hover:text-ink"
                    >
                      <ClipboardCopy size={12} /> Copiar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === message.id || message.status === 'confirmed'}
                      onClick={() => action(message, 'confirm')}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-sage/30 bg-sage-soft px-2.5 text-[10.5px] font-semibold text-sage disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === message.id ? <Spinner size={12} /> : <Check size={12} />}
                      Confirmar envío
                    </button>
                    <button
                      type="button"
                      disabled={busyId === message.id || message.status === 'failed'}
                      onClick={() => action(message, 'failed')}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose/20 bg-rose-soft px-2.5 text-[10.5px] font-semibold text-rose-deep disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={12} /> No enviado
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={<MessageCircle size={22} />}
                title="Sin mensajes manuales"
                description="Selecciona una cita y prepara el primer recordatorio. Nada se envía automáticamente."
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
