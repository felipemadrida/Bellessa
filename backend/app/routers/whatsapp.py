from __future__ import annotations

import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_business
from ..models import Appointment, Business, Client, MessageLog
from ..schemas import (
    ManualMessageCreate,
    ManualMessageFailIn,
    ManualMessageOut,
    MessageLogOut,
    WhatsAppMockIn,
    WhatsAppMockOut,
    WhatsAppStatusOut,
)
from ..services.marketing import TEMPLATES, render_template
from ..services.whatsapp import process_incoming
from ..utils import normalize_phone_mx, utcnow_naive, whatsapp_link

logger = logging.getLogger("bellessa.whatsapp.webhook")

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.get("/status", response_model=WhatsAppStatusOut)
def whatsapp_status(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> WhatsAppStatusOut:
    return WhatsAppStatusOut(
        provider=settings.whatsapp_provider,
        configured=(
            settings.whatsapp_provider == "mock"
            or bool(settings.whatsapp_token and settings.whatsapp_phone_number_id)
        ),
        webhook_url=f"{settings.api_base_url}/api/whatsapp/webhook",
        phone_number_id=settings.whatsapp_phone_number_id or None,
        verify_token_configured=bool(settings.whatsapp_verify_token),
        scheduler_enabled=settings.scheduler_enabled,
        business_slug=business.slug,
        bot_phone=business.whatsapp or business.phone,
    )


@router.get("/outbox")
def outbox(
    limit: int = Query(default=40, ge=1, le=200),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> list[MessageLogOut]:
    logs = list(
        db.scalars(
            select(MessageLog)
            .where(MessageLog.business_id == business.id)
            .order_by(MessageLog.created_at.desc(), MessageLog.id.desc())
            .limit(limit)
        ).all()
    )
    result: list[MessageLogOut] = []
    for log in logs:
        client = db.get(Client, log.client_id) if log.client_id else None
        result.append(
            MessageLogOut(
                id=log.id,
                phone=log.phone,
                kind=log.kind,
                template_key=log.template_key,
                body=log.body,
                status=log.status,
                provider=log.provider,
                scheduled_for=log.scheduled_for,
                sent_at=log.sent_at,
                error=log.error,
                created_at=log.created_at,
                client_name=client.name if client else None,
            )
        )
    return result


def _manual_log(db: Session, business: Business, message_id: int) -> MessageLog:
    log = db.get(MessageLog, message_id)
    if log is None or log.business_id != business.id or log.kind != "manual":
        raise HTTPException(status_code=404, detail="Mensaje manual no encontrado.")
    return log


def _manual_payload(db: Session, log: MessageLog) -> ManualMessageOut:
    client = db.get(Client, log.client_id) if log.client_id else None
    return ManualMessageOut(
        id=log.id,
        phone=log.phone,
        kind=log.kind,
        template_key=log.template_key,
        body=log.body,
        status=log.status,
        provider=log.provider,
        scheduled_for=log.scheduled_for,
        sent_at=log.sent_at,
        error=log.error,
        created_at=log.created_at,
        client_name=client.name if client else None,
        client_id=log.client_id,
        appointment_id=log.appointment_id,
        wa_url=whatsapp_link(log.phone, log.body),
    )


@router.get("/manual", response_model=list[ManualMessageOut])
def manual_messages(
    status: str | None = Query(default=None, max_length=20),
    limit: int = Query(default=50, ge=1, le=200),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> list[ManualMessageOut]:
    query = select(MessageLog).where(
        MessageLog.business_id == business.id, MessageLog.kind == "manual"
    )
    if status:
        query = query.where(MessageLog.status == status)
    logs = list(
        db.scalars(
            query.order_by(MessageLog.created_at.desc(), MessageLog.id.desc()).limit(limit)
        ).all()
    )
    return [_manual_payload(db, log) for log in logs]


@router.post("/manual", response_model=ManualMessageOut, status_code=201)
def create_manual_message(
    payload: ManualMessageCreate,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> ManualMessageOut:
    appointment = None
    client = None
    if payload.appointment_id is not None:
        appointment = db.get(Appointment, payload.appointment_id)
        if appointment is None or appointment.business_id != business.id:
            raise HTTPException(status_code=404, detail="Cita no encontrada.")
        client = appointment.client
    elif payload.client_id is not None:
        client = db.get(Client, payload.client_id)
        if client is None or client.business_id != business.id:
            raise HTTPException(status_code=404, detail="Clienta no encontrada.")
    if client is None:
        raise HTTPException(status_code=422, detail="Selecciona una clienta o una cita.")

    phone = normalize_phone_mx(client.phone)
    if len(phone) != 10:
        raise HTTPException(status_code=422, detail="La clienta no tiene un WhatsApp válido.")

    body = (payload.body or "").strip()
    if not body:
        if payload.template_key not in TEMPLATES:
            raise HTTPException(status_code=422, detail="Plantilla desconocida o mensaje vacío.")
        body = render_template(
            payload.template_key, client, business, appointment
        ).strip()
    if not body:
        raise HTTPException(status_code=422, detail="El mensaje no puede estar vacío.")

    log = MessageLog(
        business_id=business.id,
        client_id=client.id,
        appointment_id=appointment.id if appointment else None,
        phone=phone,
        kind="manual",
        template_key=payload.template_key,
        body=body,
        status="pending",
        provider="manual",
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _manual_payload(db, log)


@router.post("/manual/{message_id}/prepare", response_model=ManualMessageOut)
def prepare_manual_message(
    message_id: int,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> ManualMessageOut:
    log = _manual_log(db, business, message_id)
    if log.status in {"pending", "prepared"}:
        log.status = "prepared"
        db.commit()
        db.refresh(log)
    return _manual_payload(db, log)


@router.post("/manual/{message_id}/opened", response_model=ManualMessageOut)
def opened_manual_message(
    message_id: int,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> ManualMessageOut:
    log = _manual_log(db, business, message_id)
    if log.status not in {"failed", "confirmed"}:
        log.status = "opened"
        db.commit()
        db.refresh(log)
    return _manual_payload(db, log)


@router.post("/manual/{message_id}/confirm", response_model=ManualMessageOut)
def confirm_manual_message(
    message_id: int,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> ManualMessageOut:
    log = _manual_log(db, business, message_id)
    log.status = "confirmed"
    log.sent_at = utcnow_naive()
    log.error = None
    db.commit()
    db.refresh(log)
    return _manual_payload(db, log)


@router.post("/manual/{message_id}/failed", response_model=ManualMessageOut)
def failed_manual_message(
    message_id: int,
    payload: ManualMessageFailIn,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> ManualMessageOut:
    log = _manual_log(db, business, message_id)
    log.status = "failed"
    log.error = (payload.reason or "El operador no pudo enviar el mensaje.")[:500]
    db.commit()
    db.refresh(log)
    return _manual_payload(db, log)


@router.post("/mock", response_model=WhatsAppMockOut)
def mock_message(
    payload: WhatsAppMockIn,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> WhatsAppMockOut:
    """Simulador del bot: útil para demo y pruebas sin depender de Meta."""
    phone = normalize_phone_mx(payload.phone)
    if len(phone) != 10:
        raise HTTPException(status_code=422, detail="El teléfono debe tener 10 dígitos.")
    replies = process_incoming(db, business, phone, payload.text)
    return WhatsAppMockOut(replies=replies)


@router.get("/webhook", response_class=PlainTextResponse)
def verify_webhook(
    mode: str = Query(default="", alias="hub.mode"),
    token: str = Query(default="", alias="hub.verify_token"),
    challenge: str = Query(default="", alias="hub.challenge"),
) -> str:
    if mode == "subscribe" and token and hmac.compare_digest(token, settings.whatsapp_verify_token):
        return challenge or "ok"
    raise HTTPException(status_code=403, detail="Verificación de webhook inválida.")


@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    raw = await request.body()
    if settings.whatsapp_app_secret:
        signature = request.headers.get("x-hub-signature-256", "")
        expected = "sha256=" + hmac.new(
            settings.whatsapp_app_secret.encode("utf-8"), raw, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=403, detail="Firma de Meta inválida.")

    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="JSON inválido.") from exc

    business = db.scalar(select(Business).where(Business.slug == settings.whatsapp_business_slug))
    if business is None:
        logger.warning("Webhook sin negocio configurado: %s", settings.whatsapp_business_slug)
        return {"status": "ignored", "reason": "business_not_found"}

    processed = 0
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for message in value.get("messages", []):
                if message.get("type") not in ("text", "button", "interactive"):
                    continue
                text = (
                    message.get("text", {}).get("body")
                    or message.get("button", {}).get("text")
                    or message.get("interactive", {}).get("button_reply", {}).get("title")
                )
                phone = message.get("from")
                if not text or not phone:
                    continue
                try:
                    process_incoming(db, business, phone, str(text))
                    processed += 1
                except Exception:
                    logger.exception("Error procesando mensaje de WhatsApp")
                    db.rollback()
    return {"status": "ok", "processed": processed}
