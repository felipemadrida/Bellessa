import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { cn } from '../lib/format'
import type { Client } from '../lib/types'
import { useToast } from './Toast'
import { Button, Input, Modal, Textarea } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  client?: Client | null
  onSaved?: (client: Client) => void
}

const TAG_SUGGESTIONS = ['VIP', 'Color', 'Uñas', 'Novias', 'Recurrente', 'Nueva']

export function ClientFormModal({ open, onClose, client, onSaved }: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthday, setBirthday] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [rfc, setRfc] = useState('')
  const [marketing, setMarketing] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(client?.name ?? '')
    setPhone(client?.phone ?? '')
    setEmail(client?.email ?? '')
    setBirthday(client?.birthday ?? '')
    setTags(client?.tags ?? '')
    setNotes(client?.notes ?? '')
    setRfc(client?.rfc ?? '')
    setMarketing(client?.accepts_marketing ?? true)
    setError(null)
    setSaving(false)
  }, [open, client])

  const selectedTags = tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  function toggleTag(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((item) => item !== tag)
      : [...selectedTags, tag]
    setTags(next.join(', '))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Necesitamos un WhatsApp mexicano de 10 dígitos.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: name.trim(),
      phone,
      email: email.trim() || null,
      birthday: birthday || null,
      tags: tags.trim() || null,
      notes: notes.trim() || null,
      rfc: rfc.trim().toUpperCase() || null,
      accepts_marketing: marketing,
    }
    try {
      const saved = client
        ? await api.clients.update(client.id, payload)
        : await api.clients.create(payload)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['client', saved.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      toast(client ? 'Ficha actualizada' : 'Clienta agregada a tu base')
      onSaved?.(saved)
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar la ficha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Editar ficha' : 'Nueva clienta'}
      subtitle={client ? 'Los detalles que hacen que vuelva.' : 'Solo lo esencial, sin llenar mil campos.'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="rose" type="submit" form="client-form" loading={saving}>
            {client ? 'Guardar cambios' : 'Agregar clienta'}
          </Button>
        </div>
      }
    >
      <form id="client-form" onSubmit={submit} className="space-y-4">
        <Input
          label="Nombre completo"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Fernanda Castillo"
          autoComplete="name"
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="WhatsApp"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="55 1234 5678"
            inputMode="tel"
            autoComplete="tel"
            required
          />
          <Input
            label="Correo (opcional)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="correo@ejemplo.mx"
            type="email"
            autoComplete="email"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Cumpleaños"
            type="date"
            value={birthday}
            onChange={(event) => setBirthday(event.target.value)}
          />
          <Input
            label="RFC (para factura)"
            value={rfc}
            onChange={(event) => setRfc(event.target.value.toUpperCase())}
            placeholder="XAXX010101000"
            maxLength={13}
            hint="Opcional · CFDI 4.0"
          />
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink">Etiquetas</p>
          <div className="flex flex-wrap gap-1.5">
            {TAG_SUGGESTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                  selectedTags.includes(tag)
                    ? 'border-rose bg-rose-soft text-rose-deep'
                    : 'border-line bg-white text-muted hover:border-rose/30',
                )}
              >
                {tag}
              </button>
            ))}
          </div>
          <Input
            className="mt-2"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="VIP, Color, Uñas…"
            aria-label="Etiquetas personalizadas"
          />
        </div>

        <Textarea
          label="Notas y preferencias"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Alergias, tonos favoritos, café, horarios que prefiere…"
        />

        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-line bg-white px-3.5 py-3">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#C2415A]"
          />
          <span className="text-[12px] leading-snug text-muted">
            <span className="font-semibold text-ink">Puedo escribirle por WhatsApp</span>
            <br />
            Para recordatorios, cumpleaños y promociones del salón.
          </span>
        </label>

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
