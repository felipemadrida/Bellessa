from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import Business, PlatformAdmin, TenantAccount, User, UserRole
from .security import decode_access_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Necesitas iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    if payload.get("scope", "tenant") != "tenant":
        raise HTTPException(status_code=401, detail="Este token no es de un salón.")
    try:
        user_id = int(payload.get("sub", "0"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Token inválido.") from exc

    user = db.get(User, user_id)
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="Usuario no disponible.")
    if user.business_id != payload.get("bid"):
        raise HTTPException(status_code=401, detail="Token de otro negocio.")
    return user


def get_current_business(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Business:
    business = db.get(Business, user.business_id)
    if business is None:
        raise HTTPException(status_code=404, detail="Negocio no encontrado.")
    account = db.scalar(
        select(TenantAccount).where(TenantAccount.business_id == business.id)
    )
    if account is not None and account.status in {"suspended", "archived"}:
        detail = (
            "El salón está archivado. Contacta al administrador de Bellessa."
            if account.status == "archived"
            else "El acceso del salón está suspendido. Contacta al administrador de Bellessa."
        )
        raise HTTPException(status_code=403, detail=detail)
    return business


def get_platform_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> PlatformAdmin:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Inicia sesión como administrador.")
    payload = decode_access_token(credentials.credentials)
    if payload.get("scope") != "platform":
        raise HTTPException(status_code=403, detail="Se requiere acceso de plataforma.")
    try:
        admin_id = int(payload.get("sub", "0"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Token inválido.") from exc
    admin = db.get(PlatformAdmin, admin_id)
    if admin is None or not admin.active:
        raise HTTPException(status_code=401, detail="Administrador no disponible.")
    return admin


def require_owner(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo la persona dueña del salón puede hacer esto.",
        )
    return user
