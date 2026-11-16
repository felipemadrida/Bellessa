from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Appointment, AppointmentStatus, Business


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
