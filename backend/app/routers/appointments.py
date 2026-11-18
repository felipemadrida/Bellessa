from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..config import settings
from ..database import get_db
from ..deps import get_current_business, get_current_user
from ..models import (
    Appointment,
    AppointmentStatus,
    Business,
    Client,
    Service,
    User,
)
from ..schemas import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentStatusIn,
    AppointmentUpdate,
    AvailabilityOut,
    AvailabilitySlot,
    WhatsAppOut,
)
from ..services.availability import compute_slots, is_slot_available, slot_payload
from ..services.booking import ensure_client_has_no_overlap, lock_staff_row
from ..utils import (
    format_datetime_es,
    local_day_bounds,
    new_confirmation_code,
    to_local,
    to_naive_utc,
    utcnow_naive,
    whatsapp_link,
)

router = APIRouter(tags=["agenda"])

TRANSITIONS: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.pending: {AppointmentStatus.confirmed, AppointmentStatus.canceled, AppointmentStatus.no_show},
    AppointmentStatus.confirmed: {AppointmentStatus.completed, AppointmentStatus.canceled, AppointmentStatus.no_show},
    AppointmentStatus.completed: set(),
    AppointmentStatus.canceled: set(),
    AppointmentStatus.no_show: set(),
}


def get_appointment(db: Session, business: Business, appointment_id: int) -> Appointment:
    appointment = db.get(Appointment, appointment_id)
    if appointment is None or appointment.business_id != business.id:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")
    return appointment


def _unique_code(db: Session) -> str:
    for _ in range(20):
        code = new_confirmation_code()
        if not db.scalar(select(Appointment.id).where(Appointment.confirmation_code == code)):
            return code
    raise HTTPException(status_code=500, detail="No se pudo generar el folio de la cita.")


@router.get("/availability", response_model=AvailabilityOut)
def availability(
    service_id: int,
    day: date = Query(alias="date"),
    staff_id: int | None = None,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AvailabilityOut:
    service = db.get(Service, service_id)
    if service is None or service.business_id != business.id or not service.active:
        raise HTTPException(status_code=404, detail="Servicio no disponible.")
    if staff_id is not None:
        member = db.get(User, staff_id)
        if member is None or member.business_id != business.id or not member.active:
            raise HTTPException(status_code=404, detail="Profesional no disponible.")
    slots = compute_slots(db, business, day, service, staff_id=staff_id, enforce_notice=False)
    return AvailabilityOut(
        date=day,
        duration_min=service.duration_min,
        timezone=business.timezone,
        slots=[AvailabilitySlot(**slot_payload(slot)) for slot in slots],
    )


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(
    day: date | None = Query(default=None, alias="date"),
    staff_id: int | None = None,
    appointment_status: AppointmentStatus | None = Query(default=None, alias="status"),
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Appointment]:
    target = day or to_local(utcnow_naive(), business.timezone).date()
    start, end = local_day_bounds(target, business.timezone)
    query = select(Appointment).where(
        Appointment.business_id == business.id,
        Appointment.start_at < end,
        Appointment.end_at > start,
    )
    if staff_id is not None:
        query = query.where(Appointment.staff_id == staff_id)
    if appointment_status is not None:
        query = query.where(Appointment.status == appointment_status)
    query = query.order_by(Appointment.start_at)
    return list(db.scalars(query).unique().all())


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def get_appointment_detail(
    appointment_id: int,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Appointment:
    return get_appointment(db, business, appointment_id)


@router.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Appointment:
    client = db.get(Client, payload.client_id)
    if client is None or client.business_id != business.id:
        raise HTTPException(status_code=404, detail="Clienta no encontrada.")
    service = db.get(Service, payload.service_id)
    if service is None or service.business_id != business.id or not service.active:
        raise HTTPException(status_code=404, detail="Servicio no disponible.")
    member = lock_staff_row(db, payload.staff_id)
    if member is None or member.business_id != business.id or not member.active:
        raise HTTPException(status_code=404, detail="Profesional no disponible.")
    if payload.status not in (AppointmentStatus.pending, AppointmentStatus.confirmed):
        raise HTTPException(status_code=422, detail="Una cita nueva solo puede quedar pendiente o confirmada.")

    start_at = to_naive_utc(payload.start_at)
    local_day = to_local(start_at, business.timezone).date()
    if not is_slot_available(
        db, business, local_day, service, member.id, start_at, enforce_notice=False
    ):
        raise HTTPException(
            status_code=409,
            detail="Ese horario ya no está disponible. Elige otro.",
        )

    end_at = start_at + timedelta(minutes=service.duration_min)
    ensure_client_has_no_overlap(db, business, client.id, start_at, end_at)

    appointment = Appointment(
        business_id=business.id,
        client_id=client.id,
        staff_id=member.id,
        service_id=service.id,
        start_at=start_at,
        end_at=end_at,
        status=payload.status,
        price_cents=service.price_cents,
        deposit_cents=service.deposit_cents,
        notes=payload.notes,
        source=payload.source,
        confirmation_code=_unique_code(db),
        created_by=user.id,
    )
    db.add(appointment)
    db.flush()
    record_audit(
        db,
        business_id=business.id,
        user_id=user.id,
        action="cita.creada",
        entity_type="appointment",
        entity_id=appointment.id,
        detail=f"{client.name} · {service.name} · {format_datetime_es(start_at, business.timezone)}",
    )
    db.commit()
    db.refresh(appointment)
    return appointment


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int,
    payload: AppointmentUpdate,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Appointment:
    appointment = get_appointment(db, business, appointment_id)
    if appointment.status not in (AppointmentStatus.pending, AppointmentStatus.confirmed):
        raise HTTPException(status_code=409, detail="Solo puedes mover citas pendientes o confirmadas.")

    service = db.get(Service, payload.service_id) if payload.service_id else appointment.service
    if service is None or service.business_id != business.id or not service.active:
        raise HTTPException(status_code=404, detail="Servicio no disponible.")
    if payload.staff_id:
        member = lock_staff_row(db, payload.staff_id)
    else:
        member = appointment.staff
    if member is None or member.business_id != business.id or not member.active:
        raise HTTPException(status_code=404, detail="Profesional no disponible.")
    start_at = to_naive_utc(payload.start_at) if payload.start_at else appointment.start_at

    changed_slot = (
        start_at != appointment.start_at
        or member.id != appointment.staff_id
        or service.id != appointment.service_id
    )
    end_at = start_at + timedelta(minutes=service.duration_min)
    if changed_slot:
        local_day = to_local(start_at, business.timezone).date()
        if not is_slot_available(
            db,
            business,
            local_day,
            service,
            member.id,
            start_at,
            exclude_appointment_id=appointment.id,
            enforce_notice=False,
        ):
            raise HTTPException(status_code=409, detail="Ese horario ya no está disponible.")
        ensure_client_has_no_overlap(
            db,
            business,
            appointment.client_id,
            start_at,
            end_at,
            exclude_appointment_id=appointment.id,
        )

    appointment.service_id = service.id
    appointment.staff_id = member.id
    appointment.start_at = start_at
    appointment.end_at = end_at
    appointment.price_cents = service.price_cents
    appointment.deposit_cents = service.deposit_cents
    if payload.notes is not None:
        appointment.notes = payload.notes
    appointment.updated_at = utcnow_naive()
    record_audit(
        db,
        business_id=business.id,
        user_id=user.id,
        action="cita.reagendada" if changed_slot else "cita.actualizada",
        entity_type="appointment",
        entity_id=appointment.id,
        detail=f"{appointment.client.name} · {format_datetime_es(start_at, business.timezone)}",
    )
    db.commit()
    db.refresh(appointment)
    return appointment


@router.post("/appointments/{appointment_id}/status", response_model=AppointmentOut)
def change_status(
    appointment_id: int,
    payload: AppointmentStatusIn,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Appointment:
    appointment = get_appointment(db, business, appointment_id)
    if payload.status == appointment.status:
        return appointment
    if payload.status not in TRANSITIONS.get(appointment.status, set()):
        raise HTTPException(
            status_code=409,
            detail=f"No puedes pasar de {appointment.status.value} a {payload.status.value}.",
        )
    appointment.status = payload.status
    if payload.status == AppointmentStatus.completed:
        client = db.get(Client, appointment.client_id)
        if client is not None:
            if client.last_visit_at is None or client.last_visit_at < appointment.end_at:
                client.last_visit_at = appointment.end_at
    if payload.reason:
        note = f"Motivo: {payload.reason}"
        appointment.notes = f"{appointment.notes}\n{note}" if appointment.notes else note
    appointment.updated_at = utcnow_naive()
    record_audit(
        db,
        business_id=business.id,
        user_id=user.id,
        action="cita.estado_cambiado",
        entity_type="appointment",
        entity_id=appointment.id,
        detail=f"{appointment.client.name}: {payload.status.value}"
        + (f" · {payload.reason}" if payload.reason else ""),
    )
    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("/appointments/{appointment_id}/whatsapp", response_model=WhatsAppOut)
def appointment_whatsapp(
    appointment_id: int,
    template: str = Query(default="recordatorio", pattern="^(recordatorio|confirmacion|gracias)$"),
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WhatsAppOut:
    appointment = get_appointment(db, business, appointment_id)
    client = appointment.client
    first_name = client.name.split()[0]
    when = format_datetime_es(appointment.start_at, business.timezone)
    address = ", ".join(
        part for part in [business.address, business.neighborhood, business.city] if part
    )
    public_link = f"{settings.public_base_url.rstrip('/')}/reservar/{business.slug}"

    if template == "confirmacion":
        text = (
            f"¡Hola {first_name}! Tu cita de {appointment.service.name} con "
            f"{appointment.staff.name} quedó confirmada para {when}. "
            f"Te esperamos en {address}. Código: {appointment.confirmation_code}. — {business.name}"
        )
    elif template == "gracias":
        text = (
            f"¡Gracias por tu visita, {first_name}! Esperamos que ames tu "
            f"{appointment.service.name}. Cuéntanos cómo te fue y agenda tu próxima cita aquí: "
            f"{public_link} — {business.name}"
        )
    else:
        cancellation = business.cancellation_hours
        text = (
            f"Hola {first_name}, te recordamos tu cita de {appointment.service.name} con "
            f"{appointment.staff.name} el {when} en {address}. "
            f"Si necesitas cambiarla, avísanos con {cancellation} h de anticipación. "
            f"Responde CONFIRMO para apartar tu lugar. — {business.name}"
        )
    return WhatsAppOut(url=whatsapp_link(client.phone, text), text=text, phone=client.phone)
