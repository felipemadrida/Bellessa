import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  ChartNoAxesColumn,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Plus,
  Scissors,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/format'
import { Avatar, IconButton, Menu, MenuItem, Spinner } from './ui'

export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[14px] bg-rose text-cream shadow-soft"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" width={size * 0.62} height={size * 0.62} fill="none">
        <circle cx="20" cy="20" r="12.5" stroke="currentColor" strokeWidth="1.4" opacity=".55" />
        <path d="M20 10c2.4 3.8 2.4 7.6 0 11.4-2.4-3.8-2.4-7.6 0-11.4Z" fill="currentColor" />
        <path d="M20 30c-2.4-3.8-2.4-7.6 0-11.4 2.4 3.8 2.4 7.6 0 11.4Z" fill="currentColor" />
        <path d="M10 16c4.3 1.4 6.7 4.4 7 8.4-4.3-1.4-6.7-4.4-7-8.4Z" fill="currentColor" opacity=".85" />
        <path d="M30 24c-4.3-1.4-6.7-4.4-7-8.4 4.3 1.4 6.7 4.4 7 8.4Z" fill="currentColor" opacity=".85" />
        <circle cx="20" cy="20" r="1.7" fill="#D9A441" />
      </svg>
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-[22px] font-medium tracking-[-0.03em] text-ink', className)}>
      bellessa
    </span>
  )
}

const NAV_SECTIONS = [
  {
    label: 'Operación',
    items: [
      { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
      { to: '/agenda', label: 'Agenda', icon: CalendarDays },
      { to: '/clientas', label: 'Clientas', icon: Users },
      { to: '/caja', label: 'Caja', icon: Wallet },
      { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    ],
  },
  {
    label: 'Tu negocio',
    items: [
      { to: '/reportes', label: 'Reportes', icon: ChartNoAxesColumn },
      { to: '/servicios', label: 'Servicios', icon: Scissors },
      { to: '/equipo', label: 'Equipo', icon: Sparkles },
      { to: '/ajustes', label: 'Ajustes', icon: Settings },
    ],
  },
]

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream">
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
  if (!user || !business) return null
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-line/80 bg-[#F8F2EA]/85 px-4 py-6 backdrop-blur-xl lg:flex">
      <NavLink to="/" className="mb-8 flex items-center gap-2.5 px-2">
        <BrandMark />
        <div className="leading-none">
          <Wordmark />
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Salón en orden
          </p>
        </div>
      </NavLink>

      <nav className="flex-1 space-y-7 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted/70">
              {section.label}
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
                        ? 'bg-ink text-cream shadow-soft'
                        : 'text-muted hover:bg-white/70 hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} strokeWidth={1.9} className={isActive ? 'text-gold' : ''} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 rounded-3xl border border-line bg-white/70 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} color={user.color} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-ink">{user.name}</p>
            <p className="truncate text-[11px] text-muted">{business.name}</p>
          </div>
          <IconButton label="Cerrar sesión" onClick={signOut} className="h-8 w-8">
            <LogOut size={15} />
          </IconButton>
        </div>
      </div>
    </aside>
  )
}

function MobileHeader() {
  const { user, business, signOut } = useAuth()
  if (!user || !business) return null
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/70 bg-cream/85 px-4 backdrop-blur-xl lg:hidden">
      <NavLink to="/" className="flex items-center gap-2">
        <BrandMark size={34} />
        <Wordmark className="text-xl" />
      </NavLink>
      <div className="flex items-center gap-1">
        <NavLink
          to="/agenda?nueva=1"
          className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-cream"
        >
          <Plus size={14} /> Cita
        </NavLink>
        <Menu
          trigger={
            <button
              type="button"
              className="flex items-center gap-1 rounded-full p-1 text-muted"
              aria-label="Abrir menú de cuenta"
            >
              <Avatar name={user.name} color={user.color} size="sm" />
              <ChevronDown size={14} />
            </button>
          }
        >
          <div className="border-b border-line/70 px-3 py-2.5">
            <p className="text-sm font-bold text-ink">{user.name}</p>
            <p className="text-xs text-muted">{business.name}</p>
          </div>
          <div className="py-1">
            <MenuItem onClick={() => (window.location.href = '/reportes')}>
              <ChartNoAxesColumn size={16} /> Reportes
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = '/whatsapp')}>
              <MessageCircle size={16} /> WhatsApp
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = '/servicios')}>
              <Scissors size={16} /> Servicios
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = '/equipo')}>
              <Sparkles size={16} /> Equipo
            </MenuItem>
            <MenuItem onClick={() => (window.location.href = '/ajustes')}>
              <Settings size={16} /> Ajustes
            </MenuItem>
            <MenuItem onClick={signOut} danger>
              <LogOut size={16} /> Cerrar sesión
            </MenuItem>
          </div>
        </Menu>
      </div>
    </header>
  )
}

function BottomNav() {
  const items = [
    { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
    { to: '/agenda', label: 'Agenda', icon: CalendarDays },
    { to: '/clientas', label: 'Clientas', icon: Users },
    { to: '/caja', label: 'Caja', icon: Wallet },
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-cream/95 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
        {items.slice(0, 2).map((item) => (
          <BottomLink key={item.to} {...item} />
        ))}
        <div className="flex justify-center">
          <NavLink
            to="/agenda?nueva=1"
            aria-label="Nueva cita"
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full border-[5px] border-cream bg-rose text-white shadow-lift transition active:scale-95"
          >
            <Plus size={24} strokeWidth={2.4} />
          </NavLink>
        </div>
        {items.slice(2).map((item) => (
          <BottomLink key={item.to} {...item} />
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
    <div className="min-h-dvh bg-cream">
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
        <h1 className="font-display text-[30px] font-medium leading-[1.05] tracking-[-0.02em] text-ink sm:text-[38px]">
          {title}
        </h1>
        {subtitle ? <div className="mt-1.5 text-sm text-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
