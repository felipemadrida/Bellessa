import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { cn } from '../lib/format'
import { usePreferences } from '../lib/preferences'
import type { Client } from '../lib/types'
import { vocabularyLabel } from '../lib/vocabulary'
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
  const { t } = usePreferences()
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
      setError(t('cfm.errorPhone'))
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
      toast(client ? t('cfm.savedEdit') : t('cfm.savedNew'))
      onSaved?.(saved)
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('cfm.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? t('cfm.titleEdit') : t('cfm.titleNew')}
      subtitle={client ? t('cfm.subtitleEdit') : t('cfm.subtitleNew')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('cfm.cancel')}
          </Button>
          <Button variant="rose" type="submit" form="client-form" loading={saving}>
            {client ? t('cfm.saveChanges') : t('cfm.addClient')}
          </Button>
        </div>
      }
    >
      <form id="client-form" onSubmit={submit} className="space-y-4">
        <Input
          label={t('cfm.fullName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('cfm.namePlaceholder')}
          autoComplete="name"
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('settings.whatsapp')}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="55 1234 5678"
            inputMode="tel"
            autoComplete="tel"
            required
          />
          <Input
            label={t('cfm.email')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('cfm.emailPlaceholder')}
            type="email"
            autoComplete="email"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('cfm.birthday')}
            type="date"
            value={birthday}
            onChange={(event) => setBirthday(event.target.value)}
          />
          <Input
            label={t('cfm.rfc')}
            value={rfc}
            onChange={(event) => setRfc(event.target.value.toUpperCase())}
            placeholder="XAXX010101000"
            maxLength={13}
            hint={t('cfm.rfcHint')}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-licorice">{t('cfm.tags')}</p>
          <div className="flex flex-wrap gap-1.5">
            {TAG_SUGGESTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                  selectedTags.includes(tag)
                    ? 'border-rose bg-blush-soft text-blush-deep'
                    : 'border-border bg-surface text-muted hover:border-rose/30',
                )}
              >
                {vocabularyLabel(tag, t)}
              </button>
            ))}
          </div>
          <Input
            className="mt-2"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder={t('cfm.tagsPlaceholder')}
            aria-label={t('cfm.tagsAria')}
          />
        </div>

        <Textarea
          label={t('cfm.notes')}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t('cfm.notesPlaceholder')}
        />

        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-border bg-surface px-3.5 py-3">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#9C5566]"
          />
          <span className="text-[12px] leading-snug text-muted">
            <span className="font-semibold text-licorice">{t('cfm.marketing')}</span>
            <br />
            {t('cfm.marketingHint')}
          </span>
        </label>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-rose/20 bg-blush-soft px-3.5 py-2.5 text-[12.5px] font-medium text-blush-deep"
          >
            <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        ) : null}
      </form>
    </Modal>
  )
}
