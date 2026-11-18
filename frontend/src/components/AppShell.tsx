import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import {
  CalendarDays,
  ChartNoAxesColumn,
  ChevronDown,
  Languages,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  Package,
  Plus,
  Scissors,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/format'
import { usePreferences } from '../lib/preferences'
import { Avatar, IconButton, Input, Menu, MenuItem, Spinner } from './ui'

/**
 * Marca de Bellessa: dos perfiles espejo (taupe + champagne) recortados del arte
 * original. El disco se mantiene claro en ambos temas a propósito: el negativo de
 * las caras es el fondo, así que si el disco se oscureciera la marca se invertiría.
 *
 * Los archivos se generan con `design/brand/extract-mark.py`.
 */
export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
      style={{
        width: size,
        height: size,
        backgroundColor: '#FBF7F1',
        boxShadow: 'inset 0 0 0 1px rgba(234, 223, 210, 0.9)',
      }}
      aria-hidden="true"
    >
      <img
        src="/brand-mark.png"
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  )
}

export function Wordmark({ name, className }: { name?: string, className?: string }) {
  return (
    <span className={cn('font-display text-[22px] font-medium tracking-[-0.03em] text-licorice', className)}>
      {name ?? 'bellessa'}
    </span>
  )
}

const NAV_SECTIONS = [
  {
    label: 'nav.hoy',
    items: [
      { to: '/', label: 'nav.home', icon: LayoutDashboard, end: true },
      { to: '/agenda', label: 'nav.agenda', icon: CalendarDays },
      { to: '/caja', label: 'nav.cash', icon: Wallet },
    ],
  },
  {
    label: 'nav.more',
    items: [
      { to: '/clientas', label: 'nav.clients', icon: Users },
      { to: '/whatsapp', label: 'nav.whatsapp', icon: MessageCircle },
      { to: '/reportes', label: 'nav.reports', icon: ChartNoAxesColumn },
      { to: '/servicios', label: 'nav.services', icon: Scissors },
      { to: '/inventario', label: 'nav.inventory', icon: Package },
      { to: '/equipo', label: 'nav.team', icon: Sparkles },
      { to: '/ajustes', label: 'nav.settings', icon: Settings },
    ],
  },
]

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-alabaster">
      <BrandMark size={52} />
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner size={15} />
        Preparando tu salón…
      </div>
    </div>
  )
}

function Sidebar() {
  const { user, business, signOut } = useAuth()
  const { t, locale, setLocale, theme, toggleTheme } = usePreferences()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  if (!user || !business) return null
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-silver/30 bg-gradient-to-b from-alabaster/95 to-sand/90 px-4 py-6 backdrop-blur-xl lg:flex">
      <NavLink to="/" className="mb-6 flex items-center gap-2.5 px-2">
        <BrandMark />
        <div className="leading-none">
          <Wordmark name={business.name} />
          <span
            aria-hidden="true"
            className="mt-1.5 block h-[2px] w-9 rounded-full"
            style={{ backgroundColor: 'var(--brand, #9C5566)' }}
          />
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-deep">
            {t('common.salonOrder')}
          </p>
        </div>
      </NavLink>

      <form
        className="mb-4"
        onSubmit={(event) => {
          event.preventDefault()
          navigate(`/clientas?q=${encodeURIComponent(query.trim())}`)
          setQuery('')
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          leading={<Search size={15} />}
          placeholder={t('common.searchClient')}
          aria-label={t('common.searchLabel')}
          className="h-10 bg-surface/80"
        />
      </form>

      <nav className="flex-1 space-y-7 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted/70">
              {t(section.label)}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-semibold transition',
                      isActive
                        ? 'bg-licorice text-alabaster shadow-boutique'
                        : 'text-muted hover:bg-surface/70 hover:text-licorice',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} strokeWidth={1.9} className={isActive ? 'text-gold' : ''} />
                      {t(item.label)}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 rounded-3xl border border-silver/40 bg-surface/70 p-3 metal-ring">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} color={user.color} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-licorice">{user.name}</p>
            <p className="truncate text-[11px] text-muted">{business.name}</p>
          </div>
          <IconButton label={t('common.logout')} onClick={signOut} className="h-8 w-8">
            <LogOut size={15} />
          </IconButton>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
          <button
            type="button"
            onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
            aria-label={locale === 'es' ? 'Switch to English' : 'Cambiar a español'}
            title={locale === 'es' ? 'English' : 'Español'}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/70 text-licorice transition hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blush-deep/40"
          >
            <Languages size={15} strokeWidth={1.9} />
            <span className="text-[10px] font-bold uppercase tracking-wide">{locale}</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('common.light') : t('common.dark')}
            title={theme === 'dark' ? t('common.light') : t('common.dark')}
            className="flex h-9 w-11 items-center justify-center rounded-xl border border-border bg-surface/70 text-licorice transition hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blush-deep/40"
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={1.9} /> : <Moon size={15} strokeWidth={1.9} />}
          </button>
        </div>
      </div>
    </aside>
  )
}

function MobileHeader() {
  const { user, business, signOut } = useAuth()
  const { t, locale, setLocale, theme, toggleTheme } = usePreferences()
  if (!user || !business) return null
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-alabaster/85 px-4 backdrop-blur-xl lg:hidden">
      <NavLink to="/" className="flex items-center gap-2">
        <BrandMark size={34} />
        <Wordmark name={business.name} className="text-xl" />
      </NavLink>
      <div className="flex items-center gap-1">
        <NavLink
          to="/agenda?nueva=1"
          className="metal-gold flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-licorice"
        >
          <Plus size={14} /> {t('common.cita')}
        </NavLink>
        <Menu
          trigger={
            <button
              type="button"
              className="flex items-center gap-1 rounded-full p-1 text-muted"
              aria-label={t('common.accountMenu')}
            >
              <Avatar name={user.name} color={user.color} size="sm" />
              <ChevronDown size={14} />
            </button>
          }
        >
          <div className="border-b border-border/70 px-3 py-2.5">
            <p className="text-sm font-bold text-licorice">{user.name}</p>
            <p className="text-xs text-muted">{business.name}</p>
          </div>
          <div className="py-1">
            <MenuItem onClick={() => (window.location.href = '/reportes')}>
              <ChartNoAxesColumn size={16} /> {t('nav.reports')}
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = '/whatsapp')}>
              <MessageCircle size={16} /> {t('nav.whatsapp')}
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = '/servicios')}>
              <Scissors size={16} /> {t('nav.services')}
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = '/inventario')}>
              <Package size={16} /> {t('nav.inventory')}
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = '/equipo')}>
              <Sparkles size={16} /> {t('nav.team')}
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = '/ajustes')}>
              <Settings size={16} /> {t('nav.settings')}
            </MenuItem>
            <MenuItem onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}>
              <Languages size={16} /> {locale === 'es' ? 'English' : 'Español'}
            </MenuItem>
            <MenuItem onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? t('common.light') : t('common.dark')}
            </MenuItem>
            <MenuItem onClick={signOut} danger>
              <LogOut size={16} /> {t('common.logout')}
            </MenuItem>
          </div>
        </Menu>
      </div>
    </header>
  )
}

function BottomNav() {
  const { t } = usePreferences()
  const items = [
    { to: '/', label: 'nav.home', icon: LayoutDashboard, end: true },
    { to: '/agenda', label: 'nav.agenda', icon: CalendarDays },
    { to: '/clientas', label: 'nav.clients', icon: Users },
    { to: '/caja', label: 'nav.cash', icon: Wallet },
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-alabaster/95 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
        {items.slice(0, 2).map((item) => (
          <BottomLink key={item.to} {...item} label={t(item.label)} />
        ))}
        <div className="flex justify-center">
          <NavLink
            to="/agenda?nueva=1"
            aria-label={t('common.newAppointment')}
            className="metal-gold -mt-7 flex h-14 w-14 items-center justify-center rounded-full border-[5px] border-cream text-licorice shadow-lift transition active:scale-95"
          >
            <Plus size={24} strokeWidth={2.4} />
          </NavLink>
        </div>
        {items.slice(2).map((item) => (
          <BottomLink key={item.to} {...item} label={t(item.label)} />
        ))}
      </div>
    </nav>
  )
}

function BottomLink({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 rounded-xl px-1 pb-1 pt-2 text-[10px] font-semibold transition',
          isActive ? 'text-rose' : 'text-muted',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
          {label}
        </>
      )}
    </NavLink>
  )
}

export function AppShell() {
  const { user, business, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Splash />
  if (!user || !business) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return (
    <div className="min-h-dvh bg-alabaster">
      <Sidebar />
      <div className="lg:pl-[272px]">
        <MobileHeader />
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-10 lg:pb-12">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-rose">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-[30px] font-medium leading-[1.05] tracking-[-0.02em] text-licorice sm:text-[38px]">
          {title}
        </h1>
        {subtitle ? <div className="mt-1.5 text-sm text-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
