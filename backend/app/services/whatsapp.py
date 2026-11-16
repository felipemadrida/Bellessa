from __future__ import annotations

import json
import logging
import re
import unicodedata
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..config import settings
from ..models import (
    Appointment,
    AppointmentStatus,
    Business,
    Client,
    MessageLog,
    Service,
    User,
    WhatsAppConversation,
)
from ..utils import (
    format_date_es,
    format_datetime_es,
    local_to_utc_naive,
    new_confirmation_code,
    normalize_phone_mx,
    to_local,
    utcnow_naive,
)
from .availability import compute_slots, is_slot_available
from .booking import ensure_client_has_no_overlap

logger = logging.getLogger("bellessa.whatsapp")

GREETING_COMMANDS = {"hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "inicio", "menu", "empezar"}
HUMAN_COMMANDS = {"humano", "asesor", "persona", "recepcion", "recepcionista", "hablar con alguien"}


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", normalized).strip().lower()


def _client_for_phone(db: Session, business: Business, phone: str) -> Client | None:
    return db.scalar(
        select(Client).where(Client.business_id == business.id, Client.phone == phone)
    )


def _conversation_for(
    db: Session, business: Business, phone: str
) -> WhatsAppConversation:
    conversation = db.scalar(
        select(WhatsAppConversation).where(
            WhatsAppConversation.business_id == business.id,
            WhatsAppConversation.phone == phone,
        )
    )
    if conversation is None:
        conversation = WhatsAppConversation(business_id=business.id, phone=phone, step="start")
        db.add(conversation)
        db.flush()
    return conversation


def _reset_conversation(conversation: WhatsAppConversation, step: str = "start") -> None:
    conversation.step = step
    conversation.service_id = None
    conversation.staff_id = None
    conversation.requested_date = None
    conversation.slot_utc = None
    conversation.draft_name = None


def _cloud_send(phone: str, body: str) -> tuple[bool, str | None]:
    if not settings.whatsapp_token or not settings.whatsapp_phone_number_id:
        return False, "WhatsApp Cloud API sin token o phone_number_id configurado."
    url = (
        f"https://graph.facebook.com/{settings.whatsapp_cloud_version}/"
        f"{settings.whatsapp_phone_number_id}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": f"52{phone}",
        "type": "text",
        "text": {"preview_url": False, "body": body},
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.whatsapp_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            response.read()
        return True, None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        return False, f"Meta {exc.code}: {detail}"
    except Exception as exc:  # pragma: no cover - red / timeouts
        return False, str(exc)


def send_message(
    db: Session,
    business: Business,
    phone: str,
    body: str,
    *,
    kind: str,
    template_key: str | None = None,
    client_id: int | None = None,
    appointment_id: int | None = None,
    dedupe_key: str | None = None,
    marketing: bool = False,
    commit: bool = True,
) -> MessageLog | None:
    """Envía por Cloud API o registra en el simulador local.

    Con `marketing=True` exige consentimiento de la clienta. Los recordatorios
    transaccionales no se bloquean por esa preferencia.
    """
    phone = normalize_phone_mx(phone)
    if len(phone) != 10:
        logger.warning("Teléfono inválido para WhatsApp: %s", phone)
        return None
    existing = None
    if dedupe_key:
        existing = db.scalar(select(MessageLog).where(MessageLog.dedupe_key == dedupe_key))
        # Un fallo sí se puede reintentar; un envío correcto no se duplica.
        if existing is not None and existing.status != "failed":
            return existing

    client = db.get(Client, client_id) if client_id else _client_for_phone(db, business, phone)
    if marketing and client is not None and not client.accepts_marketing:
        if existing is not None:
            existing.status = "skipped"
            existing.provider = "none"
            existing.error = "La clienta no acepta promociones."
            if commit:
                db.commit()
                db.refresh(existing)
            return existing
        log = MessageLog(
            business_id=business.id,
            client_id=client.id,
            appointment_id=appointment_id,
            phone=phone,
            kind=kind,
            template_key=template_key,
            body=body,
            status="skipped",
            provider="none",
            error="La clienta no acepta promociones.",
            dedupe_key=dedupe_key,
        )
        db.add(log)
        if commit:
            db.commit()
            db.refresh(log)
        return log

    provider = settings.whatsapp_provider.lower().strip()
    status = "mock_sent"
    sent_at: datetime | None = utcnow_naive()
    error: str | None = None
    if provider == "cloud":
        ok, error = _cloud_send(phone, body)
        status = "sent" if ok else "failed"
        sent_at = utcnow_naive() if ok else None
        provider = "cloud"
    else:
        provider = "mock"

    if existing is not None:
        existing.body = body
        existing.status = status
        existing.provider = provider
        existing.sent_at = sent_at
        existing.error = error
        if commit:
            db.commit()
            db.refresh(existing)
        logger.info("WhatsApp %s reintentado a %s: %s", kind, phone, status)
        return existing

    log = MessageLog(
        business_id=business.id,
        client_id=client.id if client else None,
        appointment_id=appointment_id,
        phone=phone,
        kind=kind,
        template_key=template_key,
        body=body,
        status=status,
        provider=provider,
        sent_at=sent_at,
        error=error,
        dedupe_key=dedupe_key,
    )
    db.add(log)
    if commit:
        db.commit()
        db.refresh(log)
    logger.info("WhatsApp %s a %s: %s (%s)", kind, phone, status, provider)
    return log


def _load_services(db: Session, business: Business) -> list[Service]:
    return list(
        db.scalars(
            select(Service)
            .where(Service.business_id == business.id, Service.active.is_(True))
            .order_by(Service.sort_order, Service.id)
        ).all()
    )


def _unique_time_slots(slots: list) -> list:
    seen: set[str] = set()
    result = []
    for slot in slots:
        label = slot.start_at.strftime("%H:%M")
        if label in seen:
            continue
        seen.add(label)
        result.append(slot)
    return result


def _available_days(
    db: Session, business: Business, service: Service, limit: int = 5
) -> list[tuple[date, list]]:
    today = to_local(utcnow_naive(), business.timezone).date()
    days: list[tuple[date, list]] = []
    for offset in range(0, 15):
        day = today + timedelta(days=offset)
        slots = compute_slots(db, business, day, service, enforce_notice=True)
        if slots:
            days.append((day, slots))
        if len(days) >= limit:
            break
    return days


def _service_selection(db: Session, business: Business, conversation: WhatsAppConversation, text: str, replies: list[str]) -> None:
    services = _load_services(db, business)
    digits = re.sub(r"\D", "", text)
    if not digits or not 1 <= int(digits) <= len(services):
        body = "Escribe el número del servicio que te interesa:\n" + "\n".join(
            f"{index}) {service.name} · {service.duration_min} min · ${service.price_cents / 100:,.0f}"
            for index, service in enumerate(services, start=1)
        )
        _reply(db, business, conversation, body, replies)
        return
    service = services[int(digits) - 1]
    conversation.service_id = service.id
    conversation.step = "date"
    days = _available_days(db, business, service)
    if not days:
        _reply(
            db,
            business,
            conversation,
            "Por ahora no tengo horarios disponibles para ese servicio. "
            "Escribe HUMANO y con gusto te ayudamos.",
            replies,
        )
        conversation.step = "human"
        return
    lines = [f"¡Perfecto! {service.name} cuesta ${service.price_cents / 100:,.0f} y dura {service.duration_min} min.", "", "Elige el día:"]
    for index, (day, slots) in enumerate(days, start=1):
        times = ", ".join(slot.start_at.strftime("%H:%M") for slot in slots[:4])
        lines.append(f"{index}) {format_date_es(day)} — {times}")
    lines.append("")
    lines.append("Escribe el número de la opción o la fecha (AAAA-MM-DD).")
    _reply(db, business, conversation, "\n".join(lines), replies)


def _parse_date(text: str, today: date, options: list[date]) -> date | None:
    clean = text.strip()
    if clean.isdigit() and 1 <= int(clean) <= len(options):
        return options[int(clean) - 1]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m"):
        try:
            parsed = datetime.strptime(clean, fmt).date()
            if fmt == "%d/%m":
                parsed = parsed.replace(year=today.year)
            return parsed
        except ValueError:
            continue
    return None


def _date_selection(db: Session, business: Business, conversation: WhatsAppConversation, text: str, replies: list[str]) -> None:
    if conversation.service_id is None:
        conversation.step = "service"
        return
    service = db.get(Service, conversation.service_id)
    if service is None:
        _reset_conversation(conversation)
        _reply(db, business, conversation, "Ese servicio ya no está disponible. Escribe MENU.", replies)
        return
    days = _available_days(db, business, service)
    if not days:
        _reply(db, business, conversation, "Ya no quedan horarios. Escribe HUMANO para ayuda.", replies)
        return
    today = to_local(utcnow_naive(), business.timezone).date()
    chosen = _parse_date(text, today, [day for day, _ in days])
    if chosen is None:
        _reply(db, business, conversation, "No entendí la fecha. Escribe el número de opción o AAAA-MM-DD.", replies)
        return
    day_slots = next((slots for day, slots in days if day == chosen), [])
    if not day_slots:
        _reply(db, business, conversation, "Ese día no tiene horarios. Elige otro de la lista.", replies)
        return
    conversation.requested_date = chosen
    conversation.step = "time"
    lines = [f"Horarios para {format_date_es(chosen)}:", ""]
    options = _unique_time_slots(day_slots)
    for index, slot in enumerate(options, start=1):
        lines.append(f"{index}) {slot.start_at.strftime('%H:%M')} con {slot.staff.name.split()[0]}")
    lines.append("")
    lines.append("Escribe el número o la hora (HH:MM).")
    _reply(db, business, conversation, "\n".join(lines), replies)


def _time_selection(db: Session, business: Business, conversation: WhatsAppConversation, text: str, replies: list[str]) -> None:
    if conversation.service_id is None or conversation.requested_date is None:
        conversation.step = "service"
        return
    service = db.get(Service, conversation.service_id)
    if service is None:
        _reset_conversation(conversation)
        return
    slots = compute_slots(
        db,
        business,
        conversation.requested_date,
        service,
        enforce_notice=True,
    )
    if not slots:
        conversation.step = "date"
        _reply(db, business, conversation, "Ese día ya no tiene horarios. Escribe otra fecha.", replies)
        return
    slots = _unique_time_slots(slots)
    chosen = None
    clean = text.strip().lower().replace(".", "")
    if clean.isdigit() and 1 <= int(clean) <= len(slots):
        chosen = slots[int(clean) - 1]
    else:
        match = re.search(r"(\d{1,2})(?::(\d{2}))?", clean)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2) or 0)
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                chosen = next(
                    (
                        slot
                        for slot in slots
                        if slot.start_at.hour == hour and slot.start_at.minute == minute
                    ),
                    None,
                )
    if chosen is None:
        _reply(db, business, conversation, "No encontré ese horario. Escribe el número o HH:MM de la lista.", replies)
        return
    conversation.staff_id = chosen.staff.id
    conversation.slot_utc = chosen.start_at.astimezone(timezone.utc).replace(tzinfo=None)
    conversation.step = "name"
    client = _client_for_phone(db, business, conversation.phone)
    if client is not None:
        conversation.client_id = client.id
        conversation.step = "confirm"
        _send_summary(db, business, conversation, replies, ask_confirmation=True)
        return
    _reply(
        db,
        business,
        conversation,
        f"¡Listo! {format_date_es(chosen.start_at.date())} a las {chosen.start_at.strftime('%H:%M')} "
        f"con {chosen.staff.name}.\n\n¿Cómo te llamas?",
        replies,
    )


def _send_summary(
    db: Session,
    business: Business,
    conversation: WhatsAppConversation,
    replies: list[str],
    *,
    ask_confirmation: bool,
) -> None:
    service = db.get(Service, conversation.service_id) if conversation.service_id else None
    staff = db.get(User, conversation.staff_id) if conversation.staff_id else None
    client = db.get(Client, conversation.client_id) if conversation.client_id else None
    if not service or not staff or conversation.slot_utc is None:
        _reset_conversation(conversation)
        _reply(db, business, conversation, "Algo se perdió en el camino. Escribe MENU.", replies)
        return
    local = to_local(conversation.slot_utc, business.timezone)
    name = client.name.split()[0] if client else (conversation.draft_name or "")
    lines = [
        f"Resumen para {name}:" if name else "Resumen de tu cita:",
        f"• Servicio: {service.name}",
        f"• Fecha: {format_date_es(local.date())}",
        f"• Hora: {local.strftime('%H:%M')}",
        f"• Profesional: {staff.name}",
        f"• Precio: ${service.price_cents / 100:,.0f} MXN",
    ]
    if business.require_deposit:
        deposit = round(service.price_cents * business.deposit_percent / 100)
        lines.append(f"• Anticipo sugerido: ${deposit / 100:,.0f} MXN")
    if ask_confirmation:
        lines += ["", "Responde SI para confirmar o MENU para empezar de nuevo."]
    _reply(db, business, conversation, "\n".join(lines), replies)


def _confirm(
    db: Session,
    business: Business,
    conversation: WhatsAppConversation,
    replies: list[str],
) -> None:
    if conversation.service_id is None or conversation.staff_id is None or conversation.slot_utc is None:
        _reset_conversation(conversation)
        _reply(db, business, conversation, "Faltan datos. Escribe MENU.", replies)
        return
    service = db.get(Service, conversation.service_id)
    staff = db.get(User, conversation.staff_id)
    if service is None or staff is None:
        _reset_conversation(conversation)
        return
    start_at = conversation.slot_utc
    local_day = to_local(start_at, business.timezone).date()
    if not is_slot_available(
        db, business, local_day, service, staff.id, start_at, enforce_notice=True
    ):
        conversation.step = "date"
        _reply(db, business, conversation, "Ese horario acaba de ocuparse. Elige otro día.", replies)
        return

    client = _client_for_phone(db, business, conversation.phone)
    if client is None:
        name = (conversation.draft_name or "").strip()
        if len(name) < 2:
            conversation.step = "name"
            _reply(db, business, conversation, "¿Cómo te llamas?", replies)
            return
        client = Client(
            business_id=business.id,
            name=name,
            phone=conversation.phone,
            # El bot no presume consentimiento promocional; recepción puede activarlo.
            accepts_marketing=False,
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
        code = new_confirmation_code()

    appointment = Appointment(
        business_id=business.id,
        client_id=client.id,
        staff_id=staff.id,
        service_id=service.id,
        start_at=start_at,
        end_at=end_at,
        status=AppointmentStatus.confirmed,
        price_cents=service.price_cents,
        deposit_cents=deposit,
        source="whatsapp",
        confirmation_code=code,
        notes="Reserva creada por WhatsApp",
    )
    db.add(appointment)
    db.flush()
    conversation.last_appointment_id = appointment.id
    conversation.client_id = client.id
    conversation.step = "done"
    record_audit(
        db,
        business_id=business.id,
        user_id=None,
        action="cita.creada_por_whatsapp",
        entity_type="appointment",
        entity_id=appointment.id,
        detail=f"{client.name} · {service.name} · {format_datetime_es(start_at, business.timezone)}",
    )
    local = to_local(start_at, business.timezone)
    _reply(
        db,
        business,
        conversation,
        f"¡Listo, {client.name.split()[0]}! Tu cita quedó confirmada.\n\n"
        f"{service.name}\n{format_date_es(local.date())} a las {local.strftime('%H:%M')}\n"
        f"Con {staff.name}\nCódigo: {code}\n\n"
        f"Te esperamos. Si necesitas cancelar, escribe CANCELAR.",
        replies,
        client_id=client.id,
        appointment_id=appointment.id,
    )
    business_phone = normalize_phone_mx(business.whatsapp or business.phone)
    if len(business_phone) == 10:
        send_message(
            db,
            business,
            business_phone,
            f"Nueva cita por WhatsApp: {client.name} · {service.name} · "
            f"{format_datetime_es(start_at, business.timezone)} · {staff.name}. Código {code}.",
            kind="internal_reception",
            client_id=None,
            appointment_id=appointment.id,
            commit=False,
        )
    db.commit()


def _reply(
    db: Session,
    business: Business,
    conversation: WhatsAppConversation,
    body: str,
    replies: list[str],
    *,
    client_id: int | None = None,
    appointment_id: int | None = None,
) -> None:
    replies.append(body)
    send_message(
        db,
        business,
        conversation.phone,
        body,
        kind="bot",
        template_key="bot",
        client_id=client_id or conversation.client_id,
        appointment_id=appointment_id,
        commit=False,
    )


def _cancel_latest(db: Session, business: Business, client: Client) -> Appointment | None:
    appointment = db.scalar(
        select(Appointment)
        .where(
            Appointment.business_id == business.id,
            Appointment.client_id == client.id,
            Appointment.status.in_((AppointmentStatus.pending, AppointmentStatus.confirmed)),
            Appointment.start_at >= utcnow_naive(),
        )
        .order_by(Appointment.start_at)
        .limit(1)
    )
    if appointment is None:
        return None
    appointment.status = AppointmentStatus.canceled
    appointment.notes = (
        f"{appointment.notes}\nCancelada por WhatsApp" if appointment.notes else "Cancelada por WhatsApp"
    )
    appointment.updated_at = utcnow_naive()
    record_audit(
        db,
        business_id=business.id,
        user_id=None,
        action="cita.cancelada_por_whatsapp",
        entity_type="appointment",
        entity_id=appointment.id,
        detail=client.name,
    )
    return appointment


def process_incoming(db: Session, business: Business, phone: str, text: str) -> list[str]:
    """Procesa un mensaje entrante y devuelve las respuestas generadas.

    El estado vive en `whatsapp_conversations`, por lo que el flujo sobrevive
    reinicios y puede ser inspeccionado por recepción.
    """
    phone = normalize_phone_mx(phone)
    conversation = _conversation_for(db, business, phone)
    replies: list[str] = []
    clean = normalize_text(text)
    client = _client_for_phone(db, business, phone)

    if clean in {"baja", "stop", "no molestar"}:
        if client:
            client.accepts_marketing = False
        conversation.step = "done"
        _reply(db, business, conversation, "Listo, no recibirás promociones. Los recordatorios de tus citas seguirán activos.", replies)
        db.commit()
        return replies

    if clean in HUMAN_COMMANDS:
        conversation.step = "human"
        _reply(
            db,
            business,
            conversation,
            "Te paso con una persona del salón. En un momento te escribimos. 🙌",
            replies,
        )
        business_phone = normalize_phone_mx(business.whatsapp or business.phone)
        if len(business_phone) == 10:
            send_message(
                db,
                business,
                business_phone,
                f"Atención humana solicitada por {phone}"
                + (f" ({client.name})" if client else "")
                + f": {text[:200]}",
                kind="handoff",
                commit=False,
            )
        db.commit()
        return replies

    if clean in {"cancelar", "cancelar cita"}:
        if client and (cancelled := _cancel_latest(db, business, client)):
            conversation.last_appointment_id = cancelled.id
            _reply(
                db,
                business,
                conversation,
                f"Cancelé tu cita de {format_datetime_es(cancelled.start_at, business.timezone)}. "
                "Escribe MENU si quieres agendar otra.",
                replies,
            )
        else:
            _reply(db, business, conversation, "No encontré una cita próxima para cancelar. Escríbenos HUMANO.", replies)
        conversation.step = "done"
        db.commit()
        return replies

    if clean in {"reprogramar", "mover", "cambiar"}:
        if client and (cancelled := _cancel_latest(db, business, client)):
            conversation.last_appointment_id = cancelled.id
            _reset_conversation(conversation)
            _reply(
                db,
                business,
                conversation,
                "Listo, liberé tu cita anterior. Vamos a elegir un nuevo horario.",
                replies,
            )
            _show_services(db, business, conversation, replies, client)
            db.commit()
            return replies
        _reply(db, business, conversation, "Dime MENU para agendar y luego podemos mover la cita.", replies)
        db.commit()
        return replies

    if clean in GREETING_COMMANDS or conversation.step in {"start", "done"}:
        _reset_conversation(conversation)
        conversation.client_id = client.id if client else None
        _show_services(db, business, conversation, replies, client)
        db.commit()
        return replies

    if conversation.step == "service":
        _service_selection(db, business, conversation, text, replies)
    elif conversation.step == "date":
        _date_selection(db, business, conversation, text, replies)
    elif conversation.step == "time":
        _time_selection(db, business, conversation, text, replies)
    elif conversation.step == "name":
        if len(text.strip()) < 2:
            _reply(db, business, conversation, "Escribe tu nombre, por favor.", replies)
        else:
            conversation.draft_name = text.strip()[:120]
            conversation.step = "confirm"
            _send_summary(db, business, conversation, replies, ask_confirmation=True)
    elif conversation.step == "confirm":
        if normalize_text(text) in {"si", "sí", "confirmo", "confirmar", "1"}:
            try:
                _confirm(db, business, conversation, replies)
            except HTTPException as exc:
                _reply(
                    db,
                    business,
                    conversation,
                    str(exc.detail)
                    + " Escribe MENU para elegir otro horario o HUMANO para ayuda.",
                    replies,
                )
                _reset_conversation(conversation)
                db.commit()
            return replies
        if normalize_text(text) in {"no", "2"}:
            _reset_conversation(conversation)
            _show_services(db, business, conversation, replies, client)
        else:
            _reply(db, business, conversation, "Responde SI para confirmar o NO para empezar de nuevo.", replies)
    elif conversation.step == "human":
        _reply(
            db,
            business,
            conversation,
            "Ya avisamos al salón. Una persona te escribirá en breve.",
            replies,
        )
    else:
        _reset_conversation(conversation)
        _show_services(db, business, conversation, replies, client)

    db.commit()
    return replies


def _show_services(
    db: Session,
    business: Business,
    conversation: WhatsAppConversation,
    replies: list[str],
    client: Client | None,
) -> None:
    services = _load_services(db, business)
    if not services:
        conversation.step = "human"
        _reply(db, business, conversation, "Aún no hay servicios publicados. Te paso con recepción.", replies)
        return
    if client is not None:
        conversation.client_id = client.id
    name = f" {client.name.split()[0]}" if client and client.name else ""
    lines = [
        f"¡Hola{name}! Soy el asistente de {business.name}. 💫",
        "Estos son nuestros servicios:",
        "",
    ]
    for index, service in enumerate(services, start=1):
        lines.append(
            f"{index}) {service.name} — {service.duration_min} min — ${service.price_cents / 100:,.0f}"
        )
    lines += ["", "Escribe el número del servicio que quieres. Si prefieres hablar con una persona, escribe HUMANO."]
    conversation.step = "service"
    _reply(db, business, conversation, "\n".join(lines), replies)
