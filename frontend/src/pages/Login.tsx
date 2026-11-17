import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck2,
  Eye,
  EyeOff,
  MessageCircle,
  Scissors,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { BrandMark, Wordmark } from '../components/AppShell'
import { useToast } from '../components/Toast'
import { Button, Input } from '../components/ui'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePreferences } from '../lib/preferences'

const FEATURES = [
  { icon: CalendarCheck2, text: 'login.feat1' },
  { icon: MessageCircle, text: 'login.feat2' },
  { icon: Wallet, text: 'login.feat3' },
]

export function LoginPage({ register = false }: { register?: boolean }) {
  const { user, ready, signIn, signUp } = useAuth()
  const { t, locale, setLocale, theme, toggleTheme } = usePreferences()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [email, setEmail] = useState(register ? '' : 'demo@bellessa.mx')
  const [password, setPassword] = useState(register ? '' : 'demo1234')
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const destination = (location.state as { from?: string } | null)?.from ?? '/'

  if (ready && user) return <Navigate to={destination} replace />

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (register) {
        await signUp({
          business_name: businessName,
          owner_name: ownerName,
          email,
          password,
          phone: phone || undefined,
          city: 'Ciudad de México',
        })
        toast(t('login.successToast'))
      } else {
        await signIn(email, password)
      }
      navigate(destination, { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos entrar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDemo() {
    setError(null)
    setDemoLoading(true)
    try {
      await signIn('demo@bellessa.mx', 'demo1234')
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos abrir el demo.')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-cream">
      <div className="grid min-h-dvh lg:grid-cols-[1.08fr_.92fr]">
        {/* Lado editorial */}
        <section className="relative hidden overflow-hidden bg-ink px-12 py-12 text-cream lg:flex lg:flex-col xl:px-16">
          <div
            className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full opacity-60 blur-2xl"
            style={{ background: 'radial-gradient(circle, #D9A44155 0%, transparent 65%)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-48 -left-24 h-[520px] w-[520px] rounded-full opacity-50 blur-2xl"
            style={{ background: 'radial-gradient(circle, #C9C6C244 0%, transparent 65%)' }}
          />
          <div className="relative flex items-center gap-2.5">
            <BrandMark size={40} />
            <Wordmark className="text-cream" />
          </div>

          <div className="relative my-auto max-w-lg py-14">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cream/20 bg-cream/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/80">
              <Sparkles size={13} className="text-gold" />
              {t('login.madeFor')}
            </p>
            <h1 className="text-balance font-display text-[54px] font-normal leading-[0.98] tracking-[-0.035em] xl:text-[64px]">
              {t('login.head1')}
              <br />
              <span className="italic text-[#F0CFA7]">{t('login.head2')}</span>
              <br />
              {t('login.head3')}
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-cream/75">
              {t('login.subtitle')}
            </p>

            <ul className="mt-9 space-y-3.5">
              {FEATURES.map((feature) => (
                <li key={feature.text} className="flex items-center gap-3 text-sm text-cream/85">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cream/15 bg-cream/10">
                    <feature.icon size={16} className="text-gold" />
                  </span>
                  {t(feature.text)}
                </li>
              ))}
            </ul>
          </div>

          {/* Mini agenda decorativa */}
          <div className="relative rounded-3xl border border-cream/15 bg-cream/10 p-4 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-cream/60">
              <span>{t('login.today')}</span>
              <span className="rounded-full bg-cream/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-cream">
                6 citas
              </span>
            </div>
            <div className="space-y-2">
              {[
                { time: '10:00', name: 'Fernanda C.', service: 'Balayage', color: '#D9A441' },
                { time: '12:30', name: 'Sofía R.', service: 'Manicure gel', color: '#C2415A' },
                { time: '17:00', name: 'Valeria M.', service: 'Peinado', color: '#D97757' },
              ].map((item) => (
                <div
                  key={item.time}
                  className="flex items-center gap-3 rounded-2xl bg-cream/10 px-3 py-2.5"
                >
                  <span className="w-10 text-xs font-semibold text-cream/70">{item.time}</span>
                  <span
                    className="h-8 w-1 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-cream">{item.name}</p>
                    <p className="truncate text-[11px] text-cream/60">{item.service}</p>
                  </div>
                  <Scissors size={14} className="text-cream/40" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Formulario */}
        <section className="flex flex-col px-5 py-7 sm:px-10 lg:px-14 lg:py-10">
          <div className="flex items-center justify-between lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <BrandMark size={36} />
              <Wordmark />
            </Link>
            <Link
              to={register ? '/login' : '/registro'}
              className="text-xs font-semibold text-rose underline-offset-4 hover:underline"
            >
              {register ? t('login.haveAccount') : t('login.createAccountLink')}
            </Link>
          </div>

          <div className="mb-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
              className="rounded-xl border border-line bg-white/70 px-3 py-1.5 text-[10px] font-bold text-ink"
            >
              {locale === 'es' ? 'English' : 'Español'}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl border border-line bg-white/70 px-3 py-1.5 text-[10px] font-bold text-ink"
            >
              {theme === 'dark' ? t('common.light') : t('common.dark')}
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose">
              {register ? t('login.startFree') : t('login.welcome')}
            </p>
            <h2 className="mt-2 font-display text-[34px] font-medium leading-tight tracking-[-0.025em] text-ink sm:text-[40px]">
              {register ? t('login.registerHeadline') : t('login.welcomeSub')}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {register ? t('login.registerSub') : t('login.enterSub')}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {register ? (
                <>
                  <Input
                    label={t('login.businessName')}
                    placeholder="Ej. Salón Demo"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    autoComplete="organization"
                    required
                  />
                  <Input
                    label={t('login.yourName')}
                    placeholder="Ej. Lucía Herrera"
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    autoComplete="name"
                    required
                  />
                  <Input
                    label={t('login.whatsapp')}
                    placeholder="55 1234 5678"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </>
              ) : null}

              <Input
                label={t('login.email')}
                type="email"
                placeholder="tu@salon.mx"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />

              <div className="relative">
                <Input
                  label={t('login.password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center text-muted transition hover:text-ink"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose/20 bg-rose-soft px-3.5 py-3 text-[13px] font-medium text-rose-deep"
                >
                  {error}
                </div>
              ) : null}

              <Button type="submit" size="lg" variant="rose" className="w-full" loading={loading}>
                {register ? t('login.createSalon') : t('login.enter')}
                {!loading ? <ArrowRight size={17} /> : null}
              </Button>
            </form>

            {!register ? (
              <>
                <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/60">
                  <span className="h-px flex-1 bg-line" />
                  {t('login.withoutAccount').toLowerCase()}
                  <span className="h-px flex-1 bg-line" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  loading={demoLoading}
                  onClick={handleDemo}
                >
                  <Sparkles size={17} className="text-gold" />
                  {t('login.demo')}
                </Button>
              </>
            ) : null}

            <p className="mt-6 text-center text-xs leading-relaxed text-muted">
              {t('login.accept')}
              <br />
              Hecho con cariño en México · Precios en MXN
            </p>

            <div className="mt-6 flex items-center justify-center gap-4 text-xs">
              <Link to={register ? '/login' : '/registro'} className="font-semibold text-rose">
                {register ? t('login.haveAccount') : t('login.create')}
              </Link>
              <span className="text-line">|</span>
              <Link to="/reservar/salon-lucia" className="font-semibold text-muted hover:text-ink">
                {t('login.viewBooking')}
              </Link>
              <span className="text-line">|</span>
              <Link to="/admin" className="font-semibold text-muted hover:text-ink">
                Admin SaaS
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
