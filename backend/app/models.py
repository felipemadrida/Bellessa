from __future__ import annotations

import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    """UTC sin tzinfo: SQLite y Postgres guardan timestamp sin zona de forma consistente."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AppointmentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    completed = "completed"
    canceled = "canceled"
    no_show = "no_show"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    card = "card"
    transfer = "transfer"
    other = "other"


class UserRole(str, enum.Enum):
    owner = "owner"
    staff = "staff"


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    legal_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    rfc: Mapped[str | None] = mapped_column(String(13), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    address: Mapped[str | None] = mapped_column(String(240), nullable=True)
    neighborhood: Mapped[str | None] = mapped_column(String(120), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), default="Ciudad de México")
    state: Mapped[str | None] = mapped_column(String(120), default="CDMX")
    instagram: Mapped[str | None] = mapped_column(String(80), nullable=True)
    timezone: Mapped[str] = mapped_column(String(60), default="America/Mexico_City")
    currency: Mapped[str] = mapped_column(String(3), default="MXN")
    tax_rate_bps: Mapped[int] = mapped_column(Integer, default=1600)  # IVA 16% incluido en precios
    require_deposit: Mapped[bool] = mapped_column(Boolean, default=False)
    deposit_percent: Mapped[int] = mapped_column(Integer, default=30)
    cancellation_hours: Mapped[int] = mapped_column(Integer, default=12)
    min_notice_minutes: Mapped[int] = mapped_column(Integer, default=60)
    booking_window_days: Mapped[int] = mapped_column(Integer, default=60)
    slot_step_minutes: Mapped[int] = mapped_column(Integer, default=15)
    monthly_goal_cents: Mapped[int] = mapped_column(Integer, default=6000000)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    hours: Mapped[list[BusinessHour]] = relationship(
        back_populates="business",
        cascade="all, delete-orphan",
        order_by="BusinessHour.weekday",
        lazy="selectin",
    )
    staff: Mapped[list[User]] = relationship(
        back_populates="business", cascade="all, delete-orphan", lazy="selectin"
    )
    services: Mapped[list[Service]] = relationship(
        back_populates="business", cascade="all, delete-orphan", lazy="selectin"
    )


class BusinessHour(Base):
    __tablename__ = "business_hours"
    __table_args__ = (UniqueConstraint("business_id", "weekday", name="uq_business_hour"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    weekday: Mapped[int] = mapped_column(Integer)  # 0 = lunes
    closed: Mapped[bool] = mapped_column(Boolean, default=False)
    open_minute: Mapped[int] = mapped_column(Integer, default=540)  # 9:00
    close_minute: Mapped[int] = mapped_column(Integer, default=1140)  # 19:00

    business: Mapped[Business] = relationship(back_populates="hours")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, native_enum=False, length=20), default=UserRole.staff
    )
    color: Mapped[str] = mapped_column(String(9), default="#C2415A")
    commission_bps: Mapped[int] = mapped_column(Integer, default=0)  # puntos base (3000 = 30%)
    bio: Mapped[str | None] = mapped_column(String(240), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    business: Mapped[Business] = relationship(back_populates="staff")
    working_hours: Mapped[list[WorkingHour]] = relationship(
        back_populates="staff", cascade="all, delete-orphan", lazy="selectin"
    )
    time_off: Mapped[list[TimeOff]] = relationship(
        back_populates="staff", cascade="all, delete-orphan", lazy="selectin"
    )
    appointments: Mapped[list[Appointment]] = relationship(
        back_populates="staff", foreign_keys="Appointment.staff_id"
    )


class WorkingHour(Base):
    __tablename__ = "working_hours"
    __table_args__ = (UniqueConstraint("staff_id", "weekday", name="uq_staff_hour"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    weekday: Mapped[int] = mapped_column(Integer)
    closed: Mapped[bool] = mapped_column(Boolean, default=False)
    start_minute: Mapped[int] = mapped_column(Integer, default=540)
    end_minute: Mapped[int] = mapped_column(Integer, default=1140)

    staff: Mapped[User] = relationship(back_populates="working_hours")


class TimeOff(Base):
    __tablename__ = "time_off"

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    reason: Mapped[str | None] = mapped_column(String(160), nullable=True)

    staff: Mapped[User] = relationship(back_populates="time_off")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(60), default="General")
    duration_min: Mapped[int] = mapped_column(Integer, default=60)
    buffer_min: Mapped[int] = mapped_column(Integer, default=10)
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    deposit_cents: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(9), default="#C2415A")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    business: Mapped[Business] = relationship(back_populates="services")


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    phone: Mapped[str] = mapped_column(String(30), index=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(String(240), nullable=True)  # separados por coma
    rfc: Mapped[str | None] = mapped_column(String(13), nullable=True)
    accepts_marketing: Mapped[bool] = mapped_column(Boolean, default=True)
    last_visit_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    appointments: Mapped[list[Appointment]] = relationship(back_populates="client")


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime, index=True)  # UTC naive
    end_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[AppointmentStatus] = mapped_column(
        SAEnum(AppointmentStatus, native_enum=False, length=20),
        default=AppointmentStatus.pending,
        index=True,
    )
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    deposit_cents: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="staff")  # staff | public | whatsapp
    confirmation_code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    client: Mapped[Client] = relationship(back_populates="appointments", lazy="joined")
    staff: Mapped[User] = relationship(back_populates="appointments", foreign_keys=[staff_id], lazy="joined")
    service: Mapped[Service] = relationship(lazy="joined")
    payment: Mapped[Payment | None] = relationship(back_populates="appointment", uselist=False, lazy="selectin")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    appointment_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id"), unique=True, nullable=True
    )
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True)
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    tip_cents: Mapped[int] = mapped_column(Integer, default=0)
    method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod, native_enum=False, length=20), default=PaymentMethod.cash
    )
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    appointment: Mapped[Appointment | None] = relationship(back_populates="payment")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    concept: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(60), default="Insumos")
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class AuditLog(Base):
    """Bitácora de acciones sensibles. No guarda datos completos de clientas."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    user: Mapped[User | None] = relationship(lazy="joined")


class WhatsAppConversation(Base):
    """Estado del bot por teléfono. Permite retomar el flujo si el cliente tarda."""

    __tablename__ = "whatsapp_conversations"
    __table_args__ = (UniqueConstraint("business_id", "phone", name="uq_whatsapp_phone"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True
    )
    phone: Mapped[str] = mapped_column(String(30), index=True)
    step: Mapped[str] = mapped_column(String(30), default="start")
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    requested_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    slot_utc: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    draft_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_appointment_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PlatformAdmin(Base):
    """Dueño de la plataforma SaaS; no pertenece a ningún salón."""

    __tablename__ = "platform_admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TenantAccount(Base):
    """Plan y estado comercial de un salón, separado de sus datos operativos."""

    __tablename__ = "tenant_accounts"
    __table_args__ = (UniqueConstraint("business_id", name="uq_tenant_business"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True, unique=True
    )
    plan: Mapped[str] = mapped_column(String(20), default="free")
    status: Mapped[str] = mapped_column(String(20), default="trial")
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    business: Mapped[Business] = relationship(lazy="joined")


class Product(Base):
    """Producto de inventario; los importes se guardan en centavos."""

    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("business_id", "sku", name="uq_product_sku"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    sku: Mapped[str | None] = mapped_column(String(60), nullable=True)
    category: Mapped[str] = mapped_column(String(80), default="General")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=0)
    unit: Mapped[str] = mapped_column(String(30), default="pieza")
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class StockMovement(Base):
    """Entrada, salida o ajuste de inventario con trazabilidad."""

    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))  # in | out | adjustment
    quantity: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(String(240), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(80), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    product: Mapped[Product] = relationship(lazy="joined")


class MessageLog(Base):
    """Bandeja de salida: simulador, recordatorios, campañas y avisos internos."""

    __tablename__ = "message_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    appointment_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id"), nullable=True
    )
    phone: Mapped[str] = mapped_column(String(30), index=True)
    kind: Mapped[str] = mapped_column(String(40), index=True)
    template_key: Mapped[str | None] = mapped_column(String(60), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="mock_sent", index=True)
    provider: Mapped[str] = mapped_column(String(20), default="mock")
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(
        String(120), unique=True, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
