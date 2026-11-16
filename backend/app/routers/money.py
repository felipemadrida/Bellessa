from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..audit import record_audit
from ..database import get_db
from ..deps import get_current_business, get_current_user
from ..models import (
    Appointment,
    AppointmentStatus,
    Business,
    Client,
    Expense,
    Payment,
    PaymentMethod,
    Service,
    User,
)
from ..schemas import (
    CashSummaryOut,
    DashboardOut,
    ExpenseCreate,
    ExpenseOut,
    PaymentCreate,
    PaymentOut,
    ReportOut,
)
from ..utils import (
    WEEKDAYS_ES,
    commission_cents,
    format_date_es,
    format_datetime_es,
    iva_breakdown,
    local_day_bounds,
    money_mx,
    to_local,
    utcnow_naive,
)

router = APIRouter(tags=["caja y reportes"])

METHOD_LABELS = {
    "cash": "Efectivo",
    "card": "Tarjeta",
    "transfer": "Transferencia",
    "other": "Otro",
}


def _payments_range(
    db: Session, business: Business, start: datetime, end: datetime
) -> list[Payment]:
    return list(
        db.scalars(
            select(Payment)
            .where(
                Payment.business_id == business.id,
                Payment.created_at >= start,
                Payment.created_at < end,
            )
            .options(joinedload(Payment.appointment))
            .order_by(Payment.created_at.desc())
        )
        .unique()
        .all()
    )


def _appointments_range(
    db: Session, business: Business, start: datetime, end: datetime
) -> list[Appointment]:
    return list(
        db.scalars(
            select(Appointment)
            .where(
                Appointment.business_id == business.id,
                Appointment.start_at >= start,
                Appointment.start_at < end,
            )
            .order_by(Appointment.start_at)
        )
        .unique()
        .all()
    )


def _sum_amount(payments: list[Payment]) -> int:
    return sum(payment.amount_cents for payment in payments)


def _sum_tips(payments: list[Payment]) -> int:
    return sum(payment.tip_cents for payment in payments)


def _occupancy_pct(
    business: Business,
    staff: list[User],
    appointments: list[Appointment],
    start_day: date,
    end_day: date,
) -> int:
    total_minutes = 0
    current = start_day
    while current <= end_day:
        business_hour = next((h for h in business.hours if h.weekday == current.weekday()), None)
        if business_hour and not business_hour.closed:
            for member in staff:
                working = next(
                    (h for h in member.working_hours if h.weekday == current.weekday()), None
                )
                if working and not working.closed:
                    open_minute = max(business_hour.open_minute, working.start_minute)
                    close_minute = min(business_hour.close_minute, working.end_minute)
                    total_minutes += max(0, close_minute - open_minute)
        current += timedelta(days=1)
    if total_minutes == 0:
        return 0
    booked = sum(
        (appointment.end_at - appointment.start_at).total_seconds() / 60
        for appointment in appointments
        if appointment.status not in (AppointmentStatus.canceled, AppointmentStatus.no_show)
    )
    return min(100, round(booked / total_minutes * 100))


def _day_revenue(
    db: Session, business: Business, days: list[date], payments: list[Payment], appointments: list[Appointment]
) -> list[dict]:
    result = []
    for day in days:
        result.append(
            {
                "date": day,
                "label": f"{WEEKDAYS_ES[day.weekday()][:3].capitalize()} {day.day}",
                "revenue_cents": sum(
                    payment.amount_cents
                    for payment in payments
                    if to_local(payment.created_at, business.timezone).date() == day
                ),
                "appointments": sum(
                    1
                    for appointment in appointments
                    if to_local(appointment.start_at, business.timezone).date() == day
                    and appointment.status != AppointmentStatus.canceled
                ),
            }
        )
    return result


def _top_services(payments: list[Payment], limit: int = 5) -> list[dict]:
    bucket: dict[int, dict] = {}
    for payment in payments:
        service = payment.appointment.service if payment.appointment else None
        if service is None:
            continue
        item = bucket.setdefault(
            service.id,
            {
                "service_id": service.id,
                "name": service.name,
                "color": service.color,
                "count": 0,
                "revenue_cents": 0,
            },
        )
        item["count"] += 1
        item["revenue_cents"] += payment.amount_cents
    return sorted(bucket.values(), key=lambda item: item["revenue_cents"], reverse=True)[:limit]


@router.post("/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: PaymentCreate,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Payment:
    appointment = db.get(Appointment, payload.appointment_id)
    if appointment is None or appointment.business_id != business.id:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")
    if appointment.status in (AppointmentStatus.canceled, AppointmentStatus.no_show):
        raise HTTPException(status_code=409, detail="No puedes cobrar una cita cancelada o no asistida.")
    if db.scalar(select(Payment.id).where(Payment.appointment_id == appointment.id)):
        raise HTTPException(status_code=409, detail="Esta cita ya tiene un cobro registrado.")

    amount = payload.amount_cents if payload.amount_cents is not None else appointment.price_cents
    payment = Payment(
        business_id=business.id,
        appointment_id=appointment.id,
        client_id=appointment.client_id,
        staff_id=appointment.staff_id,
        service_id=appointment.service_id,
        amount_cents=amount,
        tip_cents=payload.tip_cents,
        method=payload.method,
        reference=payload.reference,
        created_by=user.id,
    )
    db.add(payment)
    appointment.status = AppointmentStatus.completed
    appointment.updated_at = utcnow_naive()
    client = db.get(Client, appointment.client_id)
    if client and (client.last_visit_at is None or client.last_visit_at < appointment.end_at):
        client.last_visit_at = appointment.end_at
    try:
        db.flush()
        record_audit(
            db,
            business_id=business.id,
            user_id=user.id,
            action="cobro.registrado",
            entity_type="payment",
            entity_id=payment.id,
            detail=(
                f"{appointment.client.name} · {money_mx(payment.amount_cents)}"
                f" + propina {money_mx(payment.tip_cents)} · {payment.method.value}"
            ),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Esta cita ya tiene un cobro registrado.") from exc
    db.refresh(payment)
    return payment


@router.get("/payments", response_model=list[PaymentOut])
def list_payments(
    day: date | None = Query(default=None, alias="date"),
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Payment]:
    target = day or to_local(utcnow_naive(), business.timezone).date()
    start, end = local_day_bounds(target, business.timezone)
    return _payments_range(db, business, start, end)


@router.get("/payments/{payment_id}/receipt")
def payment_receipt(
    payment_id: int,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payment = db.get(Payment, payment_id)
    if payment is None or payment.business_id != business.id:
        raise HTTPException(status_code=404, detail="Cobro no encontrado.")
    appointment = payment.appointment
    client = appointment.client if appointment else None
    service = appointment.service if appointment else None
    subtotal, iva = iva_breakdown(payment.amount_cents, business.tax_rate_bps)
    local_date = to_local(payment.created_at, business.timezone)
    lines = [
        "=" * 44,
        business.name.upper(),
        business.legal_name or "",
        f"RFC: {business.rfc or 'XAXX010101000'}",
        f"{business.address or ''} {business.neighborhood or ''}".strip(),
        f"{business.city or ''}, {business.state or ''}".strip(", "),
        f"Tel / WhatsApp: {business.phone or business.whatsapp or ''}",
        "=" * 44,
        f"Recibo: P-{payment.id:06d}",
        f"Fecha: {format_datetime_es(payment.created_at, business.timezone)}",
        f"Clienta: {client.name if client else 'Público general'}",
        f"RFC clienta: {client.rfc if client and client.rfc else 'XAXX010101000'}",
        "-" * 44,
        f"Servicio: {service.name if service else 'Servicio'}"
        f"  {format_datetime_es(appointment.start_at, business.timezone) if appointment else ''}",
        f"Atendió: {appointment.staff.name if appointment else ''}",
        "-" * 44,
        f"Subtotal:            {money_mx(subtotal)}",
        f"IVA ({business.tax_rate_bps / 100:.0f}%):          {money_mx(iva)}",
        f"Servicio (IVA incl.): {money_mx(payment.amount_cents)}",
        f"Propina:             {money_mx(payment.tip_cents)}",
        f"TOTAL:               {money_mx(payment.amount_cents + payment.tip_cents)}",
        f"Forma de pago:       {METHOD_LABELS.get(payment.method.value, payment.method.value)}",
    ]
    if payment.reference:
        lines.append(f"Referencia:          {payment.reference}")
    lines += [
        "=" * 44,
        "Gracias por tu visita. 💫",
        "Este recibo es un comprobante interno, no un CFDI.",
        "Solicita tu factura con tu RFC antes de 30 días.",
        "=" * 44,
    ]
    filename = f"recibo-{local_date:%Y%m%d}-{payment.id}.txt"
    return Response(
        content="\n".join(lines),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Expense:
    expense = Expense(business_id=business.id, created_by=user.id, **payload.model_dump())
    db.add(expense)
    db.flush()
    record_audit(
        db,
        business_id=business.id,
        user_id=user.id,
        action="gasto.registrado",
        entity_type="expense",
        entity_id=expense.id,
        detail=f"{expense.concept} · {money_mx(expense.amount_cents)}",
    )
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/expenses", response_model=list[ExpenseOut])
def list_expenses(
    day: date | None = Query(default=None, alias="date"),
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Expense]:
    target = day or to_local(utcnow_naive(), business.timezone).date()
    start, end = local_day_bounds(target, business.timezone)
    return list(
        db.scalars(
            select(Expense)
            .where(
                Expense.business_id == business.id,
                Expense.created_at >= start,
                Expense.created_at < end,
            )
            .order_by(Expense.created_at.desc())
        ).all()
    )


@router.get("/cash/summary", response_model=CashSummaryOut)
def cash_summary(
    day: date | None = Query(default=None, alias="date"),
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CashSummaryOut:
    target = day or to_local(utcnow_naive(), business.timezone).date()
    start, end = local_day_bounds(target, business.timezone)
    payments = _payments_range(db, business, start, end)
    expenses = list(
        db.scalars(
            select(Expense).where(
                Expense.business_id == business.id,
                Expense.created_at >= start,
                Expense.created_at < end,
            )
        ).all()
    )
    by_method = defaultdict(int)
    for payment in payments:
        by_method[payment.method.value] += payment.amount_cents
    cash_tips = sum(p.tip_cents for p in payments if p.method == PaymentMethod.cash)
    expenses_total = sum(expense.amount_cents for expense in expenses)
    income = _sum_amount(payments)
    completed_count = len(
        db.scalars(
            select(Appointment.id).where(
                Appointment.business_id == business.id,
                Appointment.start_at >= start,
                Appointment.start_at < end,
                Appointment.status == AppointmentStatus.completed,
            )
        ).all()
    )
    return CashSummaryOut(
        date=target,
        business_name=business.name,
        currency=business.currency,
        income_cents=income,
        cash_cents=by_method.get("cash", 0),
        card_cents=by_method.get("card", 0),
        transfer_cents=by_method.get("transfer", 0),
        other_cents=by_method.get("other", 0),
        tips_cents=_sum_tips(payments),
        expenses_cents=expenses_total,
        expected_cash_cents=by_method.get("cash", 0) + cash_tips - expenses_total,
        payments_count=len(payments),
        completed_appointments=completed_count,
        average_ticket_cents=round(income / len(payments)) if payments else 0,
        payments=payments,
        expenses=expenses,
    )


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardOut:
    now_local = to_local(utcnow_naive(), business.timezone)
    today = now_local.date()
    month_start_day = today.replace(day=1)
    next_month_day = (
        date(month_start_day.year + 1, 1, 1)
        if month_start_day.month == 12
        else date(month_start_day.year, month_start_day.month + 1, 1)
    )
    week_start_day = today - timedelta(days=6)
    today_start, today_end = local_day_bounds(today, business.timezone)
    month_start, _ = local_day_bounds(month_start_day, business.timezone)
    _, month_end = local_day_bounds(next_month_day, business.timezone)
    week_start, _ = local_day_bounds(week_start_day, business.timezone)

    appointments_today = _appointments_range(db, business, today_start, today_end)
    payments_today = _payments_range(db, business, today_start, today_end)
    payments_month = _payments_range(db, business, month_start, month_end)
    payments_week = _payments_range(db, business, week_start, today_end)
    staff = list(
        db.scalars(
            select(User).where(User.business_id == business.id, User.active.is_(True))
        ).all()
    )

    upcoming = [
        appointment
        for appointment in appointments_today
        if appointment.status in (AppointmentStatus.pending, AppointmentStatus.confirmed)
        and appointment.start_at >= utcnow_naive()
    ][:6]

    clients = list(db.scalars(select(Client).where(Client.business_id == business.id)).all())
    birthdays = []
    for client in clients:
        if client.birthday is None:
            continue
        candidate = None
        for year in (today.year, today.year + 1):
            try:
                possible = client.birthday.replace(year=year)
            except ValueError:
                continue
            if possible >= today:
                candidate = possible
                break
        if candidate and (candidate - today).days <= 7:
            birthdays.append((candidate, client))
    birthdays.sort(key=lambda item: item[0])

    last_7_days = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
    last_7_start, _ = local_day_bounds(last_7_days[0], business.timezone)
    payments_7 = _payments_range(db, business, last_7_start, today_end)
    appointments_7 = _appointments_range(db, business, last_7_start, today_end)

    new_clients_month = len(
        db.scalars(
            select(Client.id).where(
                Client.business_id == business.id,
                Client.created_at >= month_start,
                Client.created_at < month_end,
            )
        ).all()
    )
    income_today = _sum_amount(payments_today)
    return DashboardOut(
        date=today,
        today_label=format_date_es(today),
        business=business,
        revenue_today_cents=income_today,
        revenue_week_cents=_sum_amount(payments_week),
        revenue_month_cents=_sum_amount(payments_month),
        revenue_goal_cents=business.monthly_goal_cents,
        tips_today_cents=_sum_tips(payments_today),
        appointments_today=len(appointments_today),
        completed_today=sum(
            1 for a in appointments_today if a.status == AppointmentStatus.completed
        ),
        pending_today=sum(1 for a in appointments_today if a.status == AppointmentStatus.pending),
        upcoming=upcoming,
        average_ticket_cents=round(income_today / len(payments_today)) if payments_today else 0,
        expected_cash_cents=sum(
            p.amount_cents + p.tip_cents for p in payments_today if p.method == PaymentMethod.cash
        )
        - sum(
            e.amount_cents
            for e in db.scalars(
                select(Expense).where(
                    Expense.business_id == business.id,
                    Expense.created_at >= today_start,
                    Expense.created_at < today_end,
                )
            ).all()
        ),
        occupancy_pct=_occupancy_pct(business, staff, appointments_today, today, today),
        new_clients_month=new_clients_month,
        birthdays=[client for _, client in birthdays[:5]],
        unconfirmed=sum(
            1 for a in appointments_today if a.status == AppointmentStatus.pending
        ),
        revenue_last_7_days=_day_revenue(
            db, business, last_7_days, payments_7, appointments_7
        ),
        top_services=_top_services(payments_month),
    )


@router.get("/reports/summary", response_model=ReportOut)
def report_summary(
    start: date | None = None,
    end: date | None = None,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    today = to_local(utcnow_naive(), business.timezone).date()
    end_day = end or today
    start_day = start or (end_day - timedelta(days=29))
    if end_day < start_day:
        raise HTTPException(status_code=422, detail="La fecha final debe ser posterior a la inicial.")
    if (end_day - start_day).days > 366:
        raise HTTPException(status_code=422, detail="El rango máximo es de un año.")
    start_dt, _ = local_day_bounds(start_day, business.timezone)
    _, end_dt = local_day_bounds(end_day, business.timezone)

    payments = _payments_range(db, business, start_dt, end_dt)
    appointments = _appointments_range(db, business, start_dt, end_dt)
    staff = list(
        db.scalars(select(User).where(User.business_id == business.id, User.active.is_(True))).all()
    )
    clients = list(db.scalars(select(Client).where(Client.business_id == business.id)).all())
    client_map = {client.id: client for client in clients}

    days = [start_day + timedelta(days=offset) for offset in range((end_day - start_day).days + 1)]
    revenue = _sum_amount(payments)

    completed_appointments = [a for a in appointments if a.status == AppointmentStatus.completed]
    new_clients = [
        client for client in clients if start_dt <= client.created_at < end_dt
    ]
    recurring_ids = {
        appointment.client_id
        for appointment in appointments
        if appointment.status == AppointmentStatus.completed
        and appointment.client_id in client_map
        and client_map[appointment.client_id].created_at < start_dt
    }

    by_method = {method.value: 0 for method in PaymentMethod}
    for payment in payments:
        by_method[payment.method.value] += payment.amount_cents

    staff_rows = []
    for member in staff:
        member_payments = [p for p in payments if p.staff_id == member.id]
        member_appointments = [a for a in completed_appointments if a.staff_id == member.id]
        staff_rows.append(
            {
                "staff_id": member.id,
                "name": member.name,
                "color": member.color,
                "appointments": len(member_appointments),
                "revenue_cents": sum(p.amount_cents for p in member_payments),
                "commission_cents": sum(
                    commission_cents(p.amount_cents, member.commission_bps)
                    for p in member_payments
                ),
                "occupancy_pct": _occupancy_pct(
                    business, [member], appointments, start_day, end_day
                ),
            }
        )
    staff_rows.sort(key=lambda row: row["revenue_cents"], reverse=True)

    client_totals: dict[int, dict] = {}
    for payment in payments:
        if payment.client_id is None:
            continue
        item = client_totals.setdefault(
            payment.client_id, {"client_id": payment.client_id, "name": "", "visits": 0, "spent_cents": 0}
        )
        client = client_map.get(payment.client_id)
        item["name"] = client.name if client else "Clienta"
        item["visits"] += 1
        item["spent_cents"] += payment.amount_cents
    top_clients = sorted(client_totals.values(), key=lambda row: row["spent_cents"], reverse=True)[:5]

    return ReportOut(
        start=start_day,
        end=end_day,
        revenue_cents=revenue,
        tips_cents=_sum_tips(payments),
        payments_count=len(payments),
        avg_ticket_cents=round(revenue / len(payments)) if payments else 0,
        completed_appointments=len(completed_appointments),
        canceled_appointments=sum(
            1 for a in appointments if a.status == AppointmentStatus.canceled
        ),
        no_show_appointments=sum(
            1 for a in appointments if a.status == AppointmentStatus.no_show
        ),
        new_clients=len(new_clients),
        recurring_clients=len(recurring_ids),
        occupancy_pct=_occupancy_pct(business, staff, appointments, start_day, end_day),
        by_day=_day_revenue(db, business, days, payments, appointments),
        by_method=by_method,
        top_services=_top_services(payments),
        staff=staff_rows,
        top_clients=top_clients,
    )


@router.get("/reports/export.csv")
def export_report_csv(
    start: date | None = None,
    end: date | None = None,
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = to_local(utcnow_naive(), business.timezone).date()
    end_day = end or today
    start_day = start or (end_day - timedelta(days=29))
    if end_day < start_day:
        raise HTTPException(status_code=422, detail="La fecha final debe ser posterior a la inicial.")
    start_dt, _ = local_day_bounds(start_day, business.timezone)
    _, end_dt = local_day_bounds(end_day, business.timezone)
    payments = _payments_range(db, business, start_dt, end_dt)

    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer)
    writer.writerow(
        ["Fecha", "Clienta", "Servicio", "Profesional", "Monto MXN", "Propina MXN", "Total MXN", "Método", "Referencia"]
    )
    for payment in payments:
        local = to_local(payment.created_at, business.timezone)
        appointment = payment.appointment
        writer.writerow(
            [
                local.strftime("%Y-%m-%d %H:%M"),
                appointment.client.name if appointment else "",
                appointment.service.name if appointment else "",
                appointment.staff.name if appointment else "",
                f"{payment.amount_cents / 100:.2f}",
                f"{payment.tip_cents / 100:.2f}",
                f"{(payment.amount_cents + payment.tip_cents) / 100:.2f}",
                METHOD_LABELS.get(payment.method.value, payment.method.value),
                payment.reference or "",
            ]
        )
    writer.writerow([])
    writer.writerow(
        [
            "TOTALES",
            "",
            "",
            "",
            f"{_sum_amount(payments) / 100:.2f}",
            f"{_sum_tips(payments) / 100:.2f}",
            f"{(sum(p.amount_cents + p.tip_cents for p in payments)) / 100:.2f}",
            "",
            "",
        ]
    )
    filename = f"bellessa-{business.slug}-{start_day:%Y%m%d}-{end_day:%Y%m%d}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
