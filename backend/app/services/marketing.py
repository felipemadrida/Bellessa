from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Appointment, AppointmentStatus, Business, Client, MessageLog
from ..utils import (
    format_date_es,
    format_datetime_es,
    to_local,
    utcnow_naive,
)
from .loyalty import loyalty_summary, vip_client_ids
from .whatsapp import send_message

TEMPLATES: dict[str, dict] = {
    "reminder_24h": {
        "label": "Recordatorio 24 h",
        "description": "Reduce no-shows. Se envía un día antes de la cita.",
        "marketing": False,
        "body": (
            "Hola {nombre}, te recordamos tu {servicio} el {fecha} a las {hora} "
            "con {profesional} en {negocio}. Responde CONFIRMAR o CANCELAR. — {negocio}"
        ),
    },
    "reminder_2h": {
        "label": "Recordatorio 2 h",
        "description": "Último aviso antes de la cita.",
        "marketing": False,
        "body": (
            "¡Hola {nombre}! Tu cita de {servicio} es hoy a las {hora} con {profesional}. "
            "Te esperamos en {direccion}. — {negocio}"
        ),
    },
    "birthday": {
        "label": "Cumpleaños",
        "description": "Regalo de cumpleaños para asegurar la visita.",
        "marketing": True,
        "body": (
            "¡Feliz cumpleaños, {nombre}! 🎉 En {negocio} queremos consentirte: "
            "tienes 15% de descuento en tu próximo servicio este mes. "
            "Responde CUMPLE para agendar. Responde BAJA para no recibir promociones."
        ),
    },
    "winback_30": {
        "label": "Reactivación 30 días",
        "description": "Clientas que no vuelven hace 30 días.",
        "marketing": True,
        "body": (
            "Hola {nombre}, hace {dias} días que no te vemos en {negocio}. "
            "Te guardamos 10% en tu próximo servicio si agendas esta semana. "
            "Responde REACTIVAR para apartar. Responde BAJA para no recibir promociones."
        ),
    },
    "winback_60": {
        "label": "Reactivación 60 días",
        "description": "Clientas que no vuelven hace 60 días.",
        "marketing": True,
        "body": (
            "Hola {nombre}, hace {dias} días que no te vemos en {negocio}. "
            "Tu cabello merece un retoque: tenemos 15% para tu próxima visita esta semana. "
            "Responde REACTIVAR para agendar. Responde BAJA para no recibir promociones."
        ),
    },
    "winback_90": {
        "label": "Reactivación 90 días",
        "description": "Clientas que no vuelven hace 90 días; oferta de retorno.",
        "marketing": True,
        "body": (
            "Hola {nombre}, ¡te extrañamos en {negocio}! Han pasado {dias} días. "
            "Vuelve con 20% en tu próximo servicio y un tratamiento de hidratación de cortesía. "
            "Responde VOLVER para agendar. Responde BAJA para no recibir promociones."
        ),
    },
    "birthday_week": {
        "label": "Cumpleaños (7 días antes)",
        "description": "Regalo anticipado con vigencia de 30 días.",
        "marketing": True,
        "body": (
            "¡Hola {nombre}! Tu cumpleaños está muy cerca. 🎉 En {negocio} te regalamos "
            "15% de descuento válido por 30 días. Responde CUMPLE para agendar. "
            "Responde BAJA para no recibir promociones."
        ),
    },
    "loyalty": {
        "label": "Lealtad y puntos",
        "description": "Recordatorio de puntos, nivel y siguiente recompensa.",
        "marketing": True,
        "body": (
            "Hola {nombre}, tienes {puntos} puntos y nivel {nivel} en {negocio}. "
            "Te faltan {siguiente} visitas para tu recompensa de lealtad. "
            "Responde PUNTOS para agendar. Responde BAJA para no recibir promociones."
        ),
    },
    "valley": {
        "label": "Lunes y martes",
        "description": "Promoción de horas valle para llenar la semana.",
        "marketing": True,
        "body": (
            "Hola {nombre}, los lunes y martes son más tranquilos en {negocio}. "
            "Agenda tu {servicio_favorito} y recibe 20% de descuento. "
            "Responde LUNES para apartar. Responde BAJA para no recibir promociones."
        ),
    },
    "review": {
        "label": "Reseña post-servicio",
        "description": "Pide una reseña 24 h después de la visita.",
        "marketing": True,
        "body": (
            "Hola {nombre}, ¡gracias por tu visita a {negocio}! 💫 "
            "Nos encantaría saber cómo te quedó tu {servicio}. "
            "Déjanos una reseña en Google buscando “{negocio}”. "
            "Tu opinión ayuda a más personas a encontrar su lugar. Responde BAJA para no recibir promociones."
        ),
    },
    "referral": {
        "label": "Trae a una amiga",
        "description": "Programa de referidos 20% para ambas.",
        "marketing": True,
        "body": (
            "Hola {nombre}, en {negocio} creemos que consentirse es mejor acompañada. "
            "Trae a una amiga y ambas reciben 20% de descuento en su próximo servicio. "
            "Responde AMIGA para apartar. Responde BAJA para no recibir promociones."
        ),
    },
    "seasonal": {
        "label": "Temporada",
        "description": "Mensaje de temporada (Día de la Madre, fin de año).",
        "marketing": True,
        "body": (
            "Hola {nombre}, en {negocio} ya estamos listas para esta temporada. "
            "Regálate un momento para ti con 15% en tu servicio favorito. "
            "Responde TEMPORADA para agendar. Responde BAJA para no recibir promociones."
        ),
    },
}

SEGMENTS = {
    "all": "Todas las clientas",
    "vip": "VIP (top 20% de gasto)",
    "frecuentes": "Frecuentes (3+ visitas)",
    "ocasionales": "Ocasionales (1–2 visitas)",
    "inactivas_30": "Inactivas 30+ días",
    "inactivas_60": "Inactivas 60+ días",
    "inactivas_90": "Inactivas 90+ días",
    "inactivas": "Inactivas 60+ días",
    "cumpleanos": "Cumpleaños hoy",
}


def template_context(
    client: Client,
    business: Business,
    appointment: Appointment | None = None,
    *,
    days: int = 60,
    extra: dict[str, str] | None = None,
) -> dict[str, str]:
    address = ", ".join(
        part for part in [business.address, business.neighborhood, business.city] if part
    )
    context = {
        "nombre": client.name.split()[0] if client.name else "hola",
        "nombre_completo": client.name,
        "negocio": business.name,
        "direccion": address or business.name,
        "link": f"{business.slug}",
        "servicio_favorito": "servicio",
        "dias": str(days),
        "temporada": "esta temporada",
        "puntos": "0",
        "nivel": "nueva",
        "visitas": "0",
        "siguiente": "0",
    }
    if extra:
        context.update(extra)
    if appointment is not None:
        local = to_local(appointment.start_at, business.timezone)
        context.update(
            {
                "servicio": appointment.service.name,
                "profesional": appointment.staff.name,
                "fecha": format_date_es(local.date()),
                "hora": local.strftime("%H:%M"),
            }
        )
    return context


def render_template(
    key: str,
    client: Client,
    business: Business,
    appointment: Appointment | None = None,
    *,
    days: int = 60,
    extra: dict[str, str] | None = None,
) -> str:
    template = TEMPLATES[key]["body"]
    return template.format(
        **template_context(client, business, appointment, days=days, extra=extra)
    )


def _completed_counts(db: Session, business: Business) -> dict[int, int]:
    rows = db.execute(
        select(Appointment.client_id, func.count(Appointment.id))
        .where(
            Appointment.business_id == business.id,
            Appointment.status == AppointmentStatus.completed,
            Appointment.client_id.is_not(None),
        )
        .group_by(Appointment.client_id)
    ).all()
    return {client_id: count for client_id, count in rows if client_id is not None}


def clients_for_segment(
    db: Session, business: Business, segment: str
) -> list[Client]:
    clients = list(
        db.scalars(
            select(Client)
            .where(Client.business_id == business.id)
            .order_by(Client.name)
        ).all()
    )
    if segment == "all":
        return clients
    now = utcnow_naive()
    today = to_local(now, business.timezone).date()
    counts = _completed_counts(db, business)
    if segment == "vip":
        vip_ids = vip_client_ids(db, business)
        return [client for client in clients if client.id in vip_ids]
    if segment == "frecuentes":
        return [client for client in clients if counts.get(client.id, 0) >= 3]
    if segment == "ocasionales":
        return [client for client in clients if 1 <= counts.get(client.id, 0) <= 2]
    inactive_days = {
        "inactivas_30": 30,
        "inactivas_60": 60,
        "inactivas_90": 90,
        "inactivas": 60,
    }.get(segment)
    if inactive_days is not None:
        threshold = now - timedelta(days=inactive_days)
        return [
            client
            for client in clients
            if (client.last_visit_at is not None and client.last_visit_at < threshold)
            or (client.last_visit_at is None and client.created_at < threshold)
        ]
    if segment == "cumpleanos":
        return [
            client
            for client in clients
            if client.birthday is not None
            and client.birthday.month == today.month
            and client.birthday.day == today.day
        ]
    return []


def segment_summary(db: Session, business: Business) -> list[dict]:
    return [
        {
            "key": key,
            "label": label,
            "description": description,
            "count": len(clients_for_segment(db, business, key)),
        }
        for key, (label, description) in {
            "all": ("Todas las clientas", "Base completa con consentimiento o sin él."),
            "vip": ("VIP", "Top 20% de gasto en los últimos 12 meses."),
            "frecuentes": ("Frecuentes", "Tres o más visitas completadas."),
            "ocasionales": ("Ocasionales", "Una o dos visitas completadas."),
            "inactivas_30": ("Inactivas 30 días", "Sin visita en los últimos 30 días."),
            "inactivas_60": ("Inactivas 60 días", "Sin visita en los últimos 60 días."),
            "inactivas_90": ("Inactivas 90 días", "Sin visita en los últimos 90 días."),
            "cumpleanos": ("Cumpleaños hoy", "Clientas que cumplen años hoy."),
        }.items()
    ]


def queue_campaign(
    db: Session,
    business: Business,
    template_key: str,
    segment: str,
    *,
    user_id: int | None = None,
) -> dict:
    if template_key not in TEMPLATES:
        raise ValueError("Plantilla desconocida.")
    if segment not in SEGMENTS:
        raise ValueError("Segmento desconocido.")
    today = to_local(utcnow_naive(), business.timezone).date()
    queued = 0
    skipped = 0
    for client in clients_for_segment(db, business, segment):
        if not client.phone or not client.accepts_marketing:
            skipped += 1
            continue
        dedupe_key = f"campaign:{template_key}:{today.isoformat()}:{client.id}"
        existing = db.scalar(
            select(MessageLog.id).where(
                MessageLog.dedupe_key == dedupe_key, MessageLog.status != "failed"
            )
        )
        if existing:
            skipped += 1
            continue
        loyalty = loyalty_summary(db, business, client)
        body = render_template(
            template_key,
            client,
            business,
            extra={
                "puntos": str(loyalty.points),
                "nivel": loyalty.level,
                "visitas": str(loyalty.visits),
                "siguiente": str(loyalty.next_reward_in),
            },
        )
        log = send_message(
            db,
            business,
            client.phone,
            body,
            kind="campaign",
            template_key=template_key,
            client_id=client.id,
            dedupe_key=dedupe_key,
            marketing=True,
            commit=False,
        )
        if log is not None and log.status != "skipped":
            queued += 1
        else:
            skipped += 1
    db.commit()
    return {"queued": queued, "skipped": skipped}


def enqueue_scheduled_messages(db: Session) -> dict[str, int]:
    """Job idempotente: recordatorios, cumpleaños, reactivación y reseñas."""
    now = utcnow_naive()
    stats = defaultdict(int)
    businesses = list(db.scalars(select(Business)).all())
    for business in businesses:
        appointments = list(
            db.scalars(
                select(Appointment).where(
                    Appointment.business_id == business.id,
                    Appointment.status.in_((AppointmentStatus.pending, AppointmentStatus.confirmed)),
                    Appointment.start_at >= now,
                    Appointment.start_at <= now + timedelta(hours=26),
                )
            ).all()
        )
        for appointment in appointments:
            delta = appointment.start_at - now
            if timedelta(hours=23) <= delta <= timedelta(hours=25):
                _send_reminder(db, business, appointment, "reminder_24h", stats)
            if timedelta(hours=1, minutes=30) <= delta <= timedelta(hours=2, minutes=30):
                _send_reminder(db, business, appointment, "reminder_2h", stats)

        today = to_local(now, business.timezone).date()
        birthday_clients = list(
            db.scalars(
                select(Client).where(
                    Client.business_id == business.id,
                    Client.accepts_marketing.is_(True),
                )
            ).all()
        )
        # Promoción de cumpleaños 7 días antes, vigencia de 30 días.
        birthday_target = today + timedelta(days=7)
        for client in birthday_clients:
            if (
                client.birthday is not None
                and client.birthday.month == birthday_target.month
                and client.birthday.day == birthday_target.day
            ):
                dedupe = f"birthday_week:{client.id}:{birthday_target.year}"
                if not _already(db, dedupe):
                    body = render_template("birthday_week", client, business)
                    send_message(
                        db,
                        business,
                        client.phone,
                        body,
                        kind="marketing",
                        template_key="birthday_week",
                        client_id=client.id,
                        dedupe_key=dedupe,
                        marketing=True,
                        commit=False,
                    )
                    stats["birthday_week"] += 1

        for client in birthday_clients:
            if not client.last_visit_at:
                continue
            days = (now - client.last_visit_at).days
            tier = 90 if days >= 90 else 60 if days >= 60 else 30 if days >= 30 else 0
            if tier == 0:
                continue
            dedupe = f"winback_{tier}:{client.id}:{today.strftime('%Y-%m')}"
            if _already(db, dedupe):
                continue
            body = render_template(f"winback_{tier}", client, business, days=days)
            send_message(
                db,
                business,
                client.phone,
                body,
                kind="marketing",
                template_key=f"winback_{tier}",
                client_id=client.id,
                dedupe_key=dedupe,
                marketing=True,
                commit=False,
            )
            stats[f"winback_{tier}"] += 1

        # Reseña 22–26 h después de una cita completada.
        completed = list(
            db.scalars(
                select(Appointment).where(
                    Appointment.business_id == business.id,
                    Appointment.status == AppointmentStatus.completed,
                    Appointment.end_at >= now - timedelta(hours=26),
                    Appointment.end_at <= now - timedelta(hours=22),
                )
            ).all()
        )
        for appointment in completed:
            dedupe = f"review:{appointment.id}"
            if _already(db, dedupe):
                continue
            client = db.get(Client, appointment.client_id)
            if client is None or not client.accepts_marketing:
                continue
            body = render_template("review", client, business, appointment)
            send_message(
                db,
                business,
                client.phone,
                body,
                kind="marketing",
                template_key="review",
                client_id=client.id,
                appointment_id=appointment.id,
                dedupe_key=dedupe,
                marketing=True,
                commit=False,
            )
            stats["review"] += 1

    db.commit()
    return dict(stats)


def _already(db: Session, dedupe_key: str) -> bool:
    return (
        db.scalar(
            select(MessageLog.id).where(
                MessageLog.dedupe_key == dedupe_key, MessageLog.status != "failed"
            )
        )
        is not None
    )


def _send_reminder(
    db: Session,
    business: Business,
    appointment: Appointment,
    template_key: str,
    stats: dict[str, int],
) -> None:
    client = db.get(Client, appointment.client_id)
    if client is None:
        return
    dedupe = f"{template_key}:{appointment.id}"
    if _already(db, dedupe):
        return
    body = render_template(template_key, client, business, appointment)
    send_message(
        db,
        business,
        client.phone,
        body,
        kind="reminder",
        template_key=template_key,
        client_id=client.id,
        appointment_id=appointment.id,
        dedupe_key=dedupe,
        marketing=False,
        commit=False,
    )
    stats[template_key] += 1


def template_catalog() -> list[dict]:
    return [
        {
            "key": key,
            "label": value["label"],
            "description": value["description"],
            "preview": value["body"][:220],
            "marketing": value["marketing"],
        }
        for key, value in TEMPLATES.items()
    ]


def month_calendar(today: date) -> list[dict]:
    """Calendario editorial sugerido para el manual de marketing."""
    return [
        {"month": 1, "focus": "Año nuevo, nuevo look", "action": "Campaña de renovación + review de diciembre."},
        {"month": 2, "focus": "San Valentín", "action": "Paquete en pareja o autocuidado; recordatorios 24 h."},
        {"month": 3, "focus": "Primavera", "action": "Color y balayage; upsell de tratamiento."},
        {"month": 4, "focus": "Pre-Día de la Madre", "action": "Reserva de paquetes y anticipos."},
        {"month": 5, "focus": "Día de la Madre", "action": "Campaña de regalo; cupones para acompañantes."},
        {"month": 6, "focus": "Vacaciones", "action": "Peinados y uñas; horarios extendidos."},
        {"month": 7, "focus": "Verano", "action": "Protección y hidratación; reactivación 60 días."},
        {"month": 8, "focus": "Regreso a clases", "action": "Cortes y peinados prácticos; referidos."},
        {"month": 9, "focus": "Independencia", "action": "Promoción de color; contenido local."},
        {"month": 10, "focus": "Halloween", "action": "Maquillaje y uñas temáticas; lista de espera."},
        {"month": 11, "focus": "Buen Fin", "action": "Paquetes y bonos; campaña anticipada."},
        {"month": 12, "focus": "Fin de año", "action": "Novias, posadas y regalos; cierre de agenda."},
    ]
