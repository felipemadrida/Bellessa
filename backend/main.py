"""Entrypoint para Vercel (framework preset FastAPI) y otros PaaS.

El proyecto local y Docker siguen usando `app.main:app`.
"""

from app.main import app

__all__ = ["app"]
