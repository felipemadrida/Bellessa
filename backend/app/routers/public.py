from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..database import get_db
from ..models import (
    Appointment,
    AppointmentStatus,
    Business,
    Client,
    Service,
    User,
)
from ..schemas import (
    AvailabilityOut,
    AvailabilitySlot,
    PublicBookingIn,
    PublicBookingOut,
    PublicBusinessOut,
)
from ..services.availability import compute_slots, is_slot_available, slot_payload
from ..services.booking import ensure_client_has_no_overlap
from ..utils import (
    format_datetime_es,
    local_day_bounds,
    new_confirmation_code,
    normalize_phone_mx,
    to_local,
    to_naive_utc,
    utcnow_naive,
    whatsapp_link,
)

router = APIRouter(prefix="/public", tags=["reservas públicas"])


def _business_by_slug(db: Session, slug: str) -> Business:
    business = db.scalar(select(Business).where(Business.slug == slug))
    if business is None:
        raise HTTPException(status_code=404, detail="Salón no encontrado.")
    return business


def _public_business(db: Session, business: Business) -> PublicBusinessOut:
    services = list(
        db.scalars(
            select(Service)
            .where(Service.business_id == business.id, Service.active.is_(True))
            .order_by(Service.sort_order, Service.id)
        ).all()
    )
    staff = list(
        db.scalars(
            select(User)
            .where(User.business_id == business.id, User.active.is_(True))
            .order_by(User.id)
        ).all()
    )
    return PublicBusinessOut(
        name=business.name,
        slug=business.slug,
        address=business.address,
        neighborhood=business.neighborhood,
        city=business.city,
        phone=business.phone,
        whatsapp=business.whatsapp,
        instagram=business.instagram,
        timezone=business.timezone,
        currency=business.currency,
        require_deposit=business.require_deposit,
        deposit_percent=business.deposit_percent,
        cancellation_hours=business.cancellation_hours,
        hours=business.hours,
        services=services,
        staff=staff,
    )


def _validate_day(business: Business, day: date) -> None:
    today = to_local(utcnow_naive(), business.timezone).date()
    if day < today:
        raise HTTPException(status_code=422, detail="Elige una fecha de hoy en adelante.")
    if day > today + timedelta(days=business.booking_window_days):
        raise HTTPException(status_code=422, detail="Esa fecha está fuera de la ventana de reservas.")


@router.get("/{slug}", response_model=PublicBusinessOut)
def public_business(slug: str, db: Session = Depends(get_db)) -> PublicBusinessOut:
    business = _business_by_slug(db, slug)
    return _public_business(db, business)


@router.get("/{slug}/availability", response_model=AvailabilityOut)
def public_availability(
    slug: str,
    service_id: int,
    day: date = Query(alias="date"),
    staff_id: int | None = None,
    db: Session = Depends(get_db),
) -> AvailabilityOut:
    business = _business_by_slug(db, slug)
    _validate_day(business, day)
    service = db.get(Service, service_id)
    if service is None or service.business_id != business.id or not service.active:
        raise HTTPException(status_code=404, detail="Servicio no disponible.")
    if staff_id is not None:
        member = db.get(User, staff_id)
        if member is None or member.business_id != business.id or not member.active:
            raise HTTPException(status_code=404, detail="Profesional no disponible.")
    slots = compute_slots(db, business, day, service, staff_id=staff_id, enforce_notice=True)
    return AvailabilityOut(
        date=day,
        duration_min=service.duration_min,
        timezone=business.timezone,
        slots=[AvailabilitySlot(**slot_payload(slot)) for slot in slots],
    )


@router.post("/{slug}/book", response_model=PublicBookingOut, status_code=status.HTTP_201_CREATED)
def public_book(
    slug: str, payload: PublicBookingIn, db: Session = Depends(get_db)
) -> PublicBookingOut:
    business = _business_by_slug(db, slug)
    service = db.get(Service, payload.service_id)
    if service is None or service.business_id != business.id or not service.active:
        raise HTTPException(status_code=404, detail="Servicio no disponible.")
    member = db.get(User, payload.staff_id)
    if member is None or member.business_id != business.id or not member.active:
        raise HTTPException(status_code=404, detail="Profesional no disponible.")

    start_at = to_naive_utc(payload.start_at)
    local_day = to_local(start_at, business.timezone).date()
    _validate_day(business, local_day)
    if not is_slot_available(
        db, business, local_day, service, member.id, start_at, enforce_notice=True
    ):
        raise HTTPException(
            status_code=409,
            detail="Ese horario acaba de ocuparse. Elige otro, por favor.",
        )

    phone = normalize_phone_mx(payload.phone)
    if len(phone) != 10:
        raise HTTPException(status_code=422, detail="Escribe un teléfono mexicano a 10 dígitos.")
    client = db.scalar(
        select(Client).where(Client.business_id == business.id, Client.phone == phone)
    )
    if client is None:
        client = Client(
            business_id=business.id,
            name=payload.name.strip(),
            phone=phone,
            email=payload.email,
            notes=payload.notes,
            accepts_marketing=payload.accepts_marketing,
        )
        db.add(client)
        db.flush()

    end_at = start_at + timedelta(minutes=service.duration_min)
    ensure_client_has_no_overlap(db, business, client.id, start_at, end_at)

    deposit = service.deposit_cents
    if business.require_deposit:
        deposit = round(service.price_cents * business.deposit_percent / 100)

    for _ in range(20):
        code = new_confirmation_code()
        if not db.scalar(select(Appointment.id).where(Appointment.confirmation_code == code)):
            break
    else:
        raise HTTPException(status_code=500, detail="No se pudo generar el folio.")

    appointment = Appointment(
        business_id=business.id,
        client_id=client.id,
        staff_id=member.id,
        service_id=service.id,
        start_at=start_at,
        end_at=end_at,
        status=AppointmentStatus.pending,
        price_cents=service.price_cents,
        deposit_cents=deposit,
        notes=payload.notes,
        source="public",
        confirmation_code=code,
    )
    db.add(appointment)
    db.flush()
    record_audit(
        db,
        business_id=business.id,
        user_id=None,
        action="cita.reservada_en_linea",
        entity_type="appointment",
        entity_id=appointment.id,
        detail=f"{client.name} · {service.name} · {format_datetime_es(start_at, business.timezone)}",
    )
    db.commit()
    db.refresh(appointment)

    when = format_datetime_es(appointment.start_at, business.timezone)
    text = (
        f"Hola, soy {client.name.split()[0]}. Acabo de reservar {service.name} "
        f"con {member.name} el {when}. Mi código de confirmación es {code}. "
        f"¿Me confirman, por favor?"
    )
    deposit_note = ""
    if deposit:
        deposit_note = f" Anticipo para apartar: ${deposit / 100:,.2f} MXN."
    return PublicBookingOut(
        appointment=appointment,
        confirmation_code=code,
        business=_public_business(db, business),
        whatsapp_url=whatsapp_link(business.whatsapp or business.phone, text + deposit_note),
    )
