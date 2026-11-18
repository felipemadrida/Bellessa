import { Link } from 'react-router-dom'
import { BrandMark } from '../components/AppShell'
import { usePreferences } from '../lib/preferences'

export function NotFoundPage() {
  const { t } = usePreferences()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-alabaster px-6 text-center">
      <BrandMark size={48} />
      <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-rose">
        {t('notfound.code')}
      </p>
      <h1 className="mt-2 font-display text-4xl font-medium text-licorice">{t('notfound.title')}</h1>
      <p className="mt-3 max-w-md text-sm text-muted">{t('notfound.desc')}</p>
      <Link
        to="/"
        className="mt-7 inline-flex h-11 items-center rounded-2xl bg-licorice px-5 text-sm font-semibold text-alabaster"
      >
        {t('notfound.cta')}
      </Link>
    </div>
  )
}
