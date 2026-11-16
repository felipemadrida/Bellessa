from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from math import ceil

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Appointment, AppointmentStatus, Business, Client, Payment
from ..utils import utcnow_naive

POINTS_PER_10_PESOS = 1
REWARD_EVERY_VISITS = 5


@dataclass
class LoyaltySummary:
    points: int
    level: str
    visits: int
    spent_cents: int
    spent_12m_cents: int
    next_reward_in: int
    reward_available: bool


def vip_client_ids(db: Session, business: Business, months: int = 12) -> set[int]:
    """El 20% de clientas con mayor gasto en los últimos 12 meses."""
    since = utcnow_naive() - timedelta(days=365)
    rows = db.execute(
        select(Payment.client_id, func.sum(Payment.amount_cents))
        .where(
            Payment.business_id == business.id,
            Payment.client_id.is_not(None),
            Payment.created_at >= since,
        )
        .group_by(Payment.client_id)
    ).all()
    spends = sorted(
        ((client_id, int(total or 0)) for client_id, total in rows if client_id is not None),
        key=lambda item: item[1],
        reverse=True,
    )
    if not spends:
        return set()
    cutoff = max(1, ceil(len(spends) * 0.2))
    threshold = spends[cutoff - 1][1]
    return {client_id for client_id, total in spends if total >= threshold and total > 0}


def loyalty_summary(db: Session, business: Business, client: Client) -> LoyaltySummary:
    visits = int(
        db.scalar(
            select(func.count(Appointment.id)).where(
                Appointment.business_id == business.id,
                Appointment.client_id == client.id,
                Appointment.status == AppointmentStatus.completed,
            )
        )
        or 0
    )
    spent = int(
        db.scalar(
            select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
                Payment.business_id == business.id,
                Payment.client_id == client.id,
            )
        )
        or 0
    )
    since = utcnow_naive() - timedelta(days=365)
    spent_12m = int(
        db.scalar(
            select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
                Payment.business_id == business.id,
                Payment.client_id == client.id,
                Payment.created_at >= since,
            )
        )
        or 0
    )
    points = spent // 1000 * POINTS_PER_10_PESOS
    tags = (client.tags or "").lower()
    vip = client.id in vip_client_ids(db, business) or "vip" in tags
    level = "vip" if vip else "frecuente" if visits >= 3 else "nueva"
    remainder = visits % REWARD_EVERY_VISITS
    reward_available = visits >= REWARD_EVERY_VISITS and remainder == 0
    next_reward_in = 0 if reward_available else REWARD_EVERY_VISITS - remainder
    return LoyaltySummary(
        points=points,
        level=level,
        visits=visits,
        spent_cents=spent,
        spent_12m_cents=spent_12m,
        next_reward_in=next_reward_in,
        reward_available=reward_available,
    )


def loyalty_for_client(db: Session, business: Business, client_id: int) -> LoyaltySummary | None:
    client = db.get(Client, client_id)
    if client is None or client.business_id != business.id:
        return None
    return loyalty_summary(db, business, client)
