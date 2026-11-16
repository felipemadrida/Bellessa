import { Link } from 'react-router-dom'
import { BrandMark } from '../components/AppShell'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
      <BrandMark size={48} />
      <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-rose">Error 404</p>
      <h1 className="mt-2 font-display text-4xl font-medium text-ink">Esta página se fue a peinar</h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        No encontramos lo que buscabas. Regresa al inicio o agenda una cita desde tu panel.
      </p>
      <Link
        to="/"
        className="mt-7 inline-flex h-11 items-center rounded-2xl bg-ink px-5 text-sm font-semibold text-cream"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
