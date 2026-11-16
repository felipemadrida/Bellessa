from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..models import Appointment, AppointmentStatus, Business, Service, TimeOff, User
from ..utils import ensure_utc, local_day_bounds, tz_for

ACTIVE_STATUSES = (
    AppointmentStatus.pending,
    AppointmentStatus.confirmed,
    AppointmentStatus.completed,
)
BLOCKING_STATUSES = ACTIVE_STATUSES


@dataclass
class Slot:
    start_at: datetime  # local, con tz
    end_at: datetime
    staff: User


def _intervals_for_staff(
    appointments: list[Appointment], time_off: list[TimeOff]
) -> list[tuple[datetime, datetime]]:
    intervals: list[tuple[datetime, datetime]] = []
    for appointment in appointments:
        buffer_min = appointment.service.buffer_min if appointment.service else 0
        intervals.append(
            (
                ensure_utc(appointment.start_at) - timedelta(minutes=buffer_min),
                ensure_utc(appointment.end_at) + timedelta(minutes=buffer_min),
            )
        )
    for block in time_off:
        intervals.append((ensure_utc(block.start_at), ensure_utc(block.end_at)))
    return intervals


def compute_slots(
    db: Session,
    business: Business,
    day: date,
    service: Service,
    staff_id: int | None = None,
    exclude_appointment_id: int | None = None,
    enforce_notice: bool = True,
) -> list[Slot]:
    """Calcula horarios libres reales (horario del salón ∩ horario de la persona)."""
    tz = tz_for(business.timezone)
    weekday = day.weekday()
    business_hour = next((h for h in business.hours if h.weekday == weekday), None)
    if business_hour is None or business_hour.closed:
        return []

    staff_query = select(User).where(
        User.business_id == business.id, User.active.is_(True)
    ).options(joinedload(User.working_hours))
    if staff_id is not None:
        staff_query = staff_query.where(User.id == staff_id)
    staff_members = db.scalars(staff_query).unique().all()
    if not staff_members:
        return []

    range_start, range_end = local_day_bounds(day, business.timezone)
    staff_ids = [member.id for member in staff_members]
    appointments = db.scalars(
        select(Appointment)
        .where(
            Appointment.business_id == business.id,
            Appointment.staff_id.in_(staff_ids),
            Appointment.start_at < range_end,
            Appointment.end_at > range_start,
            Appointment.status.in_(BLOCKING_STATUSES),
        )
        .options(joinedload(Appointment.service))
    ).unique().all()
    if exclude_appointment_id is not None:
        appointments = [a for a in appointments if a.id != exclude_appointment_id]

    time_offs = db.scalars(
        select(TimeOff).where(
            TimeOff.staff_id.in_(staff_ids),
            TimeOff.start_at < range_end,
            TimeOff.end_at > range_start,
        )
    ).all()

    now = datetime.now(tz)
    earliest = now + timedelta(minutes=business.min_notice_minutes) if enforce_notice else now
    step = max(5, business.slot_step_minutes)
    duration = timedelta(minutes=service.duration_min)
    buffer = timedelta(minutes=service.buffer_min)

    slots: list[Slot] = []
    for member in staff_members:
        working = next((h for h in member.working_hours if h.weekday == weekday), None)
        if working is None or working.closed:
            continue
        open_minute = max(business_hour.open_minute, working.start_minute)
        close_minute = min(business_hour.close_minute, working.end_minute)
        if close_minute - open_minute < service.duration_min:
            continue

        member_appointments = [a for a in appointments if a.staff_id == member.id]
        member_blocks = [b for b in time_offs if b.staff_id == member.id]
        busy = _intervals_for_staff(member_appointments, member_blocks)

        minute = open_minute
        while minute + service.duration_min <= close_minute:
            start_local = datetime.combine(day, time(0, 0), tzinfo=tz) + timedelta(minutes=minute)
            end_local = start_local + duration
            if start_local >= earliest:
                candidate_start = start_local - buffer
                candidate_end = end_local + buffer
                overlaps = any(
                    candidate_start < block_end and candidate_end > block_start
                    for block_start, block_end in busy
                )
                if not overlaps:
                    slots.append(Slot(start_at=start_local, end_at=end_local, staff=member))
            minute += step

    slots.sort(key=lambda slot: (slot.start_at, slot.staff.name))
    return slots


def slot_payload(slot: Slot) -> dict:
    return {
        "start_at": slot.start_at.isoformat(),
        "end_at": slot.end_at.isoformat(),
        "start_utc": slot.start_at.astimezone(tz_for("UTC")).isoformat().replace("+00:00", "Z"),
        "staff_id": slot.staff.id,
        "staff_name": slot.staff.name,
        "staff_color": slot.staff.color,
    }


def is_slot_available(
    db: Session,
    business: Business,
    day: date,
    service: Service,
    staff_id: int,
    start_at_utc: datetime,
    exclude_appointment_id: int | None = None,
    enforce_notice: bool = False,
) -> bool:
    target = ensure_utc(start_at_utc)
    slots = compute_slots(
        db,
        business,
        day,
        service,
        staff_id=staff_id,
        exclude_appointment_id=exclude_appointment_id,
        enforce_notice=enforce_notice,
    )
    return any(ensure_utc(slot.start_at) == target for slot in slots)
