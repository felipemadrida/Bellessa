"""business locale and brand_color

Revision ID: 2045e907e765
Revises: 51f853cb86e0
Create Date: 2026-11-18 08:39:44.477405

Agrega la configuración de experiencia del salón:
  * `locale`      → idioma de la interfaz (es-MX por defecto)
  * `brand_color` → color de acento del salón (#9C5566 por defecto)

Las columnas son NOT NULL, por lo que se agregan con `server_default` para que
las filas existentes en Neon PostgreSQL queden válidas al aplicar la migración.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2045e907e765'
down_revision = '51f853cb86e0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column("locale", sa.String(length=10), nullable=False, server_default="es-MX"),
    )
    op.add_column(
        "businesses",
        sa.Column("brand_color", sa.String(length=9), nullable=False, server_default="#9C5566"),
    )


def downgrade() -> None:
    op.drop_column("businesses", "brand_color")
    op.drop_column("businesses", "locale")
