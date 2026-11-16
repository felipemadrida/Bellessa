from __future__ import annotations

import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
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
    PlatformTenantCreatedOut,
    PlatformTenantCreate,
    PlatformTenantOut,
    PlatformTenantUpdate,
)
from ..security import create_platform_access_token, hash_password, verify_password
from ..seed import provision_business
from ..services.plans import PLANS, VALID_PLANS, VALID_STATUSES, ensure_tenant_account, plan_limits
from ..utils import normalize_phone_mx, slugify, utcnow_naive

router = APIRouter(prefix="/platform", tags=["plataforma SaaS"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"


def _clean_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="El correo no es válido.")
    return email


def _new_password(length: int = 12) -> str:
    return "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(length))


def _slug_available(db: Session, slug: str, exclude_id: int | None = None) -> bool:
    query = select(Business.id).where(Business.slug == slug)
    if exclude_id is not None:
        query = query.where(Business.id != exclude_id)
    return db.scalar(query) is None


def _create_slug(db: Session, requested: str | None, name: str) -> str:
    if requested and requested.strip():
        slug = slugify(requested)
        if not _slug_available(db, slug):
            raise HTTPException(status_code=409, detail="Ese slug ya está en uso.")
        return slug
    base = slugify(name)
    slug = base
    suffix = 2
    while not _slug_available(db, slug):
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


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
        phone=business.phone,
        city=business.city,
        plan=account.plan,
        status=account.status,
        trial_ends_at=account.trial_ends_at,
        notes=account.notes,
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
    archived = sum(1 for account in accounts if account.status == "archived")
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
        archived_tenants=archived,
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
    include_archived: bool = Query(default=False),
    _: PlatformAdmin = Depends(get_platform_admin),
    db: Session = Depends(get_db),
) -> list[PlatformTenantOut]:
    businesses = list(db.scalars(select(Business).order_by(Business.created_at.desc())).all())
    result = []
    for business in businesses:
        account = ensure_tenant_account(db, business)
        if account.status == "archived" and not include_archived:
            continue
        result.append(_tenant_payload(db, business, account))
    db.commit()
    return result


@router.get("/tenants/{business_id}", response_model=PlatformTenantOut)
def platform_tenant(
    business_id: int,
    _: PlatformAdmin = Depends(get_platform_admin),
    db: Session = Depends(get_db),
) -> PlatformTenantOut:
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Salón no encontrado.")
    account = ensure_tenant_account(db, business)
    db.commit()
    return _tenant_payload(db, business, account)


@router.post("/tenants", response_model=PlatformTenantCreatedOut, status_code=201)
def create_tenant(
    payload: PlatformTenantCreate,
    admin: PlatformAdmin = Depends(get_platform_admin),
    db: Session = Depends(get_db),
) -> PlatformTenantCreatedOut:
    if payload.plan not in VALID_PLANS:
        raise HTTPException(status_code=422, detail="Plan inválido.")
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Estado inválido.")

    name = payload.name.strip()
    owner_name = payload.owner_name.strip()
    if not name or not owner_name:
        raise HTTPException(status_code=422, detail="El salón y la dueña necesitan nombre.")
    owner_email = _clean_email(payload.owner_email)
    if db.scalar(select(User.id).where(User.email == owner_email)):
        raise HTTPException(status_code=409, detail="Ese correo ya pertenece a otra cuenta.")

    slug = _create_slug(db, payload.slug, name)
    generated_password = None if payload.owner_password else _new_password()
    password = payload.owner_password or generated_password or _new_password()
    phone = normalize_phone_mx(payload.phone) if payload.phone else None

    business = Business(
        name=name,
        slug=slug,
        legal_name=owner_name,
        phone=phone,
        whatsapp=phone,
        email=owner_email,
        city=(payload.city or "Ciudad de México").strip(),
        state=(payload.state or "CDMX").strip(),
        timezone="America/Mexico_City",
        currency="MXN",
        require_deposit=False,
        deposit_percent=0,
        monthly_goal_cents=0,
    )
    owner = User(
        name=owner_name,
        email=owner_email,
        password_hash=hash_password(password),
        phone=phone,
        role=UserRole.owner,
        color="#C2415A",
        bio="Cuenta creada desde la plataforma Bellessa.",
    )
    try:
        db.add(business)
        db.flush()
        owner.business_id = business.id
        db.add(owner)
        db.flush()
        provision_business(db, business, owner)
        account = TenantAccount(
            business_id=business.id,
            plan=payload.plan,
            status=payload.status,
            trial_ends_at=(
                utcnow_naive() + timedelta(days=14) if payload.status == "trial" else None
            ),
            notes=payload.notes.strip() if payload.notes else None,
        )
        db.add(account)
        record_audit(
            db,
            business_id=business.id,
            user_id=None,
            action="plataforma.tenant_creado",
            entity_type="tenant",
            entity_id=business.id,
            detail=f"{admin.email}: {name} ({payload.plan})",
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se pudo crear el salón: el slug o el correo ya existen.",
        ) from exc

    db.refresh(business)
    db.refresh(account)
    return PlatformTenantCreatedOut(
        **_tenant_payload(db, business, account).model_dump(),
        generated_password=generated_password,
    )


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
    if payload.name is not None:
        name = payload.name.strip()
        if name and name != business.name:
            business.name = name
            changes.append(f"nombre={name}")
    if payload.slug is not None:
        slug = slugify(payload.slug)
        if not _slug_available(db, slug, exclude_id=business.id):
            raise HTTPException(status_code=409, detail="Ese slug ya está en uso.")
        if slug != business.slug:
            business.slug = slug
            changes.append(f"slug={slug}")
    if payload.phone is not None:
        phone = normalize_phone_mx(payload.phone) if payload.phone.strip() else None
        business.phone = phone
        business.whatsapp = phone
        changes.append("teléfono")
    if payload.city is not None and payload.city.strip():
        business.city = payload.city.strip()
        changes.append("ciudad")

    owner = db.scalar(
        select(User)
        .where(User.business_id == business.id, User.role == UserRole.owner)
        .order_by(User.id)
        .limit(1)
    )
    if payload.owner_name is not None or payload.owner_email is not None or payload.owner_password:
        if owner is None:
            raise HTTPException(status_code=409, detail="El salón no tiene una dueña para editar.")
        if payload.owner_name is not None and payload.owner_name.strip():
            owner.name = payload.owner_name.strip()
            changes.append("dueña")
        if payload.owner_email is not None:
            email = _clean_email(payload.owner_email)
            if db.scalar(select(User.id).where(User.email == email, User.id != owner.id)):
                raise HTTPException(status_code=409, detail="Ese correo ya pertenece a otra cuenta.")
            owner.email = email
            business.email = email
            changes.append("correo")
        if payload.owner_password:
            owner.password_hash = hash_password(payload.owner_password)
            changes.append("contraseña")

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
        changes.append("notas")

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


@router.delete("/tenants/{business_id}", status_code=204)
def archive_tenant(
    business_id: int,
    admin: PlatformAdmin = Depends(get_platform_admin),
    db: Session = Depends(get_db),
) -> Response:
    business = db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Salón no encontrado.")
    account = ensure_tenant_account(db, business)
    if account.status != "archived":
        account.status = "archived"
        record_audit(
            db,
            business_id=business.id,
            user_id=None,
            action="plataforma.tenant_archivado",
            entity_type="tenant",
            entity_id=business.id,
            detail=f"{admin.email}: {business.name}",
        )
        db.commit()
    return Response(status_code=204)


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
