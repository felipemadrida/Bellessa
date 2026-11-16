from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_business, require_owner
from ..models import AuditLog, Business, User
from ..schemas import AuditOut

router = APIRouter(prefix="/audit", tags=["auditoría"])


@router.get("", response_model=list[AuditOut])
def list_audit(
    limit: int = Query(default=40, ge=1, le=200),
    business: Business = Depends(get_current_business),
    _: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> list[AuditOut]:
    logs = list(
        db.scalars(
            select(AuditLog)
            .where(AuditLog.business_id == business.id)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(limit)
        ).all()
    )
    return [
        AuditOut(
            id=entry.id,
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            detail=entry.detail,
            user_name=entry.user.name if entry.user else None,
            created_at=entry.created_at,
        )
        for entry in logs
    ]
