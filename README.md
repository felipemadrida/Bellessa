# Bellessa 💫

**Agenda y seguimiento para salones de belleza en México.** Una micro-app móvil + nube, inspirada en la experiencia de GlossGenius pero aterrizada al mercado mexicano: precios en MXN con IVA incluido, WhatsApp con formato +52, propinas, anticipos, corte de caja, RFC/CFDI y hora de Ciudad de México.

> Demo lista: **Salón Demo**, Roma Norte, CDMX.
> Dueña: `demo@bellessa.mx` · Contraseña: `demo1234`
> Admin SaaS: `/admin` · `admin@bellessa.mx` / `admin1234`
> Página pública de reservas: `/reservar/salon-lucia`
>
> **Demo en Vercel:** https://bellessa-web.vercel.app
> **Alias de frontend:** https://frontend-neon-delta-72.vercel.app
> **API:** https://bellessa-api.vercel.app/api/docs
> **Admin SaaS:** https://bellessa-web.vercel.app/admin

---

## ¿Qué resuelve?

Un salón pequeño vive entre la libreta, Instagram, WhatsApp y una caja que no cuadra. Bellessa concentra el día completo:

- **Agenda real** por profesional, con horarios de atención, descansos, duración + limpieza y bloqueo de traslapes.
- **Reservas en línea** con página pública propia, sin comisiones por reserva.
- **Clientas** con historial, notas de color/alergias, cumpleaños, etiquetas y seguimiento por WhatsApp.
- **Cobros** en efectivo, tarjeta o transferencia, con propina separada, desglose de IVA y recibo descargable.
- **Corte de caja** diario: ingresos, propinas, gastos y efectivo esperado.
- **Reportes** de ingresos, ocupación, ticket promedio, servicios estrella, comisiones del equipo y clientas nuevas vs. recurrentes.
- **Equipo** con comisiones, horarios propios y acceso individual.
- **Bloqueos de agenda** por día(s): vacaciones, cursos o descanso, con validación de citas existentes y desbloqueo.
- **Bitácora de auditoría** de acciones sensibles (cobros, citas, bloqueos, cambios de perfil) visible para la dueña.
- **WhatsApp manual sin API**: bandeja de mensajes preparados, enlaces `wa.me`, copia, estado pendiente/abierto/confirmado/fallido y confirmación explícita del operador.
- **Bot de WhatsApp opcional** con simulador local y adaptador a Meta Cloud API: menú de servicios, disponibilidad, confirmación, cancelación y atención humana.
- **Marketing automatizado**: recordatorios 24 h/2 h, cumpleaños (7 días antes), reactivación 30/60/90 días, reseñas, campañas por segmento, plantillas con opt-out y programa de lealtad (puntos, nivel VIP y recompensa cada 5 visitas).
- **Inventario**: productos con SKU, precio, costo, stock mínimo y movimientos de entrada/salida/ajuste con trazabilidad.
- **Admin SaaS híbrido**: panel de plataforma en `/admin` con CRUD de tenants (crear, editar, archivar/restaurar), planes Free/Pro/Salón, uso, MRR estimado, credenciales temporales y métricas globales; separado del panel operativo del salón.

### Lo mexicano, de verdad

| Necesidad local | Cómo está resuelto |
|---|---|
| Precios con IVA incluido | Precio final en MXN; subtotal e IVA 16% se desglosan en el recibo |
| Facturación | RFC de clienta y salón, nota de CFDI 4.0; recibo interno descargable |
| WhatsApp | Bot de citas, simulador local y Cloud API con +52; recordatorios, cumpleaños, reactivación y reseñas |
| Propinas | Se capturan aparte del servicio y se reportan al equipo |
| Anticipos | Porcentaje configurable y monto sugerido por servicio |
| “No asistió” | Estado propio que alimenta reportes y libera el horario |
| Zona horaria | Todo se guarda en UTC y se muestra en `America/Mexico_City` |
| Caja | Corte con efectivo esperado, gastos y propinas |
| Lenguaje | es-MX, “clientas”, “corte de caja”, “anticipo”, “dueña” |

---

## Capturas

| Dashboard | Agenda |
|---|---|
| ![Dashboard](docs/screenshots/02-dashboard.png) | ![Agenda](docs/screenshots/03-agenda.png) |

| Reserva pública | Corte de caja |
|---|---|
| ![Reserva pública](docs/screenshots/09-reserva-publica.png) | ![Corte de caja](docs/screenshots/06-caja.png) |

| Bloqueos de agenda | Actividad reciente |
|---|---|
| ![Bloqueos](docs/screenshots/17-bloqueos-agenda.png) | ![Actividad](docs/screenshots/18-actividad-reciente.png) |

| WhatsApp y marketing | Lealtad de clienta |
|---|---|
| ![WhatsApp](docs/screenshots/21-whatsapp-segmentos.png) | ![Lealtad](docs/screenshots/20-lealtad-clienta.png) |

| WhatsApp manual | Inventario |
|---|---|
| ![WhatsApp manual](docs/screenshots/29-whatsapp-manual.png) | ![Inventario](docs/screenshots/30-inventario.png) |

| Diseño plateado/dorado y navegación “Hoy / Más” |
|---|
| ![Diseño dorado](docs/screenshots/31-diseno-dorado.png) |

| Admin SaaS · CRUD |
|---|
| ![Admin SaaS CRUD](docs/screenshots/27-admin-crud.png) |

Las capturas se generaron con Playwright sobre el build de producción. El recorrido incluye login, dashboard, agenda, cita, clientas, caja, reportes, servicios, equipo, ajustes, bloqueos, auditoría, reserva pública y el simulador de WhatsApp/campañas. Sin errores de consola ni requests fallidos.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + React Query + PWA instalable |
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2 + Pydantic v2 + JWT |
| Base de datos | PostgreSQL 16 en Docker · SQLite para desarrollo local y demos |
| Infra | Docker + Docker Compose + nginx · imágenes 100% gratuitas y open source |

```
┌──────────────────────────────┐
│  React PWA (móvil primero)   │
│  agenda · clientas · caja    │
└──────────────┬───────────────┘
               │ /api (nginx proxy)
┌──────────────▼───────────────┐
│  FastAPI                     │
│  auth · agenda · reservas    │
│  cobros · reportes           │
└──────────────┬───────────────┘
               │ SQLAlchemy
┌──────────────▼───────────────┐
│  PostgreSQL 16               │
│  (SQLite en local)           │
└──────────────────────────────┘
```

---

## Arranque rápido

### Opción A — Docker (recomendado para ver todo junto)

Requisitos: Docker Desktop o Docker Engine con Compose.

```bash
cp .env.example .env
docker compose up --build
```

Abre **http://localhost:8080** e inicia sesión con el demo.

- Web + API proxificada: `http://localhost:8080`
- Documentación interactiva: `http://localhost:8000/api/docs`
- PostgreSQL persistente en el volumen `bellessa_pgdata`.

> Cambia `POSTGRES_PASSWORD` y `JWT_SECRET` antes de publicar. Para producción pon `SEED_DEMO=false`.

### Opción B — Desarrollo local

**Backend** (Python 3.12+):

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Frontend** (Node 20+):

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. Vite hace proxy de `/api` a `http://127.0.0.1:8000`.

La primera vez se crea `backend/bellessa.db` con el salón demo, 3 profesionales, 10 servicios, 12 clientas y ~100 citas alrededor de la fecha actual.

---

## Demo

| Qué probar | Dónde |
|---|---|
| Login de dueña | `demo@bellessa.mx` / `demo1234` |
| Dashboard con ingresos, meta, cumpleaños y próximas citas | `/` |
| Agenda por profesional y creación de cita | `/agenda` |
| Cobrar una cita + recibo con IVA | Abrir cita → *Completar y cobrar* |
| Corte de caja y gastos | `/caja` |
| Reportes y exportación CSV | `/reportes` |
| Bot de WhatsApp y campañas | `/whatsapp` (escribe “Hola” en el simulador) |
| Bloqueos y auditoría | `/equipo` → Bloqueos · `/ajustes` → Actividad |
| Reserva pública (sin login) | `http://localhost:8080/reservar/salon-lucia` |

La reserva pública crea una cita **pendiente** y aparece al instante en la agenda del salón. En **WhatsApp & marketing** puedes simular el bot, ver la bandeja y preparar campañas; en modo `mock` nada sale a Meta, y en modo `cloud` se usa la API oficial con las credenciales configuradas.

---

## Estructura

```
bellessa/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI, CORS, lifespan
│   │   ├── models.py               # negocio, staff, clientas, citas, pagos
│   │   ├── schemas.py              # contratos Pydantic
│   │   ├── security.py             # scrypt + JWT
│   │   ├── seed.py                 # Salón Demo y catálogo inicial
│   │   ├── services/availability.py# motor de horarios reales
│   │   ├── services/whatsapp.py     # bot, mock y Cloud API
│   │   ├── services/marketing.py    # segmentos, plantillas, scheduler
│   │   ├── routers/                # auth, agenda, caja, WhatsApp, marketing, plataforma
│   │   └── services/plans.py        # planes y límites SaaS
│   ├── tests/                      # pytest (30 pruebas de flujo)
│   └── Dockerfile
├── frontend/
│   ├── src/pages/                  # dashboard, agenda, clientas, caja...
│   ├── src/components/             # UI, modales, hoja de cita
│   ├── public/                     # manifest, service worker, iconos
│   └── Dockerfile · nginx.conf
├── docs/
│   ├── ARQUITECTURA.md
│   ├── ALCANCE.md
│   ├── AUDITORIA.md
│   ├── WHATSAPP.md
│   ├── MARKETING.md
│   ├── ADMIN_SAAS.md
│   ├── INVENTARIO.md
│   ├── PROMPT_PRODUCCION_MICRO_APP.md
│   ├── DEPLOY_VERCEL_NEON.md
│   └── DEPLOY.md
├── scripts/
│   ├── backup.ps1
│   └── backup.sh
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

---

## API

Swagger: `http://localhost:8000/api/docs`

| Grupo | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Negocio | `GET/PATCH /api/business`, `PUT /api/business/hours` |
| Equipo | `GET/POST /api/staff`, `PATCH /api/staff/{id}`, `PUT /api/staff/{id}/hours` |
| Bloqueos | `GET/POST /api/staff/{id}/time-off`, `DELETE /api/staff/{id}/time-off/{block}` |
| Auditoría | `GET /api/audit` (solo dueña) |
| Servicios | `GET/POST /api/services`, `PATCH /api/services/{id}` |
| Clientas | `GET/POST /api/clients`, `GET/PATCH /api/clients/{id}`, `GET .../whatsapp` |
| Agenda | `GET /api/appointments?date=...`, `POST /api/appointments`, `PATCH`, `POST .../status`, `GET .../whatsapp` |
| Disponibilidad | `GET /api/availability?service_id=&date=&staff_id=` |
| Cobros | `POST/GET /api/payments`, `GET /api/payments/{id}/receipt` |
| Caja | `GET /api/cash/summary?date=`, `GET/POST /api/expenses` |
| Reportes | `GET /api/reports/summary`, `GET /api/reports/export.csv` |
| Público | `GET /api/public/{slug}`, `GET .../availability`, `POST .../book` |
| Inventario | `GET/POST /api/inventory/products`, `GET/PATCH/DELETE .../products/{id}`, `POST .../products/{id}/movements`, `GET .../movements`, `GET .../summary` |
| WhatsApp | `GET /api/whatsapp/status`, `GET .../outbox`, `GET/POST .../manual`, `POST .../manual/{id}/prepare|opened|confirm|failed`, `POST .../mock`, `GET/POST .../webhook` |
| Marketing | `GET /api/marketing/templates`, `GET .../segments`, `GET .../calendar`, `POST .../campaigns` |
| Interno | `GET/POST /api/internal/tick`, `POST /api/internal/bootstrap` (protegido por `CRON_SECRET`) |
| Plataforma | `POST /api/platform/login`, `GET /api/platform/overview`, `GET/POST /api/platform/tenants`, `GET/PATCH/DELETE /api/platform/tenants/{id}` |

### Motor de disponibilidad

Para cada profesional calcula:

```
horario del salón ∩ horario del profesional
− citas activas (con su buffer de limpieza)
− bloqueos / time off
− aviso mínimo configurado
```

Los horarios se generan en intervalos de 15 min (configurable) y solo se devuelven los que caben completos. Al crear o mover una cita se vuelve a validar el hueco para evitar dobles reservas.

---

## Pruebas

```bash
cd backend
pytest
```

Cubren: login y aislamiento multi-negocio, registro, flujo completo cita → cobro → recibo → caja, conflictos de horario, domingo cerrado, reserva pública, reportes, CSV, catálogo, transiciones de estado, bloqueos de agenda, traslape de citas de una misma clienta, auditoría con permisos, bot de WhatsApp de punta a punta, webhook/verificación y campañas de marketing.

```bash
cd frontend
npm run typecheck   # TypeScript estricto
npm run build       # build de producción
```

---

## Decisiones de producto

1. **Móvil primero, no “responsive de escritorio”.** La dueña agenda desde el celular entre clientas; la navegación inferior, los botones de 44 px y las hojas deslizantes están pensadas para una mano.
2. **Una sola pantalla para el día.** Dashboard = cuánto llevas, qué sigue y qué falta confirmar. Sin menús profundos.
3. **WhatsApp con dos modos.** `mock` para demo/pruebas sin costo ni riesgo de ban; `cloud` con Meta Cloud API para producción, firma HMAC, plantillas y ventana de 24 h. El bot se apoya en un estado persistente por teléfono, no en memoria.
4. **El dinero se guarda en centavos enteros.** Nunca floats. El IVA se desglosa a partir de precios finales, como se cotiza en un salón mexicano.
5. **UTC en base, hora del salón en pantalla.** Así el negocio puede cambiar de ciudad sin reescribir citas.
6. **Multi-negocio desde el modelo.** Cada consulta filtra por `business_id`; el JWT lleva el negocio de la sesión.
7. **Recibo, no CFDI timbrado.** El sistema prepara RFC y datos fiscales y genera un comprobante interno. El timbrado requiere contratar un PAC; se deja explícito para no simular cumplimiento fiscal.
8. **Automatización sin infraestructura extra.** Un scheduler interno idempotente cubre recordatorios y campañas para un salón; si el negocio crece, se reemplaza por Redis + worker sin cambiar las reglas de negocio.

---

## Despliegue gratuito

Ver [`docs/DEPLOY.md`](docs/DEPLOY.md) y la ruta concreta [`docs/DEPLOY_VERCEL_NEON.md`](docs/DEPLOY_VERCEL_NEON.md). Resumen:

- **Vercel + Neon + GitHub:** frontend React/Vite y API FastAPI en Vercel; PostgreSQL en Neon; cron externo para recordatorios.
- **Todo en uno:** un VPS con Docker + Compose (o tu laptop/servidor casero).
- **Gratis administrado:** API en Render/Fly.io + Postgres en Neon/Supabase + frontend estático o el mismo contenedor.
- Configura `JWT_SECRET`, `BELLESSA_PUBLIC_BASE_URL`, `CORS_ORIGINS` y `SEED_DEMO=false`.
- Configura WhatsApp: empieza con `WHATSAPP_PROVIDER=mock`; para Meta usa token, phone ID, verify token y App Secret. La guía está en [`docs/WHATSAPP.md`](docs/WHATSAPP.md).
- En Vercel + Neon, usa la guía [`docs/DEPLOY_VERCEL_NEON.md`](docs/DEPLOY_VERCEL_NEON.md): API FastAPI, web Vite, bootstrap y cron externo.
- El contenedor de API ya corre como usuario sin privilegios y con healthcheck.

---

## Relación con el plan maestro

El repositorio incluye [`Prompt maestro BeautyHub.pdf`](Prompt%20maestro%20BeautyHub.pdf), que describe una plataforma SaaS de 12 módulos. Esta entrega implementa el **primer hito operativo**: fundación, seguridad multi-negocio, catálogos, agenda inteligente, bot de WhatsApp con simulador/Cloud API, marketing automatizado, cobros/caja, analítica y auditoría. El mapa de fases está en [`docs/ALCANCE.md`](docs/ALCANCE.md) y la auditoría contra los briefs en [`docs/AUDITORIA.md`](docs/AUDITORIA.md).

No hay módulos de “vitrina” sin backend: todo lo que aparece en la navegación está conectado a la base de datos y probado. La bandeja de WhatsApp en modo `mock` es un simulador deliberado, no un envío falso a Meta.

---

## Límites conocidos / siguiente iteración

- Sin pasarela de pagos (Clip, Mercado Pago, Stripe) ni cobro real en línea.
- Sin timbrado CFDI 4.0 (solo datos fiscales + recibo interno).
- WhatsApp Cloud API real requiere plantillas aprobadas por Meta para iniciar conversación fuera de la ventana de 24 h; el modo `mock` no envía a Meta.
- Sin agente de IA generativa: el bot es un flujo guiado determinista y auditable.
- `create_all` para el esquema inicial; para producción con cambios continuos conviene Alembic.
- Sin recuperación de contraseña por correo ni refresh tokens.
- Sin roles separados de recepcionista/estilista; hoy dueña y equipo.
- Agenda en vista día; semana/mes y lista de espera están en roadmap.
- Lealtad 5+1, cupones únicos y upselling por historial aún no están implementados; el marketing actual es por segmentos y plantillas.
- La auditoría es una bitácora operativa, no un sistema inmutable WORM ni reemplazo de un SIEM.

Roadmap natural: vistas semana/mes, lista de espera, roles finos, lealtad/cupones, pagos con anticipo, CFDI vía PAC, Redis + worker, modelo predictivo de no-show y app nativa.

---

Hecho con cariño en México. Precios en MXN, acentos incluidos.
