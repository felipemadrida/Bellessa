# Auditoría vs. PROMPT maestro de Micro-SaaS

Esta revisión compara el código con el nuevo [`PROMPT_maestro_micro_SaaS_salon_belleza.pdf`](../PROMPT_maestro_micro_SaaS_salon_belleza.pdf) y con el brief anterior de WhatsApp/marketing. La conclusión es deliberada: **no se migró el stack** a Next.js/Prisma; se conservó la base operativa Python/FastAPI + React/Vite que ya funciona y se incorporaron las mejoras de producto que no exigían reescribirla.

## Matriz de cumplimiento

| Capacidad del prompt | Estado | Evidencia / límite |
|---|---|---|
| Micro-SaaS multi-tenant | ✅ | `business_id` en todas las entidades; registro y login aislados |
| Onboarding con catálogo y horarios | ✅ parcial | Registro crea negocio, horarios y 4 servicios; sin asistente de 3 pasos |
| Roles SUPERADMIN / OWNER / MANAGER / PROFESSIONAL / CLIENT | ⚠️ | SUPERADMIN de plataforma + OWNER/equipo; falta MANAGER/PROFESSIONAL y portal CLIENT |
| Planes Free/Pro/Salon, límites y suscripciones | ⚠️ | Planes, límite de staff y suspensión; sin cobro automático ni límite transaccional de citas |
| Subdominio por salón | ❌ | Página pública por ruta `/reservar/{slug}`; sin wildcard DNS |
| Agenda multi-profesional | ✅ | Disponibilidad, buffers, bloqueos, traslapes, reprogramación y no-show |
| Vista semanal/mensual | ❌ | Vista día; semana/mes en roadmap |
| Lista de espera | ❌ | No implementada |
| WhatsApp híbrido wa.me + Cloud API | ✅ | Enlaces wa.me, simulador y adaptador Cloud API con webhook |
| Bot de captura/confirmación | ✅ | Flujo determinista persistente, comandos y handoff humano |
| Recordatorios 24 h / 2 h | ✅ | Scheduler idempotente |
| Consentimiento opt-in y BAJA | ✅ | `accepts_marketing`, opt-out por bot y omisión de campañas |
| Marketing: cumpleaños, reactivación, reseñas | ✅ parcial | Cumpleaños 7 días antes, win-back 30/60/90, reseña; referidos con código y cupones únicos faltan |
| Fidelización: puntos, VIP, 6ta visita | ✅ parcial | Puntos por gasto, nivel Nueva/Frecuente/VIP, progreso a recompensa; canje y paquetes faltan |
| Paquetes de sesiones | ❌ | Roadmap |
| Reseñas con enlace directo a Google | ❌ | Plantilla de reseña; falta URL/Place ID por salón |
| Programa de referidos con código único | ❌ | Roadmap |
| Métricas y BI | ✅ base | Dashboard del salón + métricas globales de plataforma (tenants, MRR, uso y revenue) |
| Modelo predictivo / IA | ❌ | Flujo determinista; predicción en fase 2 |
| RLS de PostgreSQL | ❌ | Aislamiento por aplicación; RLS pendiente |
| Migraciones versionadas | ⚠️ | `create_all`; Alembic pendiente |
| Rate limiting / idempotencia | ⚠️ | Idempotencia por reglas de negocio; falta rate limit por tenant e Idempotency-Key |
| Logs estructurados / request_id | ⚠️ | Logging de app y scheduler; falta JSON centralizado |
| Docker y despliegue gratuito | ✅ | Compose + nginx, Vercel API/web, Neon y guía Render/Neon/Oracle; Docker no se pudo probar en este entorno |
| Backups | ✅ | Scripts PowerShell/Bash y restauración documentada |
| CI | ✅ | pytest + build frontend |
| Pruebas | ✅ 26 | Auth, aislamiento, agenda, cobros, reportes, bloqueos, bot, webhook, marketing, lealtad, tareas internas y CRUD de Admin SaaS |

## Mejoras implementadas en esta iteración

1. **Bot de WhatsApp** con simulador local, Cloud API, webhook firmado y handoff humano.
2. **Marketing automatizado**: recordatorios 24 h/2 h, cumpleaños 7 días antes, win-back 30/60/90, reseña post-servicio.
3. **Lealtad**: puntos por gasto, nivel VIP por top 20 % de gasto en 12 meses, progreso a la 6ta visita.
4. **Segmentos**: VIP, frecuentes, ocasionales, inactivas 30/60/90 y cumpleaños.
5. **Bandeja de salida** con estados y trazabilidad; campañas con opt-in y auditoría.
6. **Health check con base de datos**, además de WhatsApp/scheduler.
7. **Despliegue Vercel + Neon** con bootstrap, cron externo y guía paso a paso en [`DEPLOY_VERCEL_NEON.md`](DEPLOY_VERCEL_NEON.md).
8. **Admin SaaS híbrido**: superadmin, CRUD de tenants, creación con credenciales temporales, planes Free/Pro/Salón, archivo/restauración, suspensión y métricas globales; tokens separados por scope.
9. **Bloqueos de agenda y bitácora de auditoría** de la iteración previa.
10. **Regla de no-traslape por clienta**, también en reservas públicas y por WhatsApp.

## Brechas priorizadas

| Prioridad | Brecha | Impacto |
|---|---|---|
| P1 | Roles MANAGER/PROFESSIONAL y portal CLIENT | Permisos reales y operación con recepción |
| P1 | Cobro de suscripciones, límite de citas y subdominio por salón | Modelo de negocio SaaS completo |
| P1 | Vista semanal/mensual y lista de espera | Operación diaria y ocupación |
| P2 | Paquetes, canje de puntos, cupones y referidos | Fidelización completa y atribución |
| P2 | RLS, Alembic, rate limit e Idempotency-Key | Producción multi-tenant endurecida |
| P2 | Logs JSON y request_id | Observabilidad |
| P3 | Redis/worker, IA de no-show, Next.js/Prisma | Escala y migración de stack |

## Decisión de stack

El prompt propone Next.js 15 + Prisma + TypeScript. La aplicación actual es FastAPI + React/Vite + SQLAlchemy. Migrar ahora implicaría reescribir autenticación, agenda, caja, WhatsApp y pruebas sin una ganancia funcional inmediata. Se documenta la diferencia y se mantiene una arquitectura por capas (rutas → servicios → datos) con OpenAPI. Si el objetivo es un producto SaaS de plataforma con SSR y RLS, la migración se planifica como una fase separada.

## Veredicto

La aplicación es **operable y demostrable**: agenda, clientas, equipo, caja, reportes, reservas públicas, bloqueos, auditoría, bot de WhatsApp, marketing, segmentos, lealtad y Admin SaaS funcionan contra una base real y tienen pruebas. Quedan explícitos los huecos de plataforma (roles MANAGER/PROFESSIONAL, cobro de suscripciones, subdominios, RLS, waitlist, paquetes/referidos) y no se simulan con botones vacíos.
