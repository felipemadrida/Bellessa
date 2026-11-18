import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Boxes,
  Package,
  Pencil,
  Plus,
  Power,
  Search,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { activeMoneyConfig, money } from '../lib/format'
import { usePreferences } from '../lib/preferences'
import { PageHeader } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from '../components/ui'
import type { Product, ProductCreate, ProductUpdate } from '../lib/types'

function toCents(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function fromCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function InventoryPage() {
  const { toast } = useToast()
  const { t } = usePreferences()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [movementProduct, setMovementProduct] = useState<Product | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const productsQuery = useQuery({
    queryKey: ['inventory-products', search, lowOnly],
    queryFn: () => api.inventory.products({ q: search || undefined, low_stock: lowOnly }),
  })
  const summaryQuery = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: api.inventory.summary,
  })

  const products = productsQuery.data ?? []
  const summary = summaryQuery.data

  function refresh() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] }),
    ])
  }

  async function deactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      await api.inventory.deactivateProduct(deactivateTarget.id)
      await refresh()
      toast('Producto desactivado; su historial se conserva')
      setDeactivateTarget(null)
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos desactivar el producto', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={t('inventory.eyebrow')}
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        actions={
          <Button variant="rose" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus size={15} /> {t('inventory.newProduct')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={<Package size={16} />}
          label={t('inventory.activeProducts')}
          value={String(summary?.active_products ?? 0)}
          hint={t('inventory.totalHint', { n: summary?.products ?? 0 })}
          tone="ink"
        />
        <SummaryCard
          icon={<AlertTriangle size={16} />}
          label={t('inventory.lowStock')}
          value={String(summary?.low_stock ?? 0)}
          hint={t('inventory.lowStockHint')}
          tone="rose"
        />
        <SummaryCard
          icon={<Boxes size={16} />}
          label={t('inventory.units')}
          value={String(summary?.stock_units ?? 0)}
          hint={t('inventory.unitsHint')}
          tone="sage"
        />
        <SummaryCard
          icon={<Wallet size={16} />}
          label={t('inventory.inventoryValue')}
          value={money(summary?.inventory_value_cents ?? 0)}
          hint={t('inventory.valueHint')}
          tone="gold"
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-display text-xl font-medium text-licorice">
              {t('inventory.productsTitle')}
            </h2>
            <p className="text-[11px] text-muted">{t('inventory.visible', { n: products.length })}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setLowOnly((value) => !value)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-2xl border px-3 text-[11px] font-semibold transition ${
                lowOnly
                  ? 'border-rose bg-blush-soft text-blush-deep'
                  : 'border-border bg-surface text-muted hover:text-licorice'
              }`}
            >
              <AlertTriangle size={13} /> {t('inventory.lowStock')}
            </button>
            <Input
              placeholder={t('inventory.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leading={<Search size={15} />}
              aria-label={t('inventory.searchAria')}
              className="h-10 sm:w-72"
            />
          </div>
        </div>

        {productsQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-20" />
            ))}
          </div>
        ) : products.length ? (
          <div className="divide-y divide-border/60">
            {products.map((product) => {
              const low = product.stock <= product.min_stock
              return (
                <div
                  key={product.id}
                  className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[1.5fr_.7fr_.8fr_auto] lg:items-center"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sand text-licorice">
                      <Package size={17} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13.5px] font-bold text-licorice">{product.name}</p>
                        {low ? (
                          <Badge className="bg-blush-soft text-blush-deep">
                            <AlertTriangle size={10} /> {t('inventory.lowStock')}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] text-muted">
                        {product.sku ?? t('inventory.noSku')} · {product.category} · {product.unit}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">{t('inventory.stock')}</p>
                    <p className={`money text-[16px] font-bold ${low ? 'text-blush-deep' : 'text-licorice'}`}>
                      {product.stock}
                      <span className="ml-1 text-[10px] font-normal text-muted">
                        {t('inventory.minShort', { n: product.min_stock })}
                      </span>
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">{t('inventory.price')}</p>
                    <p className="money text-[14px] font-semibold text-licorice">
                      {money(product.price_cents)}
                    </p>
                    <p className="text-[10px] text-muted">
                      {t('inventory.cost', { amount: money(product.cost_cents) })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setMovementProduct(product)}
                    >
                      <SlidersHorizontal size={12} /> {t('inventory.movement')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setEditing(product); setFormOpen(true) }}
                      aria-label={t('inventory.editAria', { name: product.name })}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-licorice"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeactivateTarget(product)}
                      aria-label={t('inventory.deactivateAria', { name: product.name })}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-blush-deep"
                    >
                      <Power size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={<Package size={22} />}
              title={
                search || lowOnly ? t('inventory.emptySearchTitle') : t('inventory.emptyTitle')
              }
              description={
                search || lowOnly
                  ? t('inventory.emptySearchDesc')
                  : t('inventory.emptyDesc')
              }
              action={
                !search && !lowOnly ? (
                  <Button variant="rose" onClick={() => setFormOpen(true)}>
                    <Plus size={14} /> {t('inventory.newProduct')}
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
      </Card>

      <ProductFormModal
        open={formOpen}
        editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSaved={() => { setFormOpen(false); setEditing(null); void refresh() }}
      />

      <MovementModal
        product={movementProduct}
        onClose={() => setMovementProduct(null)}
        onSaved={() => { setMovementProduct(null); void refresh() }}
      />

      <Modal
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title={t('inventory.deactivateTitle')}
        subtitle={deactivateTarget?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>
              {t('inventory.cancel')}
            </Button>
            <Button variant="danger" onClick={deactivate} loading={deactivating}>
              <Power size={14} /> {t('inventory.deactivate')}
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">{t('inventory.deactivateBody')}</p>
      </Modal>
    </div>
  )
}

function SummaryCard({
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
    ink: 'bg-sand text-licorice',
    gold: 'bg-champagne-soft text-champagne-deep',
    sage: 'bg-sage-soft text-sage',
    rose: 'bg-blush-soft text-blush-deep',
  }
  return (
    <Card className="p-4">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}>
        {icon}
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="money mt-0.5 font-display text-[24px] font-medium leading-none text-licorice">{value}</p>
      <p className="mt-1 text-[10px] text-muted">{hint}</p>
    </Card>
  )
}

function ProductFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean
  editing: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const { t } = usePreferences()
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: 'General',
    unit: 'pieza',
    price: '0.00',
    cost: '0.00',
    stock: '0',
    min_stock: '0',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setForm({
        name: editing.name,
        sku: editing.sku ?? '',
        category: editing.category,
        unit: editing.unit,
        price: fromCents(editing.price_cents),
        cost: fromCents(editing.cost_cents),
        stock: String(editing.stock),
        min_stock: String(editing.min_stock),
        description: editing.description ?? '',
      })
    } else {
      setForm({
        name: '',
        sku: '',
        category: 'General',
        unit: 'pieza',
        price: '0.00',
        cost: '0.00',
        stock: '0',
        min_stock: '0',
        description: '',
      })
    }
  }, [open, editing])

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        const payload: ProductUpdate = {
          name: form.name,
          sku: form.sku || null,
          category: form.category,
          unit: form.unit,
          price_cents: toCents(form.price),
          cost_cents: toCents(form.cost),
          min_stock: Number(form.min_stock) || 0,
          description: form.description || null,
        }
        await api.inventory.updateProduct(editing.id, payload)
        toast(t('inventory.savedUpdate'))
      } else {
        const payload: ProductCreate = {
          name: form.name,
          sku: form.sku || null,
          category: form.category,
          unit: form.unit,
          price_cents: toCents(form.price),
          cost_cents: toCents(form.cost),
          stock: Number(form.stock) || 0,
          min_stock: Number(form.min_stock) || 0,
          description: form.description || null,
        }
        await api.inventory.createProduct(payload)
        toast(t('inventory.savedCreate'))
      }
      onSaved()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('inventory.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('inventory.formTitleEdit') : t('inventory.formTitleNew')}
      subtitle={
        editing
          ? editing.name
          : t('inventory.formSubtitleNew', { currency: activeMoneyConfig().currency })
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('inventory.cancel')}</Button>
          <Button type="submit" form="product-form" variant="rose" loading={saving}>
            {editing ? t('inventory.saveChanges') : t('inventory.createProduct')}
          </Button>
        </div>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('inventory.name')} value={form.name} onChange={(event) => set('name', event.target.value)} required />
          <Input label={t('inventory.sku')} value={form.sku} onChange={(event) => set('sku', event.target.value)} placeholder={t('inventory.optional')} />
          <Input label={t('inventory.category')} value={form.category} onChange={(event) => set('category', event.target.value)} />
          <Input label={t('inventory.unit')} value={form.unit} onChange={(event) => set('unit', event.target.value)} placeholder={t('inventory.unitPlaceholder')} />
          <Input label={t('inventory.priceLabel', { currency: activeMoneyConfig().currency })} type="number" min="0" step="0.01" value={form.price} onChange={(event) => set('price', event.target.value)} />
          <Input label={t('inventory.costLabel', { currency: activeMoneyConfig().currency })} type="number" min="0" step="0.01" value={form.cost} onChange={(event) => set('cost', event.target.value)} />
          {!editing ? (
            <Input label={t('inventory.initialStock')} type="number" min="0" step="1" value={form.stock} onChange={(event) => set('stock', event.target.value)} />
          ) : null}
          <Input label={t('inventory.minStock')} type="number" min="0" step="1" value={form.min_stock} onChange={(event) => set('min_stock', event.target.value)} />
        </div>
        <Textarea label={t('inventory.description')} value={form.description} onChange={(event) => set('description', event.target.value)} />
        {error ? (
          <div role="alert" className="rounded-2xl border border-rose/20 bg-blush-soft px-3.5 py-2.5 text-[12.5px] font-medium text-blush-deep">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  )
}

function MovementModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const { t } = usePreferences()
  const [kind, setKind] = useState<'in' | 'out' | 'adjustment'>('in')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!product) return
    setKind('in')
    setQuantity('1')
    setReason('')
    setError(null)
  }, [product])

  const numeric = Number(quantity) || 0
  const preview = product ? product.stock + (kind === 'out' ? -numeric : numeric) : 0

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!product) return
    setSaving(true)
    setError(null)
    try {
      await api.inventory.movement(product.id, {
        kind,
        quantity: numeric,
        reason: reason.trim() || undefined,
      })
      toast(t('inventory.movedToast'))
      onSaved()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('inventory.moveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title={t('inventory.movementTitle')}
      subtitle={
        product
          ? t('inventory.movementSubtitle', { name: product.name, stock: product.stock })
          : undefined
      }
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('inventory.cancel')}</Button>
          <Button type="submit" form="movement-form" variant="rose" loading={saving}>
            {t('inventory.register')}
          </Button>
        </div>
      }
    >
      <form id="movement-form" onSubmit={submit} className="space-y-3">
        <Select label={t('inventory.type')} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="in">{t('inventory.kindIn')}</option>
          <option value="out">{t('inventory.kindOut')}</option>
          <option value="adjustment">{t('inventory.kindAdjust')}</option>
        </Select>
        <Input
          label={kind === 'adjustment' ? t('inventory.delta') : t('inventory.quantity')}
          type="number"
          step="1"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
        <Input label={t('inventory.reason')} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('inventory.reasonPlaceholder')} />
        <p className="rounded-2xl bg-sand/60 px-3 py-2 text-[11px] text-muted">
          {t('inventory.resulting')}{' '}
          <strong className={preview < 0 ? 'text-blush-deep' : 'text-licorice'}>{preview}</strong>
        </p>
        {error ? (
          <p role="alert" className="rounded-2xl bg-blush-soft px-3 py-2 text-[11px] font-medium text-blush-deep">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}
