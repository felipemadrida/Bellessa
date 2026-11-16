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
from ..models import Business, Client, MessageLog
from ..schemas import MessageLogOut, WhatsAppMockIn, WhatsAppMockOut, WhatsAppStatusOut
from ..services.whatsapp import process_incoming
from ..utils import normalize_phone_mx

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
