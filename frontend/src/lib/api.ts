import type {
  Appointment,
  AppointmentStatus,
  AuditEntry,
  AuthResponse,
  Availability,
  Business,
  CashSummary,
  Client,
  ClientDetail,
  Dashboard,
  Expense,
  MarketingCalendarItem,
  MarketingCampaignResult,
  MarketingSegment,
  MarketingTemplate,
  ManualMessage,
  ManualMessageCreate,
  MessageLog,
  Payment,
  PaymentMethod,
  PublicBookingResponse,
  PublicBusiness,
  Report,
  Service,
  Staff,
  TimeOff,
  WhatsAppLink,
  WhatsAppMockResponse,
  WhatsAppStatus,
  WorkingHour,
} from './types'

const BASE = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'bellessa_token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean
  headers?: HeadersInit
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, headers: extraHeaders } = options
  const headers = new Headers(extraHeaders)
  headers.set('Accept', 'application/json')
  if (auth) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, 'No pudimos conectar con el servidor. Revisa tu conexión.')
  }

  if (response.status === 401 && auth) {
    window.dispatchEvent(new Event('bellessa:unauthorized'))
  }
  if (!response.ok) {
    let message = 'Algo salió mal. Intenta de nuevo.'
    try {
      const data = await response.json()
      if (typeof data?.detail === 'string') message = data.detail
      else if (Array.isArray(data?.detail)) {
        message = data.detail
          .map((item: { msg?: string; loc?: string[] }) => item.msg ?? 'Dato inválido')
          .join(' ')
      }
    } catch {
      // La respuesta no era JSON.
    }
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const result = search.toString()
  return result ? `?${result}` : ''
}

async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`${BASE}${path}`, { headers: authHeaders() })
  if (!response.ok) {
    let message = 'No se pudo descargar el archivo.'
    try {
      const data = await response.json()
      if (typeof data?.detail === 'string') message = data.detail
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export interface AppointmentInput {
  client_id: number
  service_id: number
  staff_id: number
  start_at: string
  notes?: string | null
  status?: 'pending' | 'confirmed'
}

export interface ClientInput {
  name: string
  phone: string
  email?: string | null
  birthday?: string | null
  notes?: string | null
  tags?: string | null
  rfc?: string | null
  accepts_marketing?: boolean
}

export interface ServiceInput {
  name: string
  description?: string | null
  category?: string
  duration_min?: number
  buffer_min?: number
  price_cents?: number
  deposit_cents?: number
  color?: string
  sort_order?: number
  active?: boolean
}

export interface StaffInput {
  name: string
  email: string
  password: string
  phone?: string | null
  role?: 'owner' | 'staff'
  color?: string
  commission_bps?: number
  bio?: string | null
}

export interface PublicBookingInput {
  service_id: number
  staff_id: number
  start_at: string
  name: string
  phone: string
  email?: string | null
  notes?: string | null
  accepts_marketing?: boolean
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
    register: (payload: {
      business_name: string
      owner_name: string
      email: string
      password: string
      phone?: string
      city?: string
    }) => request<AuthResponse>('/auth/register', { method: 'POST', body: payload, auth: false }),
    me: () => request<{ user: Staff; business: Business }>('/auth/me'),
    updateMe: (payload: { name?: string; phone?: string }) =>
      request<{ user: Staff; business: Business }>('/auth/me', { method: 'PATCH', body: payload }),
  },
  business: {
    get: () => request<Business>('/business'),
    update: (payload: Partial<Business>) =>
      request<Business>('/business', { method: 'PATCH', body: payload }),
    updateHours: (hours: { weekday: number; closed: boolean; open_minute: number; close_minute: number }[]) =>
      request<Business['hours']>('/business/hours', { method: 'PUT', body: hours }),
  },
  staff: {
    list: (includeInactive = false) =>
      request<Staff[]>(`/staff${query({ include_inactive: includeInactive })}`),
    create: (payload: StaffInput) => request<Staff>('/staff', { method: 'POST', body: payload }),
    update: (id: number, payload: Partial<StaffInput> & { active?: boolean }) =>
      request<Staff>(`/staff/${id}`, { method: 'PATCH', body: payload }),
    updateHours: (id: number, hours: WorkingHour[]) =>
      request<WorkingHour[]>(`/staff/${id}/hours`, { method: 'PUT', body: hours }),
    timeOff: (id: number) => request<TimeOff[]>(`/staff/${id}/time-off`),
    createTimeOff: (id: number, payload: { start_date: string; end_date: string; reason?: string | null }) =>
      request<TimeOff>(`/staff/${id}/time-off`, { method: 'POST', body: payload }),
    deleteTimeOff: (id: number, blockId: number) =>
      request<void>(`/staff/${id}/time-off/${blockId}`, { method: 'DELETE' }),
  },
  services: {
    list: (includeInactive = false) =>
      request<Service[]>(`/services${query({ include_inactive: includeInactive })}`),
    create: (payload: ServiceInput) =>
      request<Service>('/services', { method: 'POST', body: payload }),
    update: (id: number, payload: Partial<ServiceInput>) =>
      request<Service>(`/services/${id}`, { method: 'PATCH', body: payload }),
  },
  clients: {
    list: (q?: string, tag?: string) => request<Client[]>(`/clients${query({ q, tag })}`),
    get: (id: number) => request<ClientDetail>(`/clients/${id}`),
    create: (payload: ClientInput) => request<Client>('/clients', { method: 'POST', body: payload }),
    update: (id: number, payload: Partial<ClientInput>) =>
      request<Client>(`/clients/${id}`, { method: 'PATCH', body: payload }),
    whatsapp: (id: number, template: 'cumpleanos' | 'reactivacion' | 'gracias') =>
      request<WhatsAppLink>(`/clients/${id}/whatsapp${query({ template })}`),
  },
  appointments: {
    list: (date: string, staffId?: number) =>
      request<Appointment[]>(`/appointments${query({ date, staff_id: staffId })}`),
    get: (id: number) => request<Appointment>(`/appointments/${id}`),
    availability: (serviceId: number, date: string, staffId?: number) =>
      request<Availability>(
        `/availability${query({ service_id: serviceId, date, staff_id: staffId })}`,
      ),
    create: (payload: AppointmentInput) =>
      request<Appointment>('/appointments', { method: 'POST', body: payload }),
    update: (id: number, payload: { start_at?: string; staff_id?: number; service_id?: number; notes?: string }) =>
      request<Appointment>(`/appointments/${id}`, { method: 'PATCH', body: payload }),
    setStatus: (id: number, status: AppointmentStatus, reason?: string) =>
      request<Appointment>(`/appointments/${id}/status`, {
        method: 'POST',
        body: { status, reason },
      }),
    whatsapp: (id: number, template: 'recordatorio' | 'confirmacion' | 'gracias') =>
      request<WhatsAppLink>(`/appointments/${id}/whatsapp${query({ template })}`),
  },
  payments: {
    list: (date: string) => request<Payment[]>(`/payments${query({ date })}`),
    create: (payload: {
      appointment_id: number
      amount_cents?: number
      tip_cents: number
      method: PaymentMethod
      reference?: string | null
    }) => request<Payment>('/payments', { method: 'POST', body: payload }),
    downloadReceipt: (id: number) => downloadFile(`/payments/${id}/receipt`, `recibo-${id}.txt`),
  },
  expenses: {
    list: (date: string) => request<Expense[]>(`/expenses${query({ date })}`),
    create: (payload: { concept: string; category: string; amount_cents: number }) =>
      request<Expense>('/expenses', { method: 'POST', body: payload }),
  },
  cash: {
    summary: (date: string) => request<CashSummary>(`/cash/summary${query({ date })}`),
  },
  dashboard: () => request<Dashboard>('/dashboard'),
  audit: {
    list: (limit = 20) => request<AuditEntry[]>(`/audit${query({ limit })}`),
  },
  whatsapp: {
    status: () => request<WhatsAppStatus>('/whatsapp/status'),
    outbox: (limit = 40) => request<MessageLog[]>(`/whatsapp/outbox${query({ limit })}`),
    mock: (phone: string, text: string) =>
      request<WhatsAppMockResponse>('/whatsapp/mock', {
        method: 'POST',
        body: { phone, text },
      }),
    manual: {
      list: () => request<ManualMessage[]>('/whatsapp/manual'),
      create: (payload: ManualMessageCreate) =>
        request<ManualMessage>('/whatsapp/manual', { method: 'POST', body: payload }),
      prepare: (id: number) =>
        request<ManualMessage>(`/whatsapp/manual/${id}/prepare`, { method: 'POST' }),
      opened: (id: number) =>
        request<ManualMessage>(`/whatsapp/manual/${id}/opened`, { method: 'POST' }),
      confirm: (id: number) =>
        request<ManualMessage>(`/whatsapp/manual/${id}/confirm`, { method: 'POST' }),
      failed: (id: number, reason?: string) =>
        request<ManualMessage>(`/whatsapp/manual/${id}/failed`, {
          method: 'POST',
          body: { reason },
        }),
    },
  },
  marketing: {
    templates: () => request<MarketingTemplate[]>('/marketing/templates'),
    segments: () => request<MarketingSegment[]>('/marketing/segments'),
    calendar: () => request<MarketingCalendarItem[]>('/marketing/calendar'),
    campaign: (templateKey: string, segment: string) =>
      request<MarketingCampaignResult>('/marketing/campaigns', {
        method: 'POST',
        body: { template_key: templateKey, segment },
      }),
  },
  reports: {
    summary: (start: string, end: string) =>
      request<Report>(`/reports/summary${query({ start, end })}`),
    exportCsv: (start: string, end: string) =>
      downloadFile(`/reports/export.csv${query({ start, end })}`, `bellessa-${start}-${end}.csv`),
  },
  public: {
    business: (slug: string) => request<PublicBusiness>(`/public/${encodeURIComponent(slug)}`, { auth: false }),
    availability: (slug: string, serviceId: number, date: string, staffId?: number) =>
      request<Availability>(
        `/public/${encodeURIComponent(slug)}/availability${query({
          service_id: serviceId,
          date,
          staff_id: staffId,
        })}`,
        { auth: false },
      ),
    book: (slug: string, payload: PublicBookingInput) =>
      request<PublicBookingResponse>(`/public/${encodeURIComponent(slug)}/book`, {
        method: 'POST',
        body: payload,
        auth: false,
      }),
  },
}
