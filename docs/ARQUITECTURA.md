# Arquitectura de Bellessa

## 1. Contexto

Bellessa es una micro-app SaaS multi-negocio para salones de belleza en México. El objetivo es que una dueña pueda operar su día desde el celular: ver la agenda, confirmar citas, cobrar, mandar recordatorios y cerrar caja, sin depender de una laptop ni de una conexión estable de escritorio.

El sistema se diseñó para **una sola sucursal por negocio** en su primera versión. El modelo de datos ya incluye `business_id` en todas las entidades operativas, por lo que agregar sucursales implica añadir una entidad `Location` y mover horarios/servicios a ese nivel.

## 2. Principios

1. **Multi-tenant por fila.** Todas las consultas se filtran por `business_id`. El JWT incluye `bid` y el backend valida que coincida con el usuario.
2. **Dinero entero.** Todos los montos viajan y se guardan en centavos (`int`). El frontend formatea MXN; nunca se hacen operaciones de punto flotante con dinero.
3. **UTC en persistencia, hora local en presentación.** El backend guarda `timestamp` UTC sin zona (consistente entre SQLite y Postgres). La zona del salón (`America/Mexico_City` por defecto) se aplica al calcular disponibilidad, reportes y textos.
4. **Validación en el servidor.** El frontend puede deshabilitar botones, pero la disponibilidad, los traslapes y las transiciones de estado se vuelven a validar en FastAPI.
5. **WhatsApp como enlace, no como dependencia.** Se generan links `wa.me` con mensaje prellenado. No hay costo por mensaje ni credenciales de Meta; se puede integrar la API oficial después.
6. **Operación offline-first del teléfono, no de la base.** La PWA cachea el shell; las citas siempre requieren red. La escritura offline queda en roadmap.

## 3. Modelo de dominio

```
Business 1 ─── * BusinessHour
Business 1 ─── * User (staff) 1 ─── * WorkingHour
Business 1 ─── * Service
Business 1 ─── * Client 1 ─── * Appointment
Business 1 ─── * Appointment * ─── 1 User (staff)
Appointment 1 ─── 0..1 Payment
Business 1 ─── * Expense
Business 1 ─── * AuditLog
Business 1 ─── * WhatsAppConversation 1 ─── 0..1 Client
Business 1 ─── * MessageLog 0..1 ─── Client / Appointment
Client 1 ─── * Appointment
```

### Entidades

| Entidad | Campos clave | Notas |
|---|---|---|
| `Business` | slug, RFC, timezone, IVA bps, anticipo, ventana de reservas, meta mensual | Configuración del salón |
| `BusinessHour` | weekday 0–6, closed, open/close minute | Horario base |
| `User` | email único, password_hash, role, color, comisión bps | Dueña o profesional |
| `WorkingHour` | staff_id, weekday, closed, start/end minute | Horario individual |
| `TimeOff` | staff_id, start/end, motivo | Bloqueos de día completo con API y UI |
| `Service` | duración, buffer, precio, anticipo, color, activo | El color pinta la agenda |
| `Client` | teléfono normalizado, cumpleaños, notas, tags, RFC | Ficha de seguimiento |
| `Appointment` | start/end UTC, status, precio, anticipo, código | Núcleo operativo |
| `Payment` | monto, propina, método, referencia | Un cobro por cita |
| `Expense` | concepto, categoría, monto | Insumos y operación |
| `AuditLog` | acción, entidad, detalle, usuario | Bitácora operativa de la dueña |
| `WhatsAppConversation` | phone, step, servicio, slot, draft_name | Estado durable del bot |
| `MessageLog` | kind, template, body, status, provider, dedupe_key | Bandeja, recordatorios y campañas |
| `Product` | nombre, SKU, categoría, precio, costo, stock, mínimo | Inventario por salón |
| `StockMovement` | product_id, tipo, cantidad, motivo, usuario | Entrada, salida o ajuste auditable |
| `PlatformAdmin` | email único, password_hash, active | Superadmin del SaaS, sin `business_id` |
| `TenantAccount` | business_id, plan, status, trial_ends_at | Plan comercial y suspensión del salón |

### Estados de una cita

```
pending ──► confirmed ──► completed
   │            │
   ├──► canceled└──► no_show
   └──► no_show
```

- `completed` fija `last_visit_at` de la clienta.
- `canceled` y `no_show` liberan el horario y alimentan reportes.
- Un cobro marca automáticamente la cita como `completed`.

## 4. Aislamiento y autenticación

- Contraseñas con **scrypt** (`n=2^14, r=8, p=1`, sal aleatoria de 16 bytes), comparación en tiempo constante.
- JWT HS256, vigencia de 7 días (uso móvil), claims `sub`, `bid`, `role`, `scope`, `exp`.
- Dos planos de acceso:
  - `scope=tenant`: dueña/equipo del salón.
  - `scope=platform`: superadmin de Bellessa; `get_platform_admin` lo valida y no comparte tokens con el salón.
- Dependencias FastAPI:
  - `get_current_user` valida token, scope, usuario activo y negocio.
  - `get_current_business` resuelve el negocio y bloquea tenants suspendidos.
  - `require_owner` protege configuración, catálogo y equipo.
- Todas las consultas por id comparan `entity.business_id` contra el negocio del token (evita IDOR).
- **Auditoría:** `AuditLog` registra cobros, cambios de estado, creación/reagendado de citas, bloqueos, cambios de perfil/equipo, reservas públicas e inicios de sesión. La dueña consulta las últimas entradas en `GET /api/audit` y en Ajustes. No se guardan datos clínicos ni notas completas de clientas.
- En producción: rotar `JWT_SECRET`, servir solo HTTPS y considerar refresh tokens + revocación.

## 5. Motor de disponibilidad

`app/services/availability.py` implementa:

```text
para cada profesional activo:
  ventana = max(hora apertura salón, hora entrada staff)
            .. min(hora cierre salón, hora salida staff)
  ocupado = citas activas ± buffer del servicio + time off
  para cada paso de 15 min dentro de la ventana:
    si [inicio - buffer, fin + buffer] no choca con ocupado:
      agregar slot
```

Detalles:

- Estados que bloquean: `pending`, `confirmed`, `completed`.
- El buffer se aplica **a ambos lados** del bloque para respetar limpieza entre clientas.
- Se excluye la cita actual al reagendar (`exclude_appointment_id`).
- `enforce_notice` aplica el aviso mínimo del negocio en la reserva pública; el panel interno permite meter citas más cercanas, pero nunca en el pasado.
- Los slots se generan en la zona del salón y se devuelven con offset local (`-06:00`) y UTC (`Z`).

### Prevención de dobles reservas

En creación y reagendado se recalcula la disponibilidad completa y se exige que el `start_at` exista dentro de los slots. Esto cierra la ventana de carrera más común. Además, una misma clienta no puede tener dos citas activas traslapadas, aunque sean con profesionales distintas. En una operación de alto volumen, el siguiente paso es un constraint de exclusión en Postgres (`btree_gist`) o un lock por profesional.

### Bloqueos de agenda

Los bloqueos son por día completo (`TimeOff`) y se restan del cálculo de disponibilidad. Al crearlos se rechazan si hay citas pendientes/confirmadas en el rango o si se traslapan con otro bloqueo. La UI permite crearlos y eliminarlos desde Equipo; el backend también valida que una profesional solo pueda bloquear su propia agenda.

## 6. Dinero, IVA y propinas

- Precios de servicios **con IVA incluido**, como se cotiza en salones mexicanos.
- `iva_breakdown(total, 1600)` calcula subtotal e IVA con aritmética entera:
  `subtotal = round(total * 10000 / 11600)`.
- El recibo muestra subtotal, IVA, servicio, propina y total.
- La propina **no** forma parte del ingreso por servicio; se suma aparte en caja y reportes.
- Comisión del equipo: `round(monto_servicio * commission_bps / 10000)`, sin propina.
- Métodos: efectivo, tarjeta, transferencia, otro.
- Efectivo esperado = efectivo cobrado + propinas en efectivo − gastos.

## 7. Zona horaria

- `datetime.now(timezone.utc)` para timestamps.
- `local_day_bounds(day, tz)` convierte un día local a un rango UTC; se usa en agenda, caja y reportes.
- El frontend formatea con `Intl.DateTimeFormat('es-MX', { timeZone: business.timezone })`; nunca usa la zona del navegador para mostrar horas del salón.
- México abolió el horario de verano en 2022, pero el código usa `ZoneInfo` y no asume offset fijo.

## 8. API

- Prefijo `/api`, OpenAPI en `/api/docs`.
- Errores con `detail` en español y status HTTP correcto (401, 403, 404, 409, 422).
- Fechas de entrada ISO 8601; se aceptan offsets y se normalizan a UTC.
- Respuestas anidadas listas para UI (`client`, `service`, `staff`, `payment`) para evitar cascadas de requests.
- Descargas:
  - `GET /api/payments/{id}/receipt` → `text/plain` con recibo.
  - `GET /api/reports/export.csv` → CSV con BOM UTF-8 para Excel.
- CORS configurable por variable; en Docker, nginx sirve frontend y API en el mismo origen.

## 9. WhatsApp y marketing

### Dos modos

- `mock` (default): cada mensaje se registra en `message_logs`; el simulador del panel llama al mismo flujo del bot que usaría Meta. No hay llamadas externas.
- `cloud`: `send_message` hace POST a `graph.facebook.com/{version}/{phone_number_id}/messages` con el token configurado. Si falla, el log queda `failed` con el detalle de Meta.

### Webhook

- `GET /api/whatsapp/webhook` valida `hub.verify_token` en tiempo constante.
- `POST /api/whatsapp/webhook` verifica `X-Hub-Signature-256` con el App Secret cuando está configurado, extrae mensajes `text`, `button` o `interactive` y los pasa al bot.
- El negocio se resuelve por `BELLESSA_WHATSAPP_BUSINESS_SLUG`. Para multi-negocio con varios números, el siguiente paso es mapear `phone_number_id` a `business_id`.

### Bot

El estado vive en `whatsapp_conversations` (`phone`, `step`, servicio, profesional, fecha, slot, cliente y `draft_name`). Flujo:

```
servicio → fecha → hora → nombre (si es nueva) → SI → cita confirmada
```

Comandos transversales: `HUMANO`, `CANCELAR`, `REPROGRAMAR`, `MENU`, `BAJA`. Las respuestas se guardan en la bandeja de salida y la cita se registra en auditoría. Los traslapes de la clienta y del profesional se vuelven a validar al confirmar, no solo al mostrar horarios.

### Scheduler y campañas

`services/scheduler.py` inicia un hilo daemon en el lifespan (configurable). Cada intervalo ejecuta `enqueue_scheduled_messages`:

- recordatorio 24 h y 2 h,
- cumpleaños,
- win-back a 60+ días,
- reseña 22–26 h después de una cita completada.

La idempotencia se implementa con `MessageLog.dedupe_key` único. Las campañas manuales usan segmentos (`all`, frecuentes, ocasionales, inactivas, cumpleaños) y 8 plantillas. `accepts_marketing=False` convierte el envío en `skipped`; los recordatorios transaccionales no se bloquean.

### Lealtad

`services/loyalty.py` calcula en lectura (sin tabla extra) puntos, nivel y progreso:

- 1 punto por cada $10 de servicio cobrado (sin propina).
- VIP si está en el top 20 % de gasto de los últimos 12 meses o tiene la etiqueta `VIP`.
- Frecuente con 3+ visitas completadas; Nueva en el resto.
- Recompensa cada 5 visitas completadas. Aún no hay canje ni historial de recompensas.

Esto evita una migración para el MVP; si se agregan canjes o paquetes, se necesitará `loyalty_transactions` y un proceso de redención.

### Límites

- El envío Cloud usa texto libre; para producción se deben registrar plantillas aprobadas y mapear nombre/idioma/parámetros.
- El scheduler no es una cola distribuida: si se corre más de una réplica de API, dedupe evita duplicados pero conviene Redis + worker.
- No hay IA generativa: el bot es determinista, auditable y con fallback humano.

## 10. Frontend

- **React 18 + TypeScript estricto + Vite.**
- **React Query** para caché, invalidación y estados de carga; claves por recurso y fecha.
- **Tailwind** con tokens propios (crema, rosa mexicano, salvia, oro).
- Tipografía editorial (`Fraunces`) + sans (`Manrope`), con fallback a fuentes del sistema.
- Componentes accesibles: labels asociados, `aria-pressed` en selección, foco visible, cierre con Escape, `role="dialog"`, tamaños táctiles ≥ 40 px.
- Móvil: barra inferior con acción central, hojas deslizantes, tablas convertidas en tarjetas.
- PWA: manifest, iconos 192/512, service worker que cachea shell y assets, nunca `/api`.
- El panel público (`/reservar/:slug`) no comparte layout con el panel interno.

## 11. Persistencia y migraciones

- SQLite para desarrollo/demo; PostgreSQL 16 en Docker.
- `Base.metadata.create_all` al arrancar (suficiente para MVP).
- Para evolución del esquema en producción: introducir Alembic antes del primer cambio destructivo.
- `seed_demo` es idempotente por slug y se desactiva con `BELLESSA_SEED_DEMO=false`.

## 12. Observabilidad y salud

- `GET /api/health` para balanceadores y Docker.
- Logs de Uvicorn a stdout.
- Healthchecks en Dockerfile y Compose.
- Recomendado en producción: Sentry para errores, logs estructurados, métricas de latencia y respaldos diarios de Postgres.

## 13. Pruebas

- 30 pruebas de integración con SQLite en memoria y `TestClient`.
- WhatsApp manual: crear mensaje desde cita, preparar, abrir, confirmar y marcar fallo con trazabilidad en `message_logs`.
- Aislamiento por fixture: base limpia + seed demo + plataforma en cada prueba.
- Casos cubiertos: auth, tenant, agenda, conflicto, disponibilidad domingo, cobro/recibo, caja, reserva pública, reportes/CSV, catálogo, planes, CRUD de plataforma, archivo/restauración, suspensión y separación de tokens de plataforma.
- Frontend: `tsc --noEmit` y build de producción dentro del pipeline.

## 14. Decisiones abiertas

| Tema | Decisión actual | Siguiente paso |
|---|---|---|
| Pagos en línea | No integrados | Clip / Mercado Pago / Stripe Checkout para anticipos |
| CFDI | Datos fiscales + recibo | Integrar PAC (Facturama, SW Sapien, Finkoko) |
| WhatsApp | Mock + Cloud API por configuración | Plantillas aprobadas y botones interactivos nativos |
| Recordatorios | Scheduler idempotente (24 h/2 h) | Migrar a Redis + worker para múltiples réplicas |
| Marketing | Segmentos + campañas + plantillas | Cupones únicos, lealtad y atribución |
| IA | Flujo determinista auditable | Predicción de no-show y recomendación de servicios |
| Sucursales | Una por negocio | `Location` + horarios por sucursal |
| Offline | Shell cacheado | IndexedDB + cola de mutaciones |
| Migraciones | `create_all` | Alembic |
