from __future__ import annotations

import re
import secrets
import unicodedata
from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import quote
from zoneinfo import ZoneInfo

WEEKDAYS_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MONTHS_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
STATUS_LABELS_ES = {
    "pending": "Por confirmar",
    "confirmed": "Confirmada",
    "completed": "Completada",
    "canceled": "Cancelada",
    "no_show": "No asistió",
}


def utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def tz_for(name: str) -> ZoneInfo:
    return ZoneInfo(name or "America/Mexico_City")


def to_local(value: datetime, tz_name: str) -> datetime:
    return ensure_utc(value).astimezone(tz_for(tz_name))


def local_day_bounds(day: date, tz_name: str) -> tuple[datetime, datetime]:
    """Devuelve el rango UTC (naive) que cubre un día local completo."""
    tz = tz_for(tz_name)
    start_local = datetime.combine(day, time(0, 0), tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return to_naive_utc(start_local), to_naive_utc(end_local)


def local_to_utc_naive(day: date, minute: int, tz_name: str) -> datetime:
    tz = tz_for(tz_name)
    return to_naive_utc(datetime.combine(day, time(0, 0), tzinfo=tz) + timedelta(minutes=minute))


def datetime_local_iso(value: datetime, tz_name: str) -> str:
    return to_local(value, tz_name).isoformat()


def format_datetime_es(value: datetime, tz_name: str) -> str:
    local = to_local(value, tz_name)
    hour = local.hour % 12 or 12
    suffix = "a. m." if local.hour < 12 else "p. m."
    return (
        f"{WEEKDAYS_ES[local.weekday()]} {local.day} de {MONTHS_ES[local.month - 1]}, "
        f"{hour}:{local.minute:02d} {suffix}"
    )


def format_date_es(day: date) -> str:
    return f"{WEEKDAYS_ES[day.weekday()]} {day.day} de {MONTHS_ES[day.month - 1]}"


def money_mx(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    cents = abs(int(cents))
    whole, fraction = divmod(cents, 100)
    whole_str = f"{whole:,}".replace(",", ",")
    return f"{sign}${whole_str}.{fraction:02d}"


def iva_breakdown(total_cents: int, tax_rate_bps: int = 1600) -> tuple[int, int]:
    """Los precios de belleza en México se muestran con IVA incluido.

    Regresa (subtotal, iva) en centavos, redondeando al centavo.
    """
    if tax_rate_bps <= 0:
        return total_cents, 0
    subtotal = round(total_cents * 10000 / (10000 + tax_rate_bps))
    return subtotal, total_cents - subtotal


def commission_cents(amount_cents: int, commission_bps: int) -> int:
    return round(amount_cents * commission_bps / 10000)


def normalize_phone_mx(phone: str | None) -> str:
    """Normaliza a 10 dígitos nacionales (México)."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 13 and digits.startswith("521"):
        return digits[3:]
    if len(digits) == 12 and digits.startswith("52"):
        return digits[2:]
    if len(digits) > 10:
        return digits[-10:]
    return digits


def whatsapp_number_mx(phone: str | None) -> str:
    national = normalize_phone_mx(phone)
    return f"52{national}" if len(national) == 10 else national


def whatsapp_link(phone: str | None, text: str) -> str:
    return f"https://wa.me/{whatsapp_number_mx(phone)}?text={quote(text)}"


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug[:60] or "salon"


def new_confirmation_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def status_label(status: str) -> str:
    return STATUS_LABELS_ES.get(status, status)
