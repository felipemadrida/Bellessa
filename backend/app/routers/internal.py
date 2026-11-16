from __future__ import annotations

import hmac
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..config import settings
from ..database import Base, get_db
from ..seed import seed_demo
from ..services.marketing import enqueue_scheduled_messages

router = APIRouter(prefix="/internal", tags=["interno"])


def _secret() -> str:
    # Vercel Cron usa CRON_SECRET; la app también acepta el prefijo BELLESSA_.
    return settings.cron_secret or os.getenv("CRON_SECRET", "")


def _authorized(request: Request) -> None:
    secret = _secret()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Configura CRON_SECRET o BELLESSA_CRON_SECRET para habilitar tareas internas.",
        )
    authorization = request.headers.get("authorization", "")
    token = authorization[7:] if authorization.lower().startswith("bearer ") else ""
    provided = token or request.headers.get("x-cron-secret", "")
    if not provided or not hmac.compare_digest(provided, secret):
        raise HTTPException(status_code=401, detail="Secreto de cron inválido.")


@router.get("/tick")
@router.post("/tick")
def tick(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Ejecuta recordatorios y marketing. Vercel Cron o cron-job.org lo llaman."""
    _authorized(request)
    stats = enqueue_scheduled_messages(db)
    return {"ok": True, "stats": stats}


@router.post("/bootstrap")
def bootstrap(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Crea tablas y, si SEED_DEMO=true, siembra el salón demo.

    Útil la primera vez en Neon/Vercel, donde no hay un proceso persistente.
    """
    _authorized(request)
    Base.metadata.create_all(bind=db.get_bind())
    seeded = seed_demo(db) if settings.seed_demo else False
    return {"ok": True, "seeded": seeded}
