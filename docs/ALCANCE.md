# Alcance de esta entrega vs. plan maestro

El archivo [`Prompt maestro BeautyHub.pdf`](../Prompt%20maestro%20BeautyHub.pdf) define una plataforma SaaS de 12 módulos. Esta entrega es el **primer hito operativo** recomendado por ese mismo plan: una aplicación real, ejecutable, con datos persistidos, autenticación, aislamiento por negocio y los módulos que una dueña necesita para abrir el salón mañana.

No se simulan módulos vacíos. Cada pantalla y botón incluido está conectado a la API y a PostgreSQL/SQLite.

## Fases del plan

| Fase | Alcance del plan | Estado en esta entrega |
|---|---|---|
| 0 · Diseño técnico | Arquitectura, modelo, API | ✅ Documentado en `ARQUITECTURA.md`; API OpenAPI |
| 1 · Fundación | Monorepo, React, FastAPI, Docker, Postgres, Alembic | ✅ Monorepo, React/FastAPI, Docker Compose, Postgres; migraciones automáticas (`create_all`), Alembic queda recomendado para el siguiente cambio de esquema |
| 2 · Seguridad SaaS | Registro, login, roles, tenant, auditoría | ✅ Registro/login JWT, scrypt, aislamiento por `business_id`, superadmin de plataforma y bitácora; ⚠️ roles de salón limitados a dueña/equipo y sin RLS |
| 3 · Catálogos y CRM básico | Clientes, servicios, personal, horarios, sucursales | ✅ Clientes, servicios, personal y horarios; ⚠️ una sucursal por negocio |
| 4 · Agenda inteligente | Disponibilidad, bloqueos, reprogramación, cancelación, lista de espera | ✅ Motor de disponibilidad, buffers, traslapes, reagendar, cancelar, no asistió y bloqueos por día desde Equipo; ❌ lista de espera y bloqueos por horas |
| 5 · WhatsApp manual | Plantillas, mensajes, bandeja, registro | ✅ Bot de citas con simulador y Cloud API, webhook firmado, bandeja, recordatorios programados y handoff humano; ⚠️ plantillas aprobadas e interactivos nativos de Meta pendientes |
| 6 · CRM avanzado | Historial, etiquetas, segmentos, fidelización, cumpleaños | ✅ Historial, notas, etiquetas, cumpleaños, segmentos, puntos/niveles de lealtad y campañas; ❌ canje, paquetes y upselling automático por historial |
| 7 · POS, caja e inventario | Ventas, pagos, cortes, comisiones, productos, stock | ⚠️ Cobros ligados a citas, propinas, corte, gastos, comisiones y recibo; ❌ venta de mostrador, inventario y compras |
| 8 · Marketing | Cupones, campañas, segmentos, seguimiento | ✅ Plantillas, segmentos, campañas manuales, calendario y automatizaciones (cumpleaños 7 días, win-back 30/60/90, reseñas, lealtad); ❌ cupones/referidos y atribución fina |
| 9 · Analítica | Dashboard, ventas, ocupación, productividad, exportación | ✅ Dashboard, reportes de 7/30/90 días, ocupación, comisiones, top servicios/clientas y CSV |
| 10 · Comercialización SaaS | Planes, límites, suscripciones, superadmin | ⚠️ CRUD de tenants, planes Free/Pro/Salón, límite de staff, archivo/restauración, suspensión y panel `/admin`; ❌ cobro automático, borrado permanente, límite transaccional de citas y subdominios |
| 11 · Producción | Pruebas, seguridad, backups, cloud, manuales | ⚠️ 26 pruebas backend, build/typecheck, Docker, healthchecks, CSP básica, CI en GitHub Actions, scripts de respaldo y guía de despliegue; ❌ backups automáticos programados, RLS y logs JSON centralizados |

## Diferencias deliberadas para un MVP

- **Autenticación con scrypt** (stdlib) en lugar de Argon2 para reducir dependencias nativas; el algoritmo es seguro y está aislado en `security.py` para migrar sin tocar rutas.
- **Esquema con `create_all`** en lugar de Alembic para mantener el arranque de un solo comando. Antes del primer cambio destructivo en producción, introducir Alembic.
- **Sin RLS de Postgres**: el aislamiento se hace en cada consulta mediante `business_id` y validación de pertenencia. RLS es la segunda barrera recomendada antes de multiusuario masivo.
- **Diseño propio con Tailwind** en lugar de shadcn/ui y FullCalendar: menos dependencias, control total del look móvil y agenda por tarjetas. La API de disponibilidad es independiente de la UI.
- **Sin pasarela de pagos ni timbrado CFDI**: el recibo es interno y los campos fiscales están listos; conectar Clip/Mercado Pago/Stripe y un PAC es el siguiente hito comercial.
- **WhatsApp con dos modos**: `mock` para demo y `cloud` para Meta. La conversación es un flujo guiado, no IA generativa; para iniciar fuera de la ventana de 24 h se necesitan plantillas aprobadas.

## Mejoras implementadas en esta iteración

- **Bot de WhatsApp** con menú de servicios, disponibilidad, confirmación, cancelación, reprogramación y handoff humano; simulador local + Cloud API.
- **Scheduler idempotente** de recordatorios 24 h/2 h, cumpleaños, reactivación 30/60/90 días y solicitud de reseñas.
- **Campañas por segmento** con 12 plantillas, consentimiento/opt-out y bandeja de salida.
- **Lealtad** con puntos por gasto, nivel VIP (top 20 %), progreso a la 6ta visita y segmentos de reactivación 30/60/90.
- **Admin SaaS híbrido** con superadmin separado, planes, suspensión de tenants y métricas globales.
- **Bloqueos de agenda por día** con validación de citas existentes y UI en Equipo.
- **Regla de negocio:** una clienta no puede tener dos citas activas traslapadas, aunque sea con profesionales distintas.
- **Bitácora de auditoría** para citas, cobros, gastos, bloqueos, clientas, equipo y perfil; consultable en Ajustes.
- **CI en GitHub Actions** con pruebas backend y build del frontend.
- **Respaldo de PostgreSQL/SQLite** con scripts para PowerShell y Bash.

## Siguiente hito recomendado

1. **Sucursales y roles de salón** (`Location`, recepcionista/estilista, asignación de staff a sucursal).
2. **Vistas semana/mes y lista de espera** para reasignar huecos liberados.
3. **Alembic + RLS** para evolución de esquema y segunda barrera de aislamiento.
4. **Lealtad 5+1, cupones únicos y upselling por historial**.
5. **POS de mostrador + inventario** y pagos de anticipo/CFDI.
6. **Redis + worker** y modelo predictivo de no-show; logs JSON y alertas.

La base actual permite agregar estos módulos sin reescribir autenticación, agenda, clientes ni caja.
