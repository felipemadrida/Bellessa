from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..database import get_db
from ..deps import get_current_business, get_current_user
from ..models import Appointment, AppointmentStatus, Business, Client, Payment, User
from ..schemas import (
    ClientBrief,
    ClientCreate,
    ClientDetail,
    ClientOut,
    ClientStats,
    ClientUpdate,
    WhatsAppOut,
)
from ..services.loyalty import loyalty_summary
from ..utils import ensure_utc, format_date_es, normalize_phone_mx, utcnow_naive, whatsapp_link

router = APIRouter(prefix="/clients", tags=["clientas"])


def _get_client(db: Session, business: Business, client_id: int) -> Client:
    client = db.get(Client, client_id)
    if client is None or client.business_id != business.id:
        raise HTTPException(status_code=404, detail="Clienta no encontrada.")
    return client


@router.get("", response_model=list[ClientOut])
def list_clients(
    q: str | None = Query(default=None, max_length=80),
    tag: str | None = None,
    limit: int = Query(default=100, ge=1, le=300),
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Client]:
    query = select(Client).where(Client.business_id == business.id)
    if q:
        term = f"%{q.strip()}%"
        digits = normalize_phone_mx(q)
        conditions = [Client.name.ilike(term), Client.email.ilike(term)]
        if digits:
            conditions.append(Client.phone.like(f"%{digits}%"))
        query = query.where(or_(*conditions))
    if tag:
        query = query.where(Client.tags.ilike(f"%{tag}%"))
    query = query.order_by(Client.name).limit(limit)
    return list(db.scalars(query).all())


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Client:
    phone = normalize_phone_mx(payload.phone)
    if len(phone) != 10:
        raise HTTPException(status_code=422, detail="Escribe un teléfono mexicano a 10 dígitos.")
    existing = db.scalar(
        select(Client).where(Client.business_id == business.id, Client.phone == phone)
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe una clienta con ese teléfono: {existing.name}.",
        )
    data = payload.model_dump()
    data["phone"] = phone
    client = Client(business_id=business.id, **data)
    db.add(client)
    db.flush()
    record_audit(
        db,
        business_id=business.id,
        action="clienta.creada",
        entity_type="client",
        entity_id=client.id,
        detail=client.name,
        user_id=user.id,
    )
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientDetail)
def get_client(
    client_id: int,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClientDetail:
    client = _get_client(db, business, client_id)
    appointments = list(
        db.scalars(
            select(Appointment)
            .where(Appointment.business_id == business.id, Appointment.client_id == client.id)
            .order_by(Appointment.start_at.desc())
            .limit(60)
        )
        .unique()
        .all()
    )
    payments = list(
        db.scalars(
            select(Payment).where(
                Payment.business_id == business.id, Payment.client_id == client.id
            )
        ).all()
    )
    completed = [a for a in appointments if a.status == AppointmentStatus.completed]
    spent = sum(p.amount_cents + p.tip_cents for p in payments)
    favorite = Counter(a.service.name for a in completed).most_common(1)
    now = utcnow_naive()
    next_appointment = next(
        (
            a
            for a in reversed(appointments)
            if a.status in (AppointmentStatus.pending, AppointmentStatus.confirmed)
            and a.start_at >= now
        ),
        None,
    )
    base = ClientOut.model_validate(client).model_dump()
    loyalty = loyalty_summary(db, business, client)
    return ClientDetail(
        **base,
        stats=ClientStats(
            visits=len(completed),
            spent_cents=spent,
            avg_ticket_cents=round(spent / len(payments)) if payments else 0,
            favorite_service=favorite[0][0] if favorite else None,
            next_appointment_at=ensure_utc(next_appointment.start_at) if next_appointment else None,
            loyalty_points=loyalty.points,
            loyalty_level=loyalty.level,
            loyalty_next_reward_in=loyalty.next_reward_in,
            loyalty_reward_available=loyalty.reward_available,
            loyalty_spent_12m_cents=loyalty.spent_12m_cents,
        ),
        appointments=appointments,
    )


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Client:
    client = _get_client(db, business, client_id)
    data = payload.model_dump(exclude_unset=True)
    if "phone" in data and data["phone"]:
        phone = normalize_phone_mx(data["phone"])
        if len(phone) != 10:
            raise HTTPException(status_code=422, detail="Escribe un teléfono mexicano a 10 dígitos.")
        duplicate = db.scalar(
            select(Client).where(
                Client.business_id == business.id,
                Client.phone == phone,
                Client.id != client.id,
            )
        )
        if duplicate:
            raise HTTPException(status_code=409, detail=f"Ese teléfono ya lo usa {duplicate.name}.")
        data["phone"] = phone
    for key, value in data.items():
        setattr(client, key, value)
    record_audit(
        db,
        business_id=business.id,
        user_id=_.id,
        action="clienta.actualizada",
        entity_type="client",
        entity_id=client.id,
        detail=client.name,
    )
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}/whatsapp", response_model=WhatsAppOut)
def client_whatsapp(
    client_id: int,
    template: str = Query(default="reactivacion", pattern="^(cumpleanos|reactivacion|gracias)$"),
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WhatsAppOut:
    client = _get_client(db, business, client_id)
    first_name = client.name.split()[0]
    if template == "cumpleanos":
        text = (
            f"¡Hola {first_name}! 🎉 En {business.name} te deseamos un feliz cumpleaños. "
            f"Te regalamos 15% en tu próximo servicio de cabello este mes. "
            f"Responde este mensaje para agendar. — {business.name}"
        )
    elif template == "gracias":
        text = (
            f"¡Gracias por tu visita, {first_name}! 💫 En {business.name} amamos verte. "
            f"Cuéntanos cómo te quedó tu servicio y recuerda que tu próxima cita la puedes "
            f"agendar en un mensaje. — {business.name}"
        )
    else:
        days = 30
        if client.last_visit_at:
            days = max(1, (utcnow_naive() - client.last_visit_at).days)
        text = (
            f"Hola {first_name}, hace {days} días que no te vemos por {business.name}. "
            f"Tenemos horarios nuevos esta semana y nos encantaría consentirte. "
            f"¿Te apartamos un lugar? — {business.name}"
        )
    return WhatsAppOut(
        url=whatsapp_link(client.phone, text),
        text=text,
        phone=client.phone,
    )
