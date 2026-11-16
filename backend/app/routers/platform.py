from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..database import get_db
from ..deps import get_platform_admin
from ..models import (
    Appointment,
    Business,
    Client,
    Payment,
    PlatformAdmin,
    TenantAccount,
    User,
    UserRole,
)
from ..schemas import (
    PlatformAdminOut,
    PlatformLoginIn,
    PlatformLoginOut,
    PlatformOverviewOut,
    PlatformTenantOut,
    PlatformTenantUpdate,
)
from ..security import create_platform_access_token, verify_password
from ..services.plans import PLANS, VALID_PLANS, VALID_STATUSES, ensure_tenant_account, plan_limits
from ..utils import utcnow_naive

router = APIRouter(prefix="/platform", tags=["plataforma SaaS"])


def _tenant_payload(db: Session, business: Business, account: TenantAccount) -> PlatformTenantOut:
    owner = db.scalar(
        select(User)
        .where(User.business_id == business.id, User.role == UserRole.owner)
        .order_by(User.id)
        .limit(1)
    )
    since = utcnow_naive() - timedelta(days=30)
    clients_count = int(
        db.scalar(select(func.count(Client.id)).where(Client.business_id == business.id)) or 0
    )
    staff_count = int(
        db.scalar(
            select(func.count(User.id)).where(
                User.business_id == business.id, User.active.is_(True)
            )
        )
        or 0
    )
    appointments_count = int(
        db.scalar(
            select(func.count(Appointment.id)).where(
                Appointment.business_id == business.id,
                Appointment.start_at >= since,
            )
        )
        or 0
    )
    revenue = int(
        db.scalar(
            select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
                Payment.business_id == business.id, Payment.created_at >= since
            )
        )
        or 0
    )
    return PlatformTenantOut(
        business_id=business.id,
        name=business.name,
        slug=business.slug,
        owner_name=owner.name if owner else None,
        owner_email=owner.email if owner else None,
        plan=account.plan,
        status=account.status,
        trial_ends_at=account.trial_ends_at,
        clients_count=clients_count,
        staff_count=staff_count,
        appointments_30d=appointments_count,
        revenue_30d_cents=revenue,
        created_at=business.created_at,
    )


@router.post("/login", response_model=PlatformLoginOut)
def platform_login(payload: PlatformLoginIn, db: Session = Depends(get_db)) -> PlatformLoginOut:
    admin = db.scalar(
        select(PlatformAdmin).where(PlatformAdmin.email == payload.email.strip().lower())
    )
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales de plataforma incorrectas.")
    if not admin.active:
        raise HTTPException(status_code=403, detail="Administrador desactivado.")
    return PlatformLoginOut(
        access_token=create_platform_access_token(admin),
        admin=PlatformAdminOut.model_validate(admin),
    )


@router.get("/me", response_model=PlatformAdminOut)
def platform_me(admin: PlatformAdmin = Depends(get_platform_admin)) -> PlatformAdmin:
    return admin


@router.get("/overview", response_model=PlatformOverviewOut)
def platform_overview(
    _: PlatformAdmin = Depends(get_platform_admin),
    db: Session = Depends(get_db),
) -> PlatformOverviewOut:
    businesses = list(db.scalars(select(Business)).all())
    accounts = [ensure_tenant_account(db, business) for business in businesses]
    db.commit()

    since = utcnow_naive() - timedelta(days=30)
    plan_counts = {plan: 0 for plan in PLANS}
    for account in accounts:
        plan_counts[account.plan] = plan_counts.get(account.plan, 0) + 1
    active = sum(1 for account in accounts if account.status == "active")
    trial = sum(1 for account in accounts if account.status == "trial")
    suspended = sum(1 for account in accounts if account.status == "suspended")
    revenue = int(
        db.scalar(
            select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
                Payment.created_at >= since
            )
        )
        or 0
    )
    appointments = int(
        db.scalar(
            select(func.count(Appointment.id)).where(Appointment.start_at >= since)
        )
        or 0
    )
    clients = int(db.scalar(select(func.count(Client.id))) or 0)
    staff = int(db.scalar(select(func.count(User.id)).where(User.active.is_(True))) or 0)
    mrr = sum(
        PLANS.get(account.plan, PLANS["free"])["price_mxn"] * 100
        for account in accounts
        if account.status == "active"
    )
    return PlatformOverviewOut(
        total_tenants=len(businesses),
        active_tenants=active,
        trial_tenants=trial,
        suspended_tenants=suspended,
        total_clients=clients,
        total_staff=staff,
        appointments_30d=appointments,
        revenue_30d_cents=revenue,
        mrr_cents=mrr,
        plan_counts=plan_counts,
        plans=[
            {
                "key": key,
                "label": value["label"],
                "price_mxn": value["price_mxn"],
                "max_staff": value["max_staff"],
                "max_appointments_month": value["max_appointments_month"],
                "marketing_automation": value["marketing_automation"],
            }
            for key, value in PLANS.items()
        ],
    )


@router.get("/tenants", response_model=list[PlatformTenantOut])
def platform_tenants(
    _: PlatformAdmin = Depends(get_platform_admin),
    db: Session = Depends(get_db),
) -> list[PlatformTenantOut]:
    businesses = list(db.scalars(select(Business).order_by(Business.created_at.desc())).all())
    result = []
    for business in businesses:
        account = ensure_tenant_account(db, business)
        result.append(_tenant_payload(db, business, account))
    db.commit()
    return result


@router.patch("/tenants/{business_id}", response_model=PlatformTenantOut)
def update_tenant(
    business_id: int,
    payload: PlatformTenantUpdate,
    admin: PlatformAdmin = Depends(get_platform_admin),
    db: Session = Depends(get_db),
) -> PlatformTenantOut:
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Salón no encontrado.")
    if payload.plan is not None and payload.plan not in VALID_PLANS:
        raise HTTPException(status_code=422, detail="Plan inválido.")
    if payload.status is not None and payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Estado inválido.")

    account = ensure_tenant_account(db, business)
    changes = []
    if payload.plan is not None and payload.plan != account.plan:
        account.plan = payload.plan
        changes.append(f"plan={payload.plan}")
    if payload.status is not None and payload.status != account.status:
        account.status = payload.status
        if payload.status == "trial" and account.trial_ends_at is None:
            account.trial_ends_at = utcnow_naive() + timedelta(days=14)
        if payload.status == "active":
            account.trial_ends_at = None
        changes.append(f"estado={payload.status}")
    if payload.notes is not None:
        account.notes = payload.notes.strip() or None
    record_audit(
        db,
        business_id=business.id,
        user_id=None,
        action="plataforma.tenant_actualizado",
        entity_type="tenant",
        entity_id=business.id,
        detail=f"{admin.email}: {', '.join(changes) or 'sin cambios'}",
    )
    db.commit()
    db.refresh(account)
    return _tenant_payload(db, business, account)


@router.get("/plans")
def platform_plans(_: PlatformAdmin = Depends(get_platform_admin)) -> list[dict]:
    return [
        {
            "key": key,
            "label": plan_limits(key)["label"],
            "price_mxn": plan_limits(key)["price_mxn"],
            "max_staff": plan_limits(key)["max_staff"],
            "max_appointments_month": plan_limits(key)["max_appointments_month"],
            "marketing_automation": plan_limits(key)["marketing_automation"],
        }
        for key in PLANS
    ]
