import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Download,
  Plus,
  Printer,
  Receipt,
  Wallet,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePreferences } from '../lib/preferences'
import {
  addDaysKey,
  cn,
  dateLongFromKey,
  formatTime,
  money,
  todayKey,
} from '../lib/format'
import type { CashSummary } from '../lib/types'
import { PageHeader } from '../components/AppShell'
import { useToast } from '../components/Toast'
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionTitle,
  Segmented,
  Skeleton,
} from '../components/ui'

export function CashPage() {
  const { business } = useAuth()
  const { t } = usePreferences()
  const timezone = business?.timezone ?? 'America/Mexico_City'
  const today = todayKey(timezone)
  const [date, setDate] = useState(today)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const query = useQuery({
    queryKey: ['cash', date],
    queryFn: () => api.cash.summary(date),
  })
  const summary: CashSummary | undefined = query.data

  async function exportCsv() {
    setExporting(true)
    try {
      await api.reports.exportCsv(date, date)
      toast('Corte descargado en CSV')
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'No pudimos descargar el corte', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={t('page.cash.eyebrow')}
        title={t('page.cash.title')}
        subtitle={dateLongFromKey(date)}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface px-1.5 py-1">
              <button
                type="button"
                aria-label={t('common.prevDay')}
                onClick={() => setDate(addDaysKey(date, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-sand"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                className="w-[124px] border-0 bg-transparent text-center text-[11px] font-semibold text-licorice focus:outline-none"
                aria-label={t('common.cashDate')}
              />
              <button
                type="button"
                aria-label={t('common.nextDay')}
                onClick={() => setDate(addDaysKey(date, 1))}
                disabled={date >= today}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-sand disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} /> {t('cash.print')}
            </Button>
            <Button variant="rose" onClick={() => setExpenseOpen(true)}>
              <Plus size={16} /> {t('cash.expense')}
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-[28px]" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : query.isError || !summary ? (
        <Card>
          <EmptyState
            icon={<CircleAlert size={22} />}
            title={t('cash.errorLoad')}
            action={<Button onClick={() => query.refetch()}>{t('cash.retry')}</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Hero del corte */}
          <section className="print-block relative overflow-hidden rounded-[28px] bg-licorice px-5 py-6 text-alabaster shadow-lift sm:px-8">
            <div
              className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full opacity-60 blur-2xl"
              style={{ background: 'radial-gradient(circle, #D4AF3755 0%, transparent 70%)' }}
            />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-alabaster/55">
                  {t('cash.expectedCash')}
                </p>
                <p className="money mt-2 font-display text-[52px] font-normal leading-none tracking-[-0.04em]">
                  {money(summary.expected_cash_cents)}
                </p>
                <p className="mt-3 text-[12px] text-alabaster/60">
                  {t('cash.summaryLine', {
                    name: summary.business_name,
                    a: summary.completed_appointments,
                    b: summary.payments_count,
                  })}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 rounded-3xl border border-cream/10 bg-alabaster/[.06] px-4 py-3 text-[11px] backdrop-blur-sm">
                <div>
                  <p className="text-alabaster/50">{t('cash.cash')}</p>
                  <p className="money mt-0.5 font-bold text-alabaster">{money(summary.cash_cents)}</p>
                </div>
                <div>
                  <p className="text-alabaster/50">{t('cash.tips')}</p>
                  <p className="money mt-0.5 font-bold text-alabaster">{money(summary.tips_cents)}</p>
                </div>
                <div>
                  <p className="text-alabaster/50">{t('cash.expenses')}</p>
                  <p className="money mt-0.5 font-bold text-champagne-soft">-{money(summary.expenses_cents)}</p>
                </div>
              </div>
            </div>
            <div className="relative mt-5 flex flex-wrap gap-2 no-print">
              <Button size="sm" variant="rose" onClick={exportCsv} loading={exporting}>
                <Download size={14} /> {t('cash.downloadCsv')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="border-cream/20 bg-transparent text-alabaster hover:bg-alabaster/10"
                onClick={() => {
                  setDate(today)
                }}
              >
                <CalendarDays size={14} /> {t('cash.goToday')}
              </Button>
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric
              icon={<Banknote size={16} />}
              label={t('cash.income')}
              value={money(summary.income_cents)}
              hint={t('cash.incomeHint')}
              tone="sage"
            />
            <Metric
              icon={<Wallet size={16} />}
              label={t('cash.avgTicket')}
              value={money(summary.average_ticket_cents)}
              hint={t('cash.paymentsCount', { n: summary.payments_count })}
              tone="rose"
            />
            <Metric
              icon={<CreditCard size={16} />}
              label={t('cash.card')}
              value={money(summary.card_cents)}
              hint={t('cash.transferHint', { amount: money(summary.transfer_cents) })}
              tone="ink"
            />
            <Metric
              icon={<Receipt size={16} />}
              label={t('cash.tips')}
              value={money(summary.tips_cents)}
              hint={t('cash.tipsHint')}
              tone="gold"
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <Card className="p-4 sm:p-5">
              <SectionTitle
                title={t('cash.dayPayments')}
                subtitle={t('cash.movements', { n: summary.payments.length })}
                action={
                  <span className="text-[11px] font-semibold text-muted">
                    {t('cash.vatIncluded', {
                      rate: business?.tax_rate_bps ? business.tax_rate_bps / 100 : 16,
                    })}
                  </span>
                }
              />
              {summary.payments.length ? (
                <div className="divide-y divide-border/50">
                  {summary.payments.map((payment) => {
                    const appointment = payment.appointment
                    return (
                      <div key={payment.id} className="flex items-center gap-3 py-2.5">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                            payment.method === 'cash'
                              ? 'bg-sage-soft text-sage-deep'
                              : payment.method === 'card'
                                ? 'bg-blush-soft text-blush-deep'
                                : 'bg-champagne-soft text-champagne-deep',
                          )}
                        >
                          {payment.method === 'cash' ? (
                            <Banknote size={15} />
                          ) : payment.method === 'card' ? (
                            <CreditCard size={15} />
                          ) : (
                            <ArrowLeftRight size={15} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-licorice">
                            {appointment?.client.name ?? t('cash.generalPublic')}
                          </p>
                          <p className="truncate text-[10.5px] text-muted">
                            {appointment?.service.name ?? t('cash.service')} ·{' '}
                            {formatTime(payment.created_at, timezone)} ·{' '}
                            {t(`method.${payment.method}`)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="money text-[12.5px] font-bold text-licorice">{money(payment.total_cents)}</p>
                          {payment.tip_cents > 0 ? (
                            <p className="text-[9.5px] text-sage">
                              {t('cash.tipSuffix', { amount: money(payment.tip_cents) })}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => api.payments.downloadReceipt(payment.id)}
                          aria-label={t('cash.downloadReceipt')}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-licorice no-print"
                        >
                          <Receipt size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<Receipt size={20} />}
                  title={t('cash.noPaymentsTitle')}
                  description={t('cash.noPaymentsDesc')}
                  className="py-8"
                />
              )}
            </Card>

            <div className="space-y-4">
              <Card className="p-4 sm:p-5">
                <SectionTitle title={t('cash.paymentMethods')} />
                <div className="space-y-3">
                  {[
                    { key: 'cash', label: t('method.cash'), value: summary.cash_cents, color: '#4A6B5D' },
                    { key: 'card', label: t('method.card'), value: summary.card_cents, color: '#9C5566' },
                    { key: 'transfer', label: t('method.transfer'), value: summary.transfer_cents, color: '#A8842C' },
                    { key: 'other', label: t('method.other'), value: summary.other_cents, color: '#7E3F4E' },
                  ].map((row) => {
                    const percent = summary.income_cents
                      ? Math.round((row.value / summary.income_cents) * 100)
                      : 0
                    return (
                      <div key={row.key}>
                        <div className="mb-1 flex items-center justify-between text-[11.5px]">
                          <span className="flex items-center gap-1.5 font-semibold text-licorice">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: row.color }}
                            />
                            {row.label}
                          </span>
                          <span className="money text-muted">
                            {money(row.value)} · {percent}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-sand">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${percent}%`, backgroundColor: row.color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Card className="p-4 sm:p-5">
                <SectionTitle
                  title={t('cash.expensesTitle')}
                  subtitle={t('cash.expensesRegistered', { n: summary.expenses.length })}
                  action={
                    <Button size="sm" variant="ghost" onClick={() => setExpenseOpen(true)}>
                      <Plus size={13} /> {t('cash.add')}
                    </Button>
                  }
                />
                {summary.expenses.length ? (
                  <div className="space-y-2">
                    {summary.expenses.map((expense) => (
                      <div key={expense.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-licorice">{expense.concept}</p>
                          <p className="text-[10px] text-muted">{expense.category}</p>
                        </div>
                        <p className="money shrink-0 text-[12px] font-bold text-blush-deep">
                          -{money(expense.amount_cents)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-sand/40 px-3 py-4 text-center text-[11.5px] text-muted">
                    {t('cash.noExpenses')}
                  </p>
                )}
              </Card>

              <div className="rounded-3xl border border-dashed border-border bg-surface/40 p-4 text-[11.5px] leading-relaxed text-muted">
                <p className="mb-1 flex items-center gap-1.5 font-bold text-licorice">
                  <Banknote size={13} className="text-sage" /> {t('cash.howCalculated')}
                </p>
                {t('cash.howCalculatedBody')}
              </div>
            </div>
          </div>
        </>
      )}

      <ExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} date={date} />
    </div>
  )
}

function Metric({
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
  tone: 'rose' | 'sage' | 'gold' | 'ink'
}) {
  const tones = {
    rose: 'bg-blush-soft text-blush-deep',
    sage: 'bg-sage-soft text-sage-deep',
    gold: 'bg-champagne-soft text-champagne-deep',
    ink: 'bg-sand text-licorice',
  }
  return (
    <Card className="p-4">
      <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl', tones[tone])}>
        {icon}
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="money mt-0.5 font-display text-[24px] font-medium leading-none text-licorice">{value}</p>
      <p className="mt-1 text-[10.5px] text-muted">{hint}</p>
    </Card>
  )
}

function ExpenseModal({
  open,
  onClose,
  date,
}: {
  open: boolean
  onClose: () => void
  date: string
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = usePreferences()
  const [concept, setConcept] = useState('')
  const [category, setCategory] = useState('Insumos')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setConcept('')
    setCategory('Insumos')
    setAmount('')
    setError(null)
    setSaving(false)
  }, [open])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!concept.trim() || !Number.isFinite(cents) || cents <= 0) {
      setError(t('cash.expenseError'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.expenses.create({
        concept: concept.trim(),
        category,
        amount_cents: cents,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cash', date] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      toast(t('cash.expenseSaved'))
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('cash.expenseSaveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cash.expenseTitle')}
      subtitle={t('cash.expenseSubtitle')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('cash.cancel')}
          </Button>
          <Button variant="rose" type="submit" form="expense-form" loading={saving}>
            {t('cash.saveExpense')}
          </Button>
        </div>
      }
    >
      <form id="expense-form" onSubmit={submit} className="space-y-4">
        <Input
          label={t('cash.concept')}
          value={concept}
          onChange={(event) => setConcept(event.target.value)}
          placeholder={t('cash.conceptPlaceholder')}
          required
        />
        <Field label={t('cash.category')}>
          <Segmented
            options={[
              { value: 'Insumos', label: t('cash.cat.supplies') },
              { value: 'Operación', label: t('cash.cat.operations') },
              { value: 'Servicios', label: t('cash.cat.services') },
              { value: 'Otros', label: t('cash.cat.other') },
            ]}
            value={category}
            onChange={setCategory}
            size="sm"
            className="w-full justify-between"
          />
        </Field>
        <Input
          label={t('cash.amount')}
          leading="$"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
        />
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-blush-deep/20 bg-blush-soft px-3.5 py-2.5 text-[12.5px] font-medium text-blush-deep"
          >
            <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        ) : null}
      </form>
    </Modal>
  )
}
