"""Rota la contraseña de un superadmin de plataforma.

El seed solo crea la cuenta si no existe, así que cambiar la variable de entorno
no actualiza una contraseña ya guardada. Este script la sobrescribe.

Uso (desde `backend/`):

    python scripts/rotate_platform_admin.py                 # usa el correo configurado
    python scripts/rotate_platform_admin.py otro@correo.mx

La contraseña se pide por consola, nunca por argumento: así no queda en el
historial del shell ni en la lista de procesos.
"""
from __future__ import annotations

import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text  # noqa: E402

from app.config import settings  # noqa: E402
from app.security import hash_password, verify_password  # noqa: E402

MIN_LENGTH = 12


def main() -> int:
    email = sys.argv[1] if len(sys.argv) > 1 else settings.platform_admin_email
    if not email:
        print("No hay correo configurado. Pásalo como argumento.")
        return 2

    password = getpass.getpass(f"Nueva contraseña para {email}: ")
    if len(password) < MIN_LENGTH:
        print(f"Rechazada: usa al menos {MIN_LENGTH} caracteres.")
        return 2
    if password != getpass.getpass("Repite la contraseña: "):
        print("Rechazada: no coinciden.")
        return 2

    engine = create_engine(settings.database_url, pool_pre_ping=True)

    with engine.begin() as conn:
        row = conn.execute(
            text("select id from platform_admins where email = :email"),
            {"email": email},
        ).first()

        if row is None:
            print(f"No existe una cuenta de plataforma con el correo {email}.")
            return 3

        admin_id = row[0]
        conn.execute(
            text("update platform_admins set password_hash = :hash where id = :id"),
            {"hash": hash_password(password), "id": admin_id},
        )
        stored = conn.execute(
            text("select password_hash from platform_admins where id = :id"),
            {"id": admin_id},
        ).scalar_one()

    if not verify_password(password, stored):
        print("Algo salió mal: la contraseña guardada no verifica.")
        return 4

    print(f"Listo. Contraseña actualizada para {email}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
