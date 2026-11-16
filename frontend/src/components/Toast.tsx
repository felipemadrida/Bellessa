import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../lib/format'

type Tone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  tone: Tone
}

interface ToastValue {
  toast: (message: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const sequence = useRef(0)

  const toast = useCallback((message: string, tone: Tone = 'success') => {
    const id = ++sequence.current
    setItems((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 4500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
      >
        {items.map((item) => {
          const Icon = ICONS[item.tone]
          return (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lift backdrop-blur animate-scale-in',
                item.tone === 'success' && 'border-sage/20 bg-white/95 text-ink',
                item.tone === 'error' && 'border-rose/20 bg-white/95 text-ink',
                item.tone === 'info' && 'border-line bg-white/95 text-ink',
              )}
            >
              <Icon
                size={18}
                className={cn(
                  'mt-0.5 shrink-0',
                  item.tone === 'success' && 'text-sage',
                  item.tone === 'error' && 'text-rose',
                  item.tone === 'info' && 'text-muted',
                )}
              />
              <p className="flex-1 leading-snug">{item.message}</p>
              <button
                type="button"
                onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                className="rounded-full p-0.5 text-muted transition hover:text-ink"
                aria-label="Cerrar aviso"
              >
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider')
  return context
}
