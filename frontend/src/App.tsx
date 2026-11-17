import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Spinner } from './components/ui'

const LoginPage = lazy(() => import('./pages/Login').then((module) => ({ default: module.LoginPage })))
const DashboardPage = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.DashboardPage })))
const AgendaPage = lazy(() => import('./pages/Agenda').then((module) => ({ default: module.AgendaPage })))
const ClientsPage = lazy(() => import('./pages/Clients').then((module) => ({ default: module.ClientsPage })))
const ClientDetailPage = lazy(() => import('./pages/ClientDetail').then((module) => ({ default: module.ClientDetailPage })))
const ServicesPage = lazy(() => import('./pages/Services').then((module) => ({ default: module.ServicesPage })))
const TeamPage = lazy(() => import('./pages/Team').then((module) => ({ default: module.TeamPage })))
const CashPage = lazy(() => import('./pages/Cash').then((module) => ({ default: module.CashPage })))
const ReportsPage = lazy(() => import('./pages/Reports').then((module) => ({ default: module.ReportsPage })))
const SettingsPage = lazy(() => import('./pages/Settings').then((module) => ({ default: module.SettingsPage })))
const PublicBookingPage = lazy(() => import('./pages/PublicBooking').then((module) => ({ default: module.PublicBookingPage })))
const InventoryPage = lazy(() => import('./pages/Inventory').then((module) => ({ default: module.InventoryPage })))
const WhatsAppPage = lazy(() => import('./pages/WhatsApp').then((module) => ({ default: module.WhatsAppPage })))
const ManualWhatsAppPage = lazy(() => import('./pages/ManualWhatsApp').then((module) => ({ default: module.ManualWhatsAppPage })))
const AdminSaaSPage = lazy(() => import('./pages/AdminSaaS').then((module) => ({ default: module.AdminSaaSPage })))
const NotFoundPage = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFoundPage })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

function PageFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner /> Cargando…
      </div>
    </div>
  )
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<LoginPage register />} />
          <Route path="/admin" element={<AdminSaaSPage />} />
          <Route path="/reservar/:slug" element={<PublicBookingPage />} />
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/clientas" element={<ClientsPage />} />
            <Route path="/clientas/:id" element={<ClientDetailPage />} />
            <Route path="/servicios" element={<ServicesPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/equipo" element={<TeamPage />} />
            <Route path="/caja" element={<CashPage />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/whatsapp/manual" element={<ManualWhatsAppPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/ajustes" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  )
}
