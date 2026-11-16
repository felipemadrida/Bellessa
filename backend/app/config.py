from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración por variables de entorno (prefijo BELLESSA_)."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", env_prefix="BELLESSA_", extra="ignore"
    )

    app_name: str = "Bellessa API"
    environment: str = "development"
    database_url: str = "sqlite:///./bellessa.db"
    jwt_secret: str = "cambia-este-secreto-en-produccion"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24 * 7  # 7 días: apps móviles
    seed_demo: bool = True
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cors_origin_regex: str = ""
    public_base_url: str = "http://localhost:5173"
    api_public_base_url: str = ""  # URL pública de la API (Vercel/Render)
    cron_secret: str = ""  # obligatorio para /api/internal/tick en la nube
    platform_admin_name: str = "Felipe Madrid"
    platform_admin_email: str = "admin@bellessa.mx"
    platform_admin_password: str = ""  # en producción, define uno seguro
    default_timezone: str = "America/Mexico_City"
    currency: str = "MXN"

    # WhatsApp Cloud API / simulador local
    whatsapp_provider: str = "mock"  # mock | cloud
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = "bellessa-verify"
    whatsapp_app_secret: str = ""
    whatsapp_business_slug: str = "salon-lucia"
    whatsapp_cloud_version: str = "v20.0"

    # Recordatorios y marketing programado (hilo interno, sin costo)
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 300

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def api_base_url(self) -> str:
        return (self.api_public_base_url or self.public_base_url).rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
