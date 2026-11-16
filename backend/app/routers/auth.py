from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..database import get_db
from ..deps import get_current_user
from ..models import Business, User, UserRole
from ..schemas import LoginIn, MeOut, RegisterIn, StaffOut, TokenOut, UserUpdate
from ..security import create_access_token, hash_password, verify_password
from ..seed import provision_business
from ..services.plans import ensure_tenant_account
from ..utils import normalize_phone_mx, slugify

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: User, business: Business) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user),
        user=StaffOut.model_validate(user),
        business=business,
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> TokenOut:
    email = payload.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Ese correo ya tiene una cuenta.")

    base_slug = slugify(payload.slug or payload.business_name)
    slug = base_slug
    suffix = 2
    while db.scalar(select(Business.id).where(Business.slug == slug)):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    business = Business(
        name=payload.business_name.strip(),
        slug=slug,
        phone=payload.phone,
        whatsapp=payload.phone,
        email=email,
        city=payload.city or "Ciudad de México",
        state="CDMX" if (payload.city or "").lower().startswith(("cdmx", "ciudad de méxico")) else None,
        timezone="America/Mexico_City",
        currency="MXN",
    )
    db.add(business)
    db.flush()

    owner = User(
        business_id=business.id,
        name=payload.owner_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        phone=normalize_phone_mx(payload.phone) if payload.phone else None,
        role=UserRole.owner,
        color="#C2415A",
    )
    db.add(owner)
    db.flush()
    provision_business(db, business, owner)
    ensure_tenant_account(db, business, plan="free", status="trial")
    record_audit(
        db,
        business_id=business.id,
        user_id=owner.id,
        action="negocio.registrado",
        entity_type="business",
        entity_id=business.id,
        detail=business.name,
    )
    db.commit()
    db.refresh(business)
    db.refresh(owner)
    return _token_response(owner, business)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos.",
        )
    if not user.active:
        raise HTTPException(status_code=403, detail="Tu cuenta está desactivada.")
    business = db.get(Business, user.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Negocio no encontrado.")
    record_audit(
        db,
        business_id=business.id,
        user_id=user.id,
        action="sesion.iniciada",
        entity_type="user",
        entity_id=user.id,
        detail=user.name,
    )
    db.commit()
    return _token_response(user, business)


@router.get("/me", response_model=MeOut)
def me(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> MeOut:
    business = db.get(Business, user.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Negocio no encontrado.")
    return MeOut(user=user, business=business)


@router.patch("/me", response_model=MeOut)
def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeOut:
    data = payload.model_dump(exclude_unset=True)
    if "phone" in data and data["phone"]:
        data["phone"] = normalize_phone_mx(data["phone"])
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    business = db.get(Business, user.business_id)
    return MeOut(user=user, business=business)
