import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { AgendaPage } from './pages/Agenda'
import { ClientsPage } from './pages/Clients'
import { ClientDetailPage } from './pages/ClientDetail'
import { ServicesPage } from './pages/Services'
import { TeamPage } from './pages/Team'
import { CashPage } from './pages/Cash'
import { ReportsPage } from './pages/Reports'
import { SettingsPage } from './pages/Settings'
import { PublicBookingPage } from './pages/PublicBooking'
import { InventoryPage } from './pages/Inventory'
import { WhatsAppPage } from './pages/WhatsApp'
import { ManualWhatsAppPage } from './pages/ManualWhatsApp'
import { AdminSaaSPage } from './pages/AdminSaaS'
import { NotFoundPage } from './pages/NotFound'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export function App() {
  return (
    <>
      <ScrollToTop />
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
    </>
  )
}
