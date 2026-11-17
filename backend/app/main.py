from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .routers import (
    appointments,
    audit,
    auth,
    catalog,
    clients,
    internal,
    inventory,
    marketing,
    money,
    platform,
    public,
    whatsapp,
)
from .seed import seed_demo, seed_platform
from .services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if settings.seed_demo:
            seed_demo(db)
        seed_platform(db)
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Agenda y seguimiento para salones de belleza en México. MXN, es-MX, WhatsApp.",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(catalog.router)
api.include_router(inventory.router)
api.include_router(clients.router)
api.include_router(appointments.router)
api.include_router(money.router)
api.include_router(public.router)
api.include_router(audit.router)
api.include_router(whatsapp.router)
api.include_router(marketing.router)
api.include_router(internal.router)
api.include_router(platform.router)


@api.get("/health", tags=["sistema"])
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - depende del motor real
        raise HTTPException(status_code=503, detail="Base de datos no disponible.") from exc
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "database": "ok",
        "whatsapp": settings.whatsapp_provider,
        "scheduler": settings.scheduler_enabled,
        "time": datetime.now(timezone.utc).isoformat(),
    }


@api.get("/", tags=["sistema"])
def api_info() -> dict:
    return {
        "name": settings.app_name,
        "docs": "/api/docs",
        "currency": settings.currency,
        "timezone": settings.default_timezone,
    }


app.include_router(api)
