from __future__ import annotations

import logging
import os
import threading

from ..config import settings
from ..database import SessionLocal
from .marketing import enqueue_scheduled_messages

logger = logging.getLogger("bellessa.scheduler")

_thread: threading.Thread | None = None
_stop = threading.Event()


def _run_once() -> None:
    with SessionLocal() as db:
        stats = enqueue_scheduled_messages(db)
        if stats:
            logger.info("Mensajes programados: %s", stats)


def _loop() -> None:
    # Primera pasada al arrancar; después cada intervalo configurado.
    while not _stop.is_set():
        try:
            _run_once()
        except Exception:
            logger.exception("Falló el ciclo de recordatorios/marketing")
        _stop.wait(max(30, settings.scheduler_interval_seconds))


def start_scheduler() -> None:
    global _thread
    # En Vercel no hay proceso persistente; el cron externo llama a /internal/tick.
    if os.getenv("VERCEL") or not settings.scheduler_enabled or _thread is not None:
        if os.getenv("VERCEL"):
            logger.info("Scheduler omitido en Vercel; usa /api/internal/tick.")
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="bellessa-scheduler", daemon=True)
    _thread.start()
    logger.info(
        "Scheduler iniciado cada %ss (proveedor WhatsApp: %s)",
        settings.scheduler_interval_seconds,
        settings.whatsapp_provider,
    )


def stop_scheduler() -> None:
    global _thread
    _stop.set()
    if _thread is not None:
        _thread.join(timeout=5)
        _thread = None
