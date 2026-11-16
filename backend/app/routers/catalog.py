from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..database import get_db
from ..deps import get_current_business, get_current_user, require_owner
from ..models import (
    Appointment,
    AppointmentStatus,
    Business,
    BusinessHour,
    Service,
    TimeOff,
    User,
    WorkingHour,
)
from ..schemas import (
    BusinessHourIn,
    BusinessHourOut,
    BusinessOut,
    BusinessUpdate,
    ServiceCreate,
    ServiceOut,
    ServiceUpdate,
    StaffCreate,
    StaffOut,
    StaffUpdate,
    TimeOffCreate,
    TimeOffOut,
    WorkingHourIn,
    WorkingHourOut,
)
from ..security import hash_password
from ..services.plans import ensure_tenant_account, plan_limits
from ..utils import local_day_bounds, normalize_phone_mx, to_local, utcnow_naive

router = APIRouter(tags=["catálogo"])


# ---------------------------------------------------------------------------
# Negocio
# ---------------------------------------------------------------------------
@router.get("/business", response_model=BusinessOut)
def get_business(business: Business = Depends(get_current_business)) -> Business:
    return business


@router.patch("/business", response_model=BusinessOut)
def update_business(
    payload: BusinessUpdate,
    business: Business = Depends(get_current_business),
    _: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> Business:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(business, key, value)
    record_audit(
        db,
        business_id=business.id,
        user_id=_.id,
        action="negocio.actualizado",
        entity_type="business",
        entity_id=business.id,
        detail="Perfil y reglas del salón",
    )
    db.commit()
    db.refresh(business)
    return business


@router.put("/business/hours", response_model=list[BusinessHourOut])
def update_business_hours(
    payload: list[BusinessHourIn],
    business: Business = Depends(get_current_business),
    _: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> list[BusinessHour]:
    rows = {row.weekday: row for row in business.hours}
    for item in payload:
        if item.close_minute <= item.open_minute and not item.closed:
            raise HTTPException(status_code=422, detail="La hora de cierre debe ser después de la apertura.")
        row = rows.get(item.weekday)
        if row is None:
            row = BusinessHour(business_id=business.id, weekday=item.weekday)
            db.add(row)
            rows[item.weekday] = row
        row.closed = item.closed
        row.open_minute = item.open_minute
        row.close_minute = item.close_minute
    record_audit(
        db,
        business_id=business.id,
        user_id=_.id,
        action="horario.actualizado",
        entity_type="business",
        entity_id=business.id,
        detail="Horario de atención del salón",
    )
    db.commit()
    return sorted(rows.values(), key=lambda row: row.weekday)


# ---------------------------------------------------------------------------
# Equipo
# ---------------------------------------------------------------------------
@router.get("/staff", response_model=list[StaffOut])
def list_staff(
    include_inactive: bool = False,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    query = select(User).where(User.business_id == business.id).order_by(User.id)
    if not include_inactive:
        query = query.where(User.active.is_(True))
    return list(db.scalars(query).all())


@router.post("/staff", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreate,
    business: Business = Depends(get_current_business),
    _: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> User:
    email = payload.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Ese correo ya está registrado.")
    account = ensure_tenant_account(db, business)
    max_staff = plan_limits(account.plan)["max_staff"]
    current_staff = int(
        db.scalar(
            select(func.count(User.id)).where(
                User.business_id == business.id, User.active.is_(True)
            )
        )
        or 0
    )
    if current_staff >= max_staff:
        raise HTTPException(
            status_code=409,
            detail=f"Tu plan {account.plan.title()} permite {max_staff} personas activas. Mejora el plan para agregar más.",
        )
    member = User(
        business_id=business.id,
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        phone=normalize_phone_mx(payload.phone) if payload.phone else None,
        role=payload.role,
        color=payload.color,
        commission_bps=payload.commission_bps,
        bio=payload.bio,
    )
    db.add(member)
    db.flush()
    for weekday in range(7):
        db.add(
            WorkingHour(
                staff_id=member.id,
                weekday=weekday,
                closed=weekday == 6,
                start_minute=540,
                end_minute=1140 if weekday < 5 else 1080,
            )
        )
    record_audit(
        db,
        business_id=business.id,
        user_id=_.id,
        action="equipo.agregado",
        entity_type="user",
        entity_id=member.id,
        detail=member.name,
    )
    db.commit()
    db.refresh(member)
    return member


@router.patch("/staff/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: int,
    payload: StaffUpdate,
    business: Business = Depends(get_current_business),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    member = db.get(User, staff_id)
    if member is None or member.business_id != business.id:
        raise HTTPException(status_code=404, detail="Profesional no encontrada.")
    if current.role.value != "owner" and current.id != member.id:
        raise HTTPException(status_code=403, detail="No puedes editar a otra persona.")
    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    if password:
        member.password_hash = hash_password(password)
    if "phone" in data and data["phone"]:
        data["phone"] = normalize_phone_mx(data["phone"])
    for key, value in data.items():
        setattr(member, key, value)
    record_audit(
        db,
        business_id=business.id,
        user_id=current.id,
        action="equipo.actualizado",
        entity_type="user",
        entity_id=member.id,
        detail=member.name,
    )
    db.commit()
    db.refresh(member)
    return member


@router.get("/staff/{staff_id}/hours", response_model=list[WorkingHourOut])
def get_staff_hours(
    staff_id: int,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkingHour]:
    member = db.get(User, staff_id)
    if member is None or member.business_id != business.id:
        raise HTTPException(status_code=404, detail="Profesional no encontrada.")
    return sorted(member.working_hours, key=lambda row: row.weekday)


@router.put("/staff/{staff_id}/hours", response_model=list[WorkingHourOut])
def update_staff_hours(
    staff_id: int,
    payload: list[WorkingHourIn],
    business: Business = Depends(get_current_business),
    _: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> list[WorkingHour]:
    member = db.get(User, staff_id)
    if member is None or member.business_id != business.id:
        raise HTTPException(status_code=404, detail="Profesional no encontrada.")
    db.execute(delete(WorkingHour).where(WorkingHour.staff_id == member.id))
    for item in payload:
        if item.end_minute <= item.start_minute and not item.closed:
            raise HTTPException(status_code=422, detail="La hora de salida debe ser después de la entrada.")
        db.add(
            WorkingHour(
                staff_id=member.id,
                weekday=item.weekday,
                closed=item.closed,
                start_minute=item.start_minute,
                end_minute=item.end_minute,
            )
        )
    record_audit(
        db,
        business_id=business.id,
        user_id=_.id,
        action="horario.equipo_actualizado",
        entity_type="user",
        entity_id=member.id,
        detail=f"Horario de {member.name}",
    )
    db.commit()
    db.refresh(member)
    return sorted(member.working_hours, key=lambda row: row.weekday)


@router.get("/staff/{staff_id}/time-off", response_model=list[TimeOffOut])
def list_time_off(
    staff_id: int,
    include_past: bool = False,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TimeOff]:
    member = db.get(User, staff_id)
    if member is None or member.business_id != business.id:
        raise HTTPException(status_code=404, detail="Profesional no encontrada.")
    query = select(TimeOff).where(TimeOff.staff_id == member.id)
    if not include_past:
        query = query.where(TimeOff.end_at > utcnow_naive())
    return list(db.scalars(query.order_by(TimeOff.start_at)).all())


@router.post("/staff/{staff_id}/time-off", response_model=TimeOffOut, status_code=status.HTTP_201_CREATED)
def create_time_off(
    staff_id: int,
    payload: TimeOffCreate,
    business: Business = Depends(get_current_business),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimeOff:
    member = db.get(User, staff_id)
    if member is None or member.business_id != business.id:
        raise HTTPException(status_code=404, detail="Profesional no encontrada.")
    if current.role.value != "owner" and current.id != member.id:
        raise HTTPException(status_code=403, detail="No puedes bloquear la agenda de otra persona.")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="La fecha final no puede ser anterior a la inicial.")
    if (payload.end_date - payload.start_date).days > 60:
        raise HTTPException(status_code=422, detail="Un bloqueo no puede durar más de 60 días.")
    today = to_local(utcnow_naive(), business.timezone).date()
    if payload.start_date < today or payload.end_date < today:
        raise HTTPException(status_code=422, detail="No puedes bloquear fechas pasadas.")

    start_at, _ = local_day_bounds(payload.start_date, business.timezone)
    # El fin es exclusivo: medianoche del día siguiente al último día bloqueado.
    end_at, _ = local_day_bounds(payload.end_date + timedelta(days=1), business.timezone)

    overlapping_appointments = list(
        db.scalars(
            select(Appointment).where(
                Appointment.business_id == business.id,
                Appointment.staff_id == member.id,
                Appointment.status.in_(
                    (AppointmentStatus.pending, AppointmentStatus.confirmed)
                ),
                Appointment.start_at < end_at,
                Appointment.end_at > start_at,
            )
        ).all()
    )
    if overlapping_appointments:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Hay {len(overlapping_appointments)} cita(s) en ese rango. "
                "Muévelas o cancélalas antes de bloquear la agenda."
            ),
        )
    existing = db.scalar(
        select(TimeOff.id).where(
            TimeOff.staff_id == member.id,
            TimeOff.start_at < end_at,
            TimeOff.end_at > start_at,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ese rango ya está bloqueado.")

    block = TimeOff(
        staff_id=member.id,
        start_at=start_at,
        end_at=end_at,
        reason=payload.reason.strip() if payload.reason else None,
    )
    db.add(block)
    db.flush()
    record_audit(
        db,
        business_id=business.id,
        user_id=current.id,
        action="agenda.bloqueada",
        entity_type="time_off",
        entity_id=block.id,
        detail=f"{member.name}: {payload.start_date} a {payload.end_date}",
    )
    db.commit()
    db.refresh(block)
    return block


@router.delete("/staff/{staff_id}/time-off/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_off(
    staff_id: int,
    block_id: int,
    business: Business = Depends(get_current_business),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    member = db.get(User, staff_id)
    if member is None or member.business_id != business.id:
        raise HTTPException(status_code=404, detail="Profesional no encontrada.")
    if current.role.value != "owner" and current.id != member.id:
        raise HTTPException(status_code=403, detail="No puedes editar la agenda de otra persona.")
    block = db.get(TimeOff, block_id)
    if block is None or block.staff_id != member.id:
        raise HTTPException(status_code=404, detail="Bloqueo no encontrado.")
    record_audit(
        db,
        business_id=business.id,
        user_id=current.id,
        action="agenda.desbloqueada",
        entity_type="time_off",
        entity_id=block.id,
        detail=member.name,
    )
    db.delete(block)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Servicios
# ---------------------------------------------------------------------------
@router.get("/services", response_model=list[ServiceOut])
def list_services(
    include_inactive: bool = False,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Service]:
    query = (
        select(Service)
        .where(Service.business_id == business.id)
        .order_by(Service.sort_order, Service.id)
    )
    if not include_inactive:
        query = query.where(Service.active.is_(True))
    return list(db.scalars(query).all())


@router.post("/services", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreate,
    business: Business = Depends(get_current_business),
    _: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> Service:
    service = Service(business_id=business.id, **payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.patch("/services/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: int,
    payload: ServiceUpdate,
    business: Business = Depends(get_current_business),
    _: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> Service:
    service = db.get(Service, service_id)
    if service is None or service.business_id != business.id:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, key, value)
    db.commit()
    db.refresh(service)
    return service
