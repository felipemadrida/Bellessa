from __future__ import annotations

from sqlalchemy.orm import Session

from .models import AuditLog


def record_audit(
    db: Session,
    *,
    business_id: int,
    user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    detail: str | None = None,
) -> AuditLog:
    """Agrega una entrada a la bitácora; el commit lo hace el flujo que llama."""
    entry = AuditLog(
        business_id=business_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail[:500] if detail else None,
    )
    db.add(entry)
    return entry
