from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Business, TenantAccount
from ..utils import utcnow_naive

PLANS: dict[str, dict] = {
    "free": {
        "label": "Free",
        "price_mxn": 0,
        "max_staff": 1,
        "max_appointments_month": 50,
        "marketing_automation": False,
    },
    "pro": {
        "label": "Pro",
        "price_mxn": 299,
        "max_staff": 3,
        "max_appointments_month": 300,
        "marketing_automation": True,
    },
    "salon": {
        "label": "Salón",
        "price_mxn": 599,
        "max_staff": 10,
        "max_appointments_month": 2000,
        "marketing_automation": True,
    },
}
VALID_PLANS = set(PLANS)
VALID_STATUSES = {"trial", "active", "suspended", "archived"}


def ensure_tenant_account(
    db: Session,
    business: Business,
    *,
    plan: str | None = None,
    status: str | None = None,
    commit: bool = False,
) -> TenantAccount:
    account = db.scalar(
        select(TenantAccount).where(TenantAccount.business_id == business.id)
    )
    if account is None:
        chosen_plan = plan if plan in PLANS else ("salon" if business.slug == "salon-lucia" else "free")
        chosen_status = status if status in VALID_STATUSES else ("active" if chosen_plan != "free" else "trial")
        account = TenantAccount(
            business_id=business.id,
            plan=chosen_plan,
            status=chosen_status,
            trial_ends_at=(
                utcnow_naive() + timedelta(days=14)
                if chosen_status == "trial"
                else None
            ),
        )
        db.add(account)
        db.flush()
        if commit:
            db.commit()
    return account


def plan_limits(plan: str) -> dict:
    return PLANS.get(plan, PLANS["free"])
