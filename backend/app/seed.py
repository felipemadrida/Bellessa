from __future__ import annotations

from datetime import datetime, time, timedelta

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .models import (
    Appointment,
    AppointmentStatus,
    Business,
    BusinessHour,
    Client,
    Expense,
    Payment,
    PaymentMethod,
    PlatformAdmin,
    Service,
    User,
    UserRole,
    WorkingHour,
)
from .security import hash_password
from .services.plans import ensure_tenant_account
from .utils import local_to_utc_naive, new_confirmation_code, normalize_phone_mx, tz_for

logger = logging.getLogger("bellessa.seed")

DEMO_SLUG = "salon-lucia"
DEMO_EMAIL = "demo@bellessa.mx"
DEMO_PASSWORD = "demo1234"
PLATFORM_EMAIL = "admin@bellessa.mx"
PLATFORM_PASSWORD = "admin1234"

BUSINESS_HOURS = [
    (0, False, 540, 1140),
    (1, False, 540, 1140),
    (2, False, 540, 1140),
    (3, False, 540, 1140),
    (4, False, 540, 1140),
    (5, False, 540, 1080),
    (6, True, 540, 1080),
]

STAFF_HOURS = {
    "Lucía Herrera": [(1, False, 600, 1140), (2, False, 600, 1140), (3, False, 600, 1140), (4, False, 600, 1140), (5, False, 600, 1140)],
    "Ximena Ríos": [(0, False, 540, 1140), (1, False, 540, 1140), (2, False, 540, 1140), (3, False, 540, 1140), (4, False, 540, 1140), (5, False, 540, 1080)],
    "Regina Solís": [(0, False, 600, 1140), (1, False, 600, 1140), (2, False, 600, 1140), (3, False, 600, 1140), (4, False, 600, 1140), (5, False, 600, 1080)],
}

DEMO_SERVICES = [
    ("Corte de dama", "Corte, lavado y secado con asesoría de estilo.", "Cabello", 45, 10, 38000, 0, "#C2415A"),
    ("Corte de caballero", "Corte clásico o fade con perfilado de barba.", "Cabello", 30, 10, 26000, 0, "#B56576"),
    ("Tinte global", "Coloración completa con tinte profesional y tratamiento.", "Color", 120, 15, 145000, 30000, "#7A4E3B"),
    ("Balayage", "Iluminación a mano alzada, incluye matiz y tratamiento.", "Color", 180, 20, 320000, 80000, "#D9A441"),
    ("Manicure gel", "Uñas de gel con diseño minimalista incluido.", "Uñas", 60, 10, 45000, 0, "#A65A78"),
    ("Pedicure spa", "Exfoliación, masaje y esmaltado en gel.", "Uñas", 60, 10, 55000, 0, "#6A8D73"),
    ("Peinado express", "Ondas, planchado o recogido para evento.", "Peinado", 45, 10, 42000, 0, "#D97757"),
    ("Maquillaje social", "Maquillaje de larga duración para evento o sesión.", "Makeup", 60, 10, 95000, 20000, "#8E5572"),
    ("Facial hidratante", "Limpieza profunda, mascarilla y masaje facial.", "Facial", 75, 10, 85000, 0, "#5C8374"),
    ("Paquete novia", "Prueba, peinado y maquillaje el día del evento.", "Novias", 240, 30, 480000, 150000, "#9C6644"),
]

DEMO_CLIENTS = [
    ("Fernanda Castillo", "55 1234 5678", "1994-03-14", "VIP,Color", "Alergia al amoniaco. Prefiere tonos fríos y café."),
    ("Mariana López", "55 8765 4321", "1990-07-22", "Balayage", "Le encanta el café con leche. Siempre pide cita con Ximena."),
    ("Sofía Ramírez", "56 1122 3344", "1998-11-02", "Uñas,Recurrente", "Diseños minimalistas, tonos nude. Paga con transferencia."),
    ("Valeria Mendoza", "55 4455 6677", "1987-01-19", "VIP,Novias", "Se casa en mayo. Paquete de novia contratado."),
    ("Andrea Torres", "55 9988 7766", "1996-09-08", "Color", "Cabello con decoloración previa. Usar protector térmico."),
    ("Regina Flores", "56 2233 4455", "2001-05-27", "Uñas", "Estudiante, prefiere citas después de las 5 pm."),
    ("Daniela Cruz", "55 3344 5566", "1992-12-11", "Recurrente", "Sensible al perfume. Productos sin fragancia."),
    ("Paulina Vargas", "55 7788 9900", "1985-08-30", "VIP,Color", "Mamá de dos. Agendar con confirmación por WhatsApp."),
    ("Ximena Morales", "56 6677 8899", "1999-04-17", "Peinado", "Va a eventos corporativos cada mes."),
    ("Renata Jiménez", "55 2211 3344", "1993-10-05", "Facial", "Piel mixta sensible. Evitar ácidos fuertes."),
    ("Camila Ortega", "55 5566 7788", "1997-02-23", "Uñas,Color", "Le gusta el ambiente tranquilo. Citas temprano."),
    ("Isabela Navarro", "56 8899 0011", "1989-06-09", "Novias,Makeup", "Maquillaje para boda civil en diciembre."),
]


def _add_business_hours(db: Session, business: Business) -> None:
    for weekday, closed, open_minute, close_minute in BUSINESS_HOURS:
        db.add(
            BusinessHour(
                business_id=business.id,
                weekday=weekday,
                closed=closed,
                open_minute=open_minute,
                close_minute=close_minute,
            )
        )


def _add_working_hours(db: Session, staff: User, rows: list[tuple[int, bool, int, int]]) -> None:
    for weekday, closed, start_minute, end_minute in rows:
        db.add(
            WorkingHour(
                staff_id=staff.id,
                weekday=weekday,
                closed=closed,
                start_minute=start_minute,
                end_minute=end_minute,
            )
        )


def _default_working_hours() -> list[tuple[int, bool, int, int]]:
    return [(day, day == 6, 540, 1140 if day < 5 else 1080) for day in range(7)]


def seed_platform(db: Session) -> None:
    """Crea el superadmin y la cuenta comercial de cada salón (idempotente).

    En producción no se crea el admin demo: configura
    BELLESSA_PLATFORM_ADMIN_PASSWORD (y el correo si cambia).
    """
    try:
        _seed_platform(db)
    except IntegrityError:
        # Dos cold starts pueden intentar crear la misma cuenta a la vez.
        db.rollback()
        logger.info("La plataforma ya estaba siendo inicializada por otra instancia.")


def _seed_platform(db: Session) -> None:
    password = settings.platform_admin_password or (PLATFORM_PASSWORD if settings.seed_demo else "")
    email = settings.platform_admin_email or PLATFORM_EMAIL
    if password:
        admin = db.scalar(select(PlatformAdmin).where(PlatformAdmin.email == email))
        if admin is None:
            db.add(
                PlatformAdmin(
                    name=settings.platform_admin_name,
                    email=email,
                    password_hash=hash_password(password),
                )
            )
    for business in db.scalars(select(Business)).all():
        ensure_tenant_account(
            db,
            business,
            plan="salon" if business.slug == DEMO_SLUG else None,
            status="active" if business.slug == DEMO_SLUG else None,
        )
    db.commit()


def provision_business(db: Session, business: Business, owner: User) -> None:
    """Catálogo y horarios iniciales para que un salón nuevo pueda operar hoy mismo."""
    _add_business_hours(db, business)
    _add_working_hours(db, owner, _default_working_hours())
    starter = [
        ("Corte de dama", "Corte, lavado y secado.", "Cabello", 45, 38000, "#C2415A"),
        ("Manicure gel", "Uñas de gel con diseño minimalista.", "Uñas", 60, 45000, "#A65A78"),
        ("Tinte global", "Coloración completa con tratamiento.", "Color", 120, 145000, "#7A4E3B"),
        ("Peinado express", "Ondas o recogido para evento.", "Peinado", 45, 42000, "#D97757"),
    ]
    for index, (name, description, category, duration, price, color) in enumerate(starter):
        db.add(
            Service(
                business_id=business.id,
                name=name,
                description=description,
                category=category,
                duration_min=duration,
                buffer_min=10,
                price_cents=price,
                color=color,
                sort_order=index,
            )
        )


def seed_demo(db: Session) -> bool:
    """Siembra idempotente y tolerante a cold starts concurrentes en Vercel."""
    try:
        return _seed_demo(db)
    except IntegrityError:
        # Otra instancia ganó la carrera del seed: su commit ya dejó los datos.
        db.rollback()
        logger.info("El salón demo ya estaba siendo creado por otra instancia.")
        return False


def _seed_demo(db: Session) -> bool:
    existing = db.scalar(select(Business).where(Business.slug == DEMO_SLUG))
    if existing is not None:
        return False

    tz = tz_for("America/Mexico_City")
    today = datetime.now(tz).date()

    business = Business(
        name="Salón Lucía",
        slug=DEMO_SLUG,
        legal_name="Lucía Herrera",
        rfc="HELJ850312MDF",
        phone="55 5555 1234",
        whatsapp="55 5555 1234",
        email="hola@salonlucia.mx",
        address="Av. Álvaro Obregón 145",
        neighborhood="Roma Norte",
        city="Ciudad de México",
        state="CDMX",
        instagram="@salonlucia.mx",
        timezone="America/Mexico_City",
        currency="MXN",
        require_deposit=True,
        deposit_percent=30,
        cancellation_hours=12,
        min_notice_minutes=90,
        monthly_goal_cents=18000000,
    )
    db.add(business)
    db.flush()
    _add_business_hours(db, business)

    demo_hash = hash_password(DEMO_PASSWORD)
    staff_specs = [
        ("Lucía Herrera", DEMO_EMAIL, "55 5555 1234", "#C2415A", 0, "Fundadora · color y novias"),
        ("Ximena Ríos", "ximena@salonlucia.mx", "55 4444 8899", "#3E5C50", 3500, "Especialista en balayage"),
        ("Regina Solís", "regina@salonlucia.mx", "55 3333 7711", "#D9A441", 3000, "Uñas y peinados"),
    ]
    staff: list[User] = []
    for name, email, phone, color, commission, bio in staff_specs:
        member = User(
            business_id=business.id,
            name=name,
            email=email,
            password_hash=demo_hash,
            phone=phone,
            role=UserRole.owner if email == DEMO_EMAIL else UserRole.staff,
            color=color,
            commission_bps=commission,
            bio=bio,
        )
        db.add(member)
        db.flush()
        _add_working_hours(db, member, STAFF_HOURS[name])
        staff.append(member)

    services: list[Service] = []
    for index, (name, description, category, duration, buffer, price, deposit, color) in enumerate(DEMO_SERVICES):
        service = Service(
            business_id=business.id,
            name=name,
            description=description,
            category=category,
            duration_min=duration,
            buffer_min=buffer,
            price_cents=price,
            deposit_cents=deposit,
            color=color,
            sort_order=index,
        )
        db.add(service)
        services.append(service)
    db.flush()

    clients: list[Client] = []
    for index, (name, phone, birthday, tags, notes) in enumerate(DEMO_CLIENTS):
        birthday_date = datetime.strptime(birthday, "%Y-%m-%d").date()
        # Dos cumpleaños próximos para que el dashboard tenga contenido real.
        if index == 0:
            next_birthday = today + timedelta(days=2)
            birthday_date = birthday_date.replace(month=next_birthday.month, day=next_birthday.day)
        if index == 4:
            next_birthday = today + timedelta(days=5)
            birthday_date = birthday_date.replace(month=next_birthday.month, day=next_birthday.day)
        created_days = 190 - index * 14 if index < 8 else index + 2
        client = Client(
            business_id=business.id,
            name=name,
            phone=normalize_phone_mx(phone),
            email=f"{name.split()[0].lower()}.{name.split()[1].lower()}@correo.mx",
            birthday=birthday_date,
            notes=notes,
            tags=tags,
            accepts_marketing=index % 4 != 0,
            rfc="XAXX010101000" if index == 0 else None,
            created_at=local_to_utc_naive(
                today - timedelta(days=created_days), 12 * 60, business.timezone
            ),
        )
        db.add(client)
        clients.append(client)
    db.flush()

    methods = [PaymentMethod.cash, PaymentMethod.card, PaymentMethod.transfer]
    code_seq = 0

    def code() -> str:
        nonlocal code_seq
        code_seq += 1
        return new_confirmation_code()

    for offset in range(-14, 8):
        day = today + timedelta(days=offset)
        if day.weekday() == 6:
            continue
        for staff_index, member in enumerate(staff):
            minute = 9 * 60 + 30 + staff_index * 20
            appointments_that_day = 2 if offset % 3 else 3
            for n in range(appointments_that_day):
                service = services[(offset * 2 + staff_index + n * 3) % len(services)]
                if minute + service.duration_min > 19 * 60:
                    break
                client = clients[(offset * 3 + staff_index + n * 2) % len(clients)]
                start_at = local_to_utc_naive(day, minute, business.timezone)
                end_at = start_at + timedelta(minutes=service.duration_min)

                if offset < 0:
                    if abs(offset) % 9 == 0 and n == 0:
                        status = AppointmentStatus.canceled
                    elif abs(offset) % 11 == 0:
                        status = AppointmentStatus.no_show
                    else:
                        status = AppointmentStatus.completed
                elif offset == 0:
                    status = AppointmentStatus.completed if minute < 12 * 60 else AppointmentStatus.confirmed
                    if n == 2:
                        status = AppointmentStatus.pending
                else:
                    status = AppointmentStatus.confirmed
                    if (offset + n) % 4 == 0:
                        status = AppointmentStatus.pending

                appointment = Appointment(
                    business_id=business.id,
                    client_id=client.id,
                    staff_id=member.id,
                    service_id=service.id,
                    start_at=start_at,
                    end_at=end_at,
                    status=status,
                    price_cents=service.price_cents,
                    deposit_cents=round(service.price_cents * 0.3) if service.deposit_cents else 0,
                    notes="Cliente frecuente" if n == 0 else None,
                    source="public" if (offset + n) % 5 == 0 else "staff",
                    confirmation_code=code(),
                    created_by=member.id,
                    created_at=start_at - timedelta(days=2),
                )
                db.add(appointment)
                db.flush()

                if status == AppointmentStatus.completed:
                    tip = round(service.price_cents * 0.10) if (offset + n + staff_index) % 3 == 0 else 0
                    payment = Payment(
                        business_id=business.id,
                        appointment_id=appointment.id,
                        client_id=client.id,
                        staff_id=member.id,
                        service_id=service.id,
                        amount_cents=service.price_cents,
                        tip_cents=tip,
                        method=methods[(offset + n + staff_index) % len(methods)],
                        reference="Terminal Clip" if methods[(offset + n) % 3] == PaymentMethod.card else None,
                        created_by=member.id,
                        created_at=end_at,
                    )
                    db.add(payment)
                    if client.last_visit_at is None or client.last_visit_at < end_at:
                        client.last_visit_at = end_at

                minute += service.duration_min + 20

    # Gastos de operación para el corte de caja.
    expense_specs = [
        (today, "Café y pan dulce para el equipo", "Operación", 24000, 9 * 60),
        (today - timedelta(days=2), "Insumos de color (tinte y oxidante)", "Insumos", 128000, 10 * 60),
        (today - timedelta(days=1), "Uñas de gel: reposición de tips", "Insumos", 86500, 11 * 60),
        (today - timedelta(days=4), "Limpieza y desinfectantes", "Operación", 43000, 17 * 60),
    ]
    for day, concept, category, amount, minute in expense_specs:
        db.add(
            Expense(
                business_id=business.id,
                concept=concept,
                category=category,
                amount_cents=amount,
                created_by=staff[0].id,
                created_at=local_to_utc_naive(day, minute, business.timezone),
            )
        )

    db.commit()
    return True
