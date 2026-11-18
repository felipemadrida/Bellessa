export type UserRole = 'owner' | 'staff'
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'canceled' | 'no_show'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export interface BusinessHour {
  weekday: number
  closed: boolean
  open_minute: number
  close_minute: number
}

export interface Business {
  id: number
  name: string
  slug: string
  legal_name: string | null
  rfc: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  instagram: string | null
  timezone: string
  currency: string
  locale: string
  brand_color: string
  tax_rate_bps: number
  require_deposit: boolean
  deposit_percent: number
  cancellation_hours: number
  min_notice_minutes: number
  booking_window_days: number
  slot_step_minutes: number
  monthly_goal_cents: number
  hours: BusinessHour[]
}

export interface WorkingHour {
  weekday: number
  closed: boolean
  start_minute: number
  end_minute: number
}

export interface TimeOff {
  id: number
  staff_id: number
  start_at: string
  end_at: string
  reason: string | null
}

export interface AuditEntry {
  id: number
  action: string
  entity_type: string
  entity_id: number | null
  detail: string | null
  user_name: string | null
  created_at: string
}

export interface MessageLog {
  id: number
  phone: string
  kind: string
  template_key: string | null
  body: string
  status: string
  provider: string
  scheduled_for: string | null
  sent_at: string | null
  error: string | null
  created_at: string
  client_name: string | null
}

export interface Product {
  id: number
  name: string
  sku: string | null
  category: string
  description: string | null
  price_cents: number
  cost_cents: number
  stock: number
  min_stock: number
  unit: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface ProductCreate {
  name: string
  sku?: string | null
  category?: string
  description?: string | null
  price_cents?: number
  cost_cents?: number
  stock?: number
  min_stock?: number
  unit?: string
}

export interface ProductUpdate {
  name?: string
  sku?: string | null
  category?: string
  description?: string | null
  price_cents?: number
  cost_cents?: number
  min_stock?: number
  unit?: string
  active?: boolean
}

export interface StockMovement {
  id: number
  product_id: number
  product_name: string | null
  kind: string
  quantity: number
  reason: string | null
  reference: string | null
  created_at: string
}

export interface InventorySummary {
  products: number
  active_products: number
  low_stock: number
  stock_units: number
  inventory_value_cents: number
}

export interface ManualMessage extends MessageLog {
  client_id: number | null
  appointment_id: number | null
  wa_url: string | null
}

export interface ManualMessageCreate {
  client_id?: number | null
  appointment_id?: number | null
  template_key: string
  body?: string | null
}

export interface WhatsAppStatus {
  provider: string
  configured: boolean
  webhook_url: string
  phone_number_id: string | null
  verify_token_configured: boolean
  scheduler_enabled: boolean
  business_slug: string
  bot_phone: string | null
}

export interface WhatsAppMockResponse {
  replies: string[]
}

export interface MarketingTemplate {
  key: string
  label: string
  description: string
  preview: string
  marketing: boolean
}

export interface MarketingSegment {
  key: string
  label: string
  description: string
  count: number
}

export interface MarketingCampaignResult {
  template_key: string
  segment: string
  queued: number
  skipped: number
}

export interface MarketingCalendarItem {
  month: number
  focus: string
  action: string
}

export interface PlatformAdmin {
  id: number
  name: string
  email: string
  active: boolean
  created_at: string
}

export interface PlatformLoginResponse {
  access_token: string
  token_type: string
  admin: PlatformAdmin
}

export interface PlatformTenant {
  business_id: number
  name: string
  slug: string
  owner_name: string | null
  owner_email: string | null
  phone: string | null
  city: string | null
  plan: string
  status: string
  trial_ends_at: string | null
  notes: string | null
  clients_count: number
  staff_count: number
  appointments_30d: number
  revenue_30d_cents: number
  created_at: string
}

export interface PlatformTenantCreate {
  name: string
  slug?: string | null
  owner_name: string
  owner_email: string
  owner_password?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  plan: string
  status: string
  notes?: string | null
}

export interface PlatformTenantCreated extends PlatformTenant {
  generated_password: string | null
}

export interface PlatformTenantUpdate {
  name?: string
  slug?: string
  owner_name?: string
  owner_email?: string
  owner_password?: string
  phone?: string
  city?: string
  plan?: string
  status?: string
  notes?: string | null
}

export interface PlatformPlan {
  key: string
  label: string
  price_mxn: number
  max_staff: number
  max_appointments_month: number
  marketing_automation: boolean
}

export interface PlatformOverview {
  total_tenants: number
  active_tenants: number
  trial_tenants: number
  suspended_tenants: number
  archived_tenants: number
  total_clients: number
  total_staff: number
  appointments_30d: number
  revenue_30d_cents: number
  mrr_cents: number
  plan_counts: Record<string, number>
  plans: PlatformPlan[]
}

export interface Staff {
  id: number
  name: string
  email: string
  phone: string | null
  role: UserRole
  color: string
  commission_bps: number
  bio: string | null
  active: boolean
  working_hours: WorkingHour[]
}

export interface Service {
  id: number
  name: string
  description: string | null
  category: string
  duration_min: number
  buffer_min: number
  price_cents: number
  deposit_cents: number
  color: string
  active: boolean
  sort_order: number
}

export interface Client {
  id: number
  name: string
  phone: string
  email: string | null
  birthday: string | null
  notes: string | null
  tags: string | null
  rfc: string | null
  accepts_marketing: boolean
  last_visit_at: string | null
  created_at: string
}

export interface ClientStats {
  visits: number
  spent_cents: number
  avg_ticket_cents: number
  favorite_service: string | null
  next_appointment_at: string | null
  loyalty_points: number
  loyalty_level: string
  loyalty_next_reward_in: number
  loyalty_reward_available: boolean
  loyalty_spent_12m_cents: number
}

export interface ClientBrief {
  id: number
  name: string
  phone: string
  tags: string | null
}

export interface ServiceBrief {
  id: number
  name: string
  duration_min: number
  price_cents: number
  color: string
  category: string
}

export interface StaffBrief {
  id: number
  name: string
  color: string
}

export interface Appointment {
  id: number
  start_at: string
  end_at: string
  status: AppointmentStatus
  price_cents: number
  deposit_cents: number
  notes: string | null
  source: string
  confirmation_code: string
  client: ClientBrief
  service: ServiceBrief
  staff: StaffBrief
  created_at: string
  payment: Payment | null
}

export interface ClientDetail extends Client {
  stats: ClientStats
  appointments: Appointment[]
}

export interface Payment {
  id: number
  appointment_id: number | null
  amount_cents: number
  tip_cents: number
  method: PaymentMethod
  reference: string | null
  created_at: string
  total_cents: number
  appointment?: {
    id: number
    client: ClientBrief
    service: ServiceBrief
    staff: StaffBrief
  } | null
}

export interface Expense {
  id: number
  concept: string
  category: string
  amount_cents: number
  created_at: string
}

export interface CashSummary {
  date: string
  business_name: string
  currency: string
  income_cents: number
  cash_cents: number
  card_cents: number
  transfer_cents: number
  other_cents: number
  tips_cents: number
  expenses_cents: number
  expected_cash_cents: number
  payments_count: number
  completed_appointments: number
  average_ticket_cents: number
  payments: Payment[]
  expenses: Expense[]
}

export interface AvailabilitySlot {
  start_at: string
  end_at: string
  start_utc: string
  staff_id: number
  staff_name: string
  staff_color: string
}

export interface Availability {
  date: string
  duration_min: number
  timezone: string
  slots: AvailabilitySlot[]
}

export interface DayRevenue {
  date: string
  label: string
  revenue_cents: number
  appointments: number
}

export interface TopService {
  service_id: number
  name: string
  color: string
  count: number
  revenue_cents: number
}

export interface Dashboard {
  date: string
  today_label: string
  business: Business
  revenue_today_cents: number
  revenue_week_cents: number
  revenue_month_cents: number
  revenue_goal_cents: number
  tips_today_cents: number
  appointments_today: number
  completed_today: number
  pending_today: number
  upcoming: Appointment[]
  average_ticket_cents: number
  expected_cash_cents: number
  occupancy_pct: number
  new_clients_month: number
  birthdays: Client[]
  unconfirmed: number
  revenue_last_7_days: DayRevenue[]
  top_services: TopService[]
}

export interface StaffPerformance {
  staff_id: number
  name: string
  color: string
  appointments: number
  revenue_cents: number
  commission_cents: number
  occupancy_pct: number
}

export interface TopClient {
  client_id: number
  name: string
  visits: number
  spent_cents: number
}

export interface Report {
  start: string
  end: string
  revenue_cents: number
  tips_cents: number
  payments_count: number
  avg_ticket_cents: number
  completed_appointments: number
  canceled_appointments: number
  no_show_appointments: number
  new_clients: number
  recurring_clients: number
  occupancy_pct: number
  by_day: DayRevenue[]
  by_method: Record<PaymentMethod, number>
  top_services: TopService[]
  staff: StaffPerformance[]
  top_clients: TopClient[]
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: Staff
  business: Business
}

export interface PublicBusiness {
  name: string
  slug: string
  address: string | null
  neighborhood: string | null
  city: string | null
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  timezone: string
  currency: string
  locale: string
  brand_color: string
  require_deposit: boolean
  deposit_percent: number
  cancellation_hours: number
  hours: BusinessHour[]
  services: Service[]
  staff: StaffBrief[]
}

export interface PublicBookingResponse {
  appointment: Appointment
  confirmation_code: string
  business: PublicBusiness
  whatsapp_url: string
}

export interface WhatsAppLink {
  url: string
  text: string
  phone: string
}
