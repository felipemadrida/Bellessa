from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..database import get_db
from ..deps import get_current_business, get_current_user, require_owner
from ..models import Business, User
from ..schemas import (
    MarketingCampaignIn,
    MarketingCampaignOut,
    MarketingSegmentOut,
    MarketingTemplateOut,
)
from ..services.marketing import (
    TEMPLATES,
    month_calendar,
    queue_campaign,
    segment_summary,
    template_catalog,
)

router = APIRouter(prefix="/marketing", tags=["Marketing"])


@router.get("/templates", response_model=list[MarketingTemplateOut])
def list_templates(
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
) -> list[dict]:
    return template_catalog()


@router.get("/segments", response_model=list[MarketingSegmentOut])
def list_segments(
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return segment_summary(db, business)


@router.get("/calendar")
def marketing_calendar(
    business: Business = Depends(get_current_business),
    _: User = Depends(get_current_user),
) -> list[dict]:
    return month_calendar(business.created_at.date())


@router.post("/campaigns", response_model=MarketingCampaignOut)
def create_campaign(
    payload: MarketingCampaignIn,
    business: Business = Depends(get_current_business),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> MarketingCampaignOut:
    if payload.template_key not in TEMPLATES:
        raise HTTPException(status_code=422, detail="Plantilla desconocida.")
    try:
        result = queue_campaign(
            db, business, payload.template_key, payload.segment, user_id=user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    record_audit(
        db,
        business_id=business.id,
        user_id=user.id,
        action="marketing.campana",
        entity_type="campaign",
        detail=f"{payload.template_key} · {payload.segment} · {result['queued']} mensajes",
    )
    db.commit()
    return MarketingCampaignOut(
        template_key=payload.template_key,
        segment=payload.segment,
        queued=result["queued"],
        skipped=result["skipped"],
    )
