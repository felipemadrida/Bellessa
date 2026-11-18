import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/format'
import type { AppointmentStatus } from '../lib/types'
import { STATUS_TONE } from '../lib/format'

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------
type ButtonVariant = 'primary' | 'rose' | 'secondary' | 'ghost' | 'danger' | 'sage'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-licorice text-alabaster hover:bg-licorice/90 shadow-boutique',
  rose: 'bg-blush-deep text-alabaster hover:bg-rose-deep shadow-boutique',
  secondary: 'bg-surface text-licorice border border-border hover:bg-alabaster',
  ghost: 'text-licorice hover:bg-sand/70',
  danger: 'bg-blush-soft text-blush-deep hover:bg-blush/40',
  sage: 'bg-sage text-alabaster hover:bg-sage-deep shadow-boutique',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
  icon: 'h-10 w-10 justify-center',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-pill font-semibold transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blush-deep/40 focus-visible:ring-offset-2 focus-visible:ring-offset-alabaster',
        'disabled:cursor-not-allowed disabled:opacity-50 active:scale-[.98]',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={16} /> : null}
      {children}
    </button>
  )
})

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-licorice',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blush-deep/40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Superficies
// ---------------------------------------------------------------------------
export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return (
    <Tag className={cn('rounded-card border border-border bg-surface/85 shadow-boutique backdrop-blur-sm', className)}>
      {children}
    </Tag>
  )
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-3', className)}>
      <div>
        <h2 className="font-display text-xl font-medium tracking-tight text-licorice sm:text-[22px]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------
const controlClass =
  'w-full rounded-2xl border border-border bg-surface px-3.5 text-sm text-licorice placeholder:text-muted/60 transition ' +
  'focus:border-blush-deep/50 focus:outline-none focus:ring-4 focus:ring-blush/25 disabled:bg-sand/40'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string | null
  leading?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, className, id, ...props },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-semibold text-licorice">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(controlClass, 'h-11', leading ? 'pl-9' : '', error && 'border-rose/50', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${inputId}-help` : undefined}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-help`} className="mt-1 text-xs text-blush-deep">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-help`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, className, id, children, ...props },
  ref,
) {
  const generated = useId()
  const selectId = id ?? generated
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={selectId} className="mb-1.5 block text-[13px] font-semibold text-licorice">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={cn(controlClass, 'h-11 appearance-none pr-8', className)}
        aria-describedby={hint ? `${selectId}-help` : undefined}
        {...props}
      >
        {children}
      </select>
      {hint ? (
        <p id={`${selectId}-help`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, className, id, ...props },
  ref,
) {
  const generated = useId()
  const textareaId = id ?? generated
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={textareaId} className="mb-1.5 block text-[13px] font-semibold text-licorice">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(controlClass, 'min-h-[88px] resize-y py-2.5', className)}
        aria-describedby={hint ? `${textareaId}-help` : undefined}
        {...props}
      />
      {hint ? (
        <p id={`${textareaId}-help`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-licorice">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Estados y etiquetas
// ---------------------------------------------------------------------------
export function Badge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        className ?? 'bg-sand text-muted',
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = useTranslation()
  return <Badge className={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
}

const STATUS_DOT_COLOR: Record<AppointmentStatus, string> = {
  pending: '#D4AF37', // champagne
  confirmed: '#4A6B5D', // sage
  completed: '#6F5A50', // muted
  canceled: '#A8383B', // status.cancelled.text
  no_show: '#9C5566', // blush deep
}

export function StatusDot({ status }: { status: AppointmentStatus }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_DOT_COLOR[status] }}
    />
  )
}

export function Avatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = {
    xs: 'h-7 w-7 text-[10px]',
    sm: 'h-9 w-9 text-[11px]',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-xl',
  }
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight',
        sizes[size],
        className,
      )}
      style={
        color
          ? { backgroundColor: `${color}1F`, color }
          : {
              backgroundColor: 'var(--brand-soft, #9C55661F)',
              color: 'var(--brand, #9C5566)',
            }
      }
    >
      {letters}
    </span>
  )
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      style={{ width: size, height: size }}
    />
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-sand/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sand text-muted">
        {icon}
      </div>
      <h3 className="font-display text-lg font-medium text-licorice">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ProgressBar({
  value,
  color,
  className,
}: {
  value: number
  color?: string
  className?: string
}) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-sand', className)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          backgroundColor: color ?? 'var(--brand, #9C5566)',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs / segmented
// ---------------------------------------------------------------------------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-pill border border-border bg-surface/70 p-1',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full font-semibold transition',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-[13px]',
            value === option.value ? 'bg-licorice text-alabaster shadow-boutique' : 'text-muted hover:text-licorice',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal / bottom sheet
// ---------------------------------------------------------------------------
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const MODAL_SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const timer = window.setTimeout(() => panelRef.current?.focus(), 40)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-licorice/35 backdrop-blur-[3px] animate-scale-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-border bg-alabaster shadow-lift outline-none animate-fade-up sm:rounded-[2rem]',
          MODAL_SIZES[size],
          className,
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
            <div>
              {title ? (
                <h2 className="font-display text-xl font-medium tracking-tight text-licorice">{title}</h2>
              ) : null}
              {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
            </div>
            <IconButton label={t('common.close')} onClick={onClose} className="-mr-1 -mt-1">
              <X size={19} />
            </IconButton>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="border-t border-border/70 bg-alabaster/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Menú desplegable simple
// ---------------------------------------------------------------------------
const MenuContext = createContext<{ close: () => void } | null>(null)

export function Menu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((value) => !value)}>{trigger}</div>
      {open ? (
        <MenuContext.Provider value={{ close: () => setOpen(false) }}>
          <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-lift animate-scale-in">
            {children}
          </div>
        </MenuContext.Provider>
      ) : null}
    </div>
  )
}

export function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: ReactNode
  onClick?: () => void
  danger?: boolean
}) {
  const context = useContext(MenuContext)
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.()
        context?.close()
      }}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-sand/70',
        danger ? 'text-blush-deep' : 'text-licorice',
      )}
    >
      {children}
    </button>
  )
}

