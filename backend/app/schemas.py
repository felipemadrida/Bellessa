from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, PlainSerializer, computed_field

from .models import AppointmentStatus, PaymentMethod, UserRole


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UtcDatetime = Annotated[
    datetime,
    BeforeValidator(_as_utc),
    PlainSerializer(
        lambda value: _as_utc(value).isoformat().replace("+00:00", "Z"),
        return_type=str,
        when_used="json",
    ),
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Negocio / configuración
# ---------------------------------------------------------------------------
class BusinessHourOut(ORMModel):
    weekday: int
    closed: bool
    open_minute: int
    close_minute: int


class BusinessHourIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    closed: bool = False
    open_minute: int = Field(default=540, ge=0, le=1439)
    close_minute: int = Field(default=1140, ge=1, le=1440)


class BusinessOut(ORMModel):
    id: int
    name: str
    slug: str
    legal_name: str | None = None
    rfc: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    email: str | None = None
    address: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    instagram: str | None = None
    timezone: str
    currency: str
    tax_rate_bps: int
    require_deposit: bool
    deposit_percent: int
    cancellation_hours: int
    min_notice_minutes: int
    booking_window_days: int
    slot_step_minutes: int
    monthly_goal_cents: int
    hours: list[BusinessHourOut] = []


class BusinessUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    legal_name: str | None = None
    rfc: str | None = Field(default=None, max_length=13)
    phone: str | None = None
    whatsapp: str | None = None
    email: str | None = None
    address: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    instagram: str | None = None
    require_deposit: bool | None = None
    deposit_percent: int | None = Field(default=None, ge=0, le=100)
    cancellation_hours: int | None = Field(default=None, ge=0, le=168)
    min_notice_minutes: int | None = Field(default=None, ge=0, le=1440)
    booking_window_days: int | None = Field(default=None, ge=1, le=365)
    monthly_goal_cents: int | None = Field(default=None, ge=0)


# ---------------------------------------------------------------------------
# Staff / horarios
# ---------------------------------------------------------------------------
class WorkingHourOut(ORMModel):
    weekday: int
    closed: bool
    start_minute: int
    end_minute: int


class WorkingHourIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    closed: bool = False
    start_minute: int = Field(default=540, ge=0, le=1439)
    end_minute: int = Field(default=1140, ge=1, le=1440)


class StaffOut(ORMModel):
    id: int
    name: str
    email: str
    phone: str | None = None
    role: UserRole
    color: str
    commission_bps: int
    bio: str | None = None
    active: bool
    working_hours: list[WorkingHourOut] = []


class StaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None
    role: UserRole = UserRole.staff
    color: str = "#C2415A"
    commission_bps: int = Field(default=0, ge=0, le=10000)
    bio: str | None = None


class StaffUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None
    color: str | None = None
    commission_bps: int | None = Field(default=None, ge=0, le=10000)
    bio: str | None = None
    active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class TimeOffOut(ORMModel):
    id: int
    staff_id: int
    start_at: UtcDatetime
    end_at: UtcDatetime
    reason: str | None = None


class TimeOffCreate(BaseModel):
    """Bloqueo por día(s) completo(s), en la zona horaria del salón."""

    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=160)


# ---------------------------------------------------------------------------
# Servicios
# ---------------------------------------------------------------------------
class ServiceOut(ORMModel):
    id: int
    name: str
    description: str | None = None
    category: str
    duration_min: int
    buffer_min: int
    price_cents: int
    deposit_cents: int
    color: str
    active: bool
    sort_order: int


class ServiceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None
    category: str = "General"
    duration_min: int = Field(default=60, ge=5, le=600)
    buffer_min: int = Field(default=10, ge=0, le=120)
    price_cents: int = Field(default=0, ge=0)
    deposit_cents: int = Field(default=0, ge=0)
    color: str = "#C2415A"
    sort_order: int = 0


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    category: str | None = None
    duration_min: int | None = Field(default=None, ge=5, le=600)
    buffer_min: int | None = Field(default=None, ge=0, le=120)
    price_cents: int | None = Field(default=None, ge=0)
    deposit_cents: int | None = Field(default=None, ge=0)
    color: str | None = None
    active: bool | None = None
    sort_order: int | None = None


# ---------------------------------------------------------------------------
# Clientas
# ---------------------------------------------------------------------------
class ClientOut(ORMModel):
    id: int
    name: str
    phone: str
    email: str | None = None
    birthday: date | None = None
    notes: str | None = None
    tags: str | None = None
    rfc: str | None = None
    accepts_marketing: bool
    last_visit_at: UtcDatetime | None = None
    created_at: UtcDatetime


class ClientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=30)
    email: str | None = None
    birthday: date | None = None
    notes: str | None = None
    tags: str | None = None
    rfc: str | None = Field(default=None, max_length=13)
    accepts_marketing: bool = True


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, min_length=8, max_length=30)
    email: str | None = None
    birthday: date | None = None
    notes: str | None = None
    tags: str | None = None
    rfc: str | None = Field(default=None, max_length=13)
    accepts_marketing: bool | None = None


# ---------------------------------------------------------------------------
# Citas
# ---------------------------------------------------------------------------
class ClientBrief(ORMModel):
    id: int
    name: str
    phone: str
    tags: str | None = None


class ServiceBrief(ORMModel):
    id: int
    name: str
    duration_min: int
    price_cents: int
    color: str
    category: str


class StaffBrief(ORMModel):
    id: int
    name: str
    color: str


class AppointmentOut(ORMModel):
    id: int
    start_at: UtcDatetime
    end_at: UtcDatetime
    status: AppointmentStatus
    price_cents: int
    deposit_cents: int
    notes: str | None = None
    source: str
    confirmation_code: str
    client: ClientBrief
    service: ServiceBrief
    staff: StaffBrief
    created_at: UtcDatetime
    payment: PaymentOut | None = None


class ClientStats(BaseModel):
    visits: int
    spent_cents: int
    avg_ticket_cents: int
    favorite_service: str | None = None
    next_appointment_at: datetime | None = None
    loyalty_points: int = 0
    loyalty_level: str = "nueva"
    loyalty_next_reward_in: int = 0
    loyalty_reward_available: bool = False
    loyalty_spent_12m_cents: int = 0


class ClientDetail(ClientOut):
    stats: ClientStats
    appointments: list[AppointmentOut] = []


class AppointmentCreate(BaseModel):
    client_id: int
    service_id: int
    staff_id: int
    start_at: datetime
    notes: str | None = None
    status: AppointmentStatus = AppointmentStatus.confirmed
    source: Literal["staff", "whatsapp", "public"] = "staff"


class AppointmentUpdate(BaseModel):
    service_id: int | None = None
    staff_id: int | None = None
    start_at: datetime | None = None
    notes: str | None = None


class AppointmentStatusIn(BaseModel):
    status: AppointmentStatus
    reason: str | None = None


class AvailabilitySlot(BaseModel):
    start_at: str  # ISO local con offset de México
    end_at: str
    start_utc: str
    staff_id: int
    staff_name: str
    staff_color: str


class AvailabilityOut(BaseModel):
    date: date
    duration_min: int
    timezone: str
    slots: list[AvailabilitySlot]


class WhatsAppOut(BaseModel):
    url: str
    text: str
    phone: str


# ---------------------------------------------------------------------------
# Pagos / caja
# ---------------------------------------------------------------------------
class PaymentAppointment(ORMModel):
    id: int
    client: ClientBrief
    service: ServiceBrief
    staff: StaffBrief


class PaymentOut(ORMModel):
    id: int
    appointment_id: int | None = None
    amount_cents: int
    tip_cents: int
    method: PaymentMethod
    reference: str | None = None
    created_at: UtcDatetime
    appointment: PaymentAppointment | None = None

    @computed_field
    @property
    def total_cents(self) -> int:
        return self.amount_cents + self.tip_cents


class PaymentCreate(BaseModel):
    appointment_id: int
    amount_cents: int | None = Field(default=None, ge=0)
    tip_cents: int = Field(default=0, ge=0)
    method: PaymentMethod = PaymentMethod.cash
    reference: str | None = None


class ExpenseOut(ORMModel):
    id: int
    concept: str
    category: str
    amount_cents: int
    created_at: UtcDatetime


class ExpenseCreate(BaseModel):
    concept: str = Field(min_length=2, max_length=160)
    category: str = "Insumos"
    amount_cents: int = Field(gt=0)


class CashSummaryOut(BaseModel):
    date: date
    business_name: str
    currency: str
    income_cents: int
    cash_cents: int
    card_cents: int
    transfer_cents: int
    other_cents: int
    tips_cents: int
    expenses_cents: int
    expected_cash_cents: int
    payments_count: int
    completed_appointments: int
    average_ticket_cents: int
    payments: list[PaymentOut]
    expenses: list[ExpenseOut]


# ---------------------------------------------------------------------------
# Dashboard / reportes
# ---------------------------------------------------------------------------
class DayRevenue(BaseModel):
    date: date
    label: str
    revenue_cents: int
    appointments: int


class TopService(BaseModel):
    service_id: int
    name: str
    color: str
    count: int
    revenue_cents: int


class StaffPerformance(BaseModel):
    staff_id: int
    name: str
    color: str
    appointments: int
    revenue_cents: int
    commission_cents: int
    occupancy_pct: int


class TopClient(BaseModel):
    client_id: int
    name: str
    visits: int
    spent_cents: int


class DashboardOut(BaseModel):
    date: date
    today_label: str
    business: BusinessOut
    revenue_today_cents: int
    revenue_week_cents: int
    revenue_month_cents: int
    revenue_goal_cents: int
    tips_today_cents: int
    appointments_today: int
    completed_today: int
    pending_today: int
    upcoming: list[AppointmentOut]
    average_ticket_cents: int
    expected_cash_cents: int
    occupancy_pct: int
    new_clients_month: int
    birthdays: list[ClientOut]
    unconfirmed: int
    revenue_last_7_days: list[DayRevenue]
    top_services: list[TopService]


class ReportOut(BaseModel):
    start: date
    end: date
    revenue_cents: int
    tips_cents: int
    payments_count: int
    avg_ticket_cents: int
    completed_appointments: int
    canceled_appointments: int
    no_show_appointments: int
    new_clients: int
    recurring_clients: int
    occupancy_pct: int
    by_day: list[DayRevenue]
    by_method: dict[str, int]
    top_services: list[TopService]
    staff: list[StaffPerformance]
    top_clients: list[TopClient]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    business_name: str = Field(min_length=2, max_length=120)
    owner_name: str = Field(min_length=2, max_length=120)
    email: str
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None
    city: str | None = None
    slug: str | None = None


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: StaffOut
    business: BusinessOut


class MeOut(BaseModel):
    user: StaffOut
    business: BusinessOut


class AuditOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None = None
    detail: str | None = None
    user_name: str | None = None
    created_at: UtcDatetime


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None


# ---------------------------------------------------------------------------
# Reserva pública
# ---------------------------------------------------------------------------
class PublicBusinessOut(BaseModel):
    name: str
    slug: str
    address: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    instagram: str | None = None
    timezone: str
    currency: str
    require_deposit: bool
    deposit_percent: int
    cancellation_hours: int
    hours: list[BusinessHourOut]
    services: list[ServiceOut]
    staff: list[StaffBrief]


class PublicBookingIn(BaseModel):
    service_id: int
    staff_id: int
    start_at: datetime
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=30)
    email: str | None = None
    notes: str | None = None
    accepts_marketing: bool = True


class PublicBookingOut(BaseModel):
    appointment: AppointmentOut
    confirmation_code: str
    business: PublicBusinessOut
    whatsapp_url: str


# ---------------------------------------------------------------------------
# WhatsApp / marketing
# ---------------------------------------------------------------------------
class MessageLogOut(ORMModel):
    id: int
    phone: str
    kind: str
    template_key: str | None = None
    body: str
    status: str
    provider: str
    scheduled_for: UtcDatetime | None = None
    sent_at: UtcDatetime | None = None
    error: str | None = None
    created_at: UtcDatetime
    client_name: str | None = None


class WhatsAppStatusOut(BaseModel):
    provider: str
    configured: bool
    webhook_url: str
    phone_number_id: str | None = None
    verify_token_configured: bool
    scheduler_enabled: bool
    business_slug: str
    bot_phone: str | None = None


class WhatsAppMockIn(BaseModel):
    phone: str = Field(min_length=8, max_length=30)
    text: str = Field(min_length=1, max_length=1000)


class WhatsAppMockOut(BaseModel):
    replies: list[str]


class MarketingTemplateOut(BaseModel):
    key: str
    label: str
    description: str
    preview: str
    marketing: bool


class MarketingSegmentOut(BaseModel):
    key: str
    label: str
    description: str
    count: int


class MarketingCampaignIn(BaseModel):
    template_key: str
    segment: str


class MarketingCampaignOut(BaseModel):
    template_key: str
    segment: str
    queued: int
    skipped: int


# ---------------------------------------------------------------------------
# Plataforma SaaS (superadmin)
# ---------------------------------------------------------------------------
class PlatformLoginIn(BaseModel):
    email: str
    password: str


class PlatformAdminOut(ORMModel):
    id: int
    name: str
    email: str
    active: bool
    created_at: UtcDatetime


class PlatformLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: PlatformAdminOut


class PlatformTenantOut(BaseModel):
    business_id: int
    name: str
    slug: str
    owner_name: str | None = None
    owner_email: str | None = None
    phone: str | None = None
    city: str | None = None
    plan: str
    status: str
    trial_ends_at: UtcDatetime | None = None
    notes: str | None = None
    clients_count: int
    staff_count: int
    appointments_30d: int
    revenue_30d_cents: int
    created_at: UtcDatetime


class PlatformTenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=80)
    owner_name: str = Field(min_length=2, max_length=120)
    owner_email: str = Field(min_length=5, max_length=160)
    owner_password: str | None = Field(default=None, min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=30)
    city: str | None = Field(default="Ciudad de México", max_length=120)
    state: str | None = Field(default="CDMX", max_length=120)
    plan: str = "free"
    status: str = "trial"
    notes: str | None = Field(default=None, max_length=1000)


class PlatformTenantCreatedOut(PlatformTenantOut):
    generated_password: str | None = None


class PlatformTenantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    owner_name: str | None = Field(default=None, min_length=2, max_length=120)
    owner_email: str | None = Field(default=None, min_length=5, max_length=160)
    owner_password: str | None = Field(default=None, min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=30)
    city: str | None = Field(default=None, max_length=120)
    plan: str | None = None
    status: str | None = None
    notes: str | None = Field(default=None, max_length=1000)


class PlatformPlanOut(BaseModel):
    key: str
    label: str
    price_mxn: int
    max_staff: int
    max_appointments_month: int
    marketing_automation: bool


class PlatformOverviewOut(BaseModel):
    total_tenants: int
    active_tenants: int
    trial_tenants: int
    suspended_tenants: int
    archived_tenants: int
    total_clients: int
    total_staff: int
    appointments_30d: int
    revenue_30d_cents: int
    mrr_cents: int
    plan_counts: dict[str, int]
    plans: list[PlatformPlanOut]


# Resolver referencias adelantadas (AppointmentOut -> PaymentOut).
AppointmentOut.model_rebuild()
PublicBookingOut.model_rebuild()
PaymentOut.model_rebuild()
ClientDetail.model_rebuild()
PlatformLoginOut.model_rebuild()

