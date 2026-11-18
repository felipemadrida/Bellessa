from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Appointment, AppointmentStatus, Business, User


def lock_staff_row(db: Session, staff_id: int) -> User | None:
    """Bloquea la fila del profesional para serializar reservas concurrentes.

    En PostgreSQL ejecuta ``SELECT ... FOR UPDATE`` sobre ``users``: dos
    reservas para el mismo profesional se serializan, de modo que la segunda
    re-verifica la disponibilidad *después* de que la primera hizo commit y
    recibe 409 en lugar de duplicar el horario. En SQLite es un no-op (no hay
    bloqueo real), por lo que la suite de tests sigue en verde.
    """
    return db.execute(
        select(User).where(User.id == staff_id).with_for_update()
    ).scalar_one_or_none()


def ensure_client_has_no_overlap(
    db: Session,
    business: Business,
    client_id: int,
    start_at: datetime,
    end_at: datetime,
    exclude_appointment_id: int | None = None,
) -> None:
    """Regla de negocio: una clienta no puede estar en dos citas a la vez."""
    query = select(Appointment.id).where(
        Appointment.business_id == business.id,
        Appointment.client_id == client_id,
        Appointment.status.in_(
            (AppointmentStatus.pending, AppointmentStatus.confirmed, AppointmentStatus.completed)
        ),
        Appointment.start_at < end_at,
        Appointment.end_at > start_at,
    )
    if exclude_appointment_id is not None:
        query = query.where(Appointment.id != exclude_appointment_id)
    if db.scalar(query.limit(1)):
        raise HTTPException(
            status_code=409,
            detail="Esta clienta ya tiene otra cita que se cruza con ese horario.",
        )
