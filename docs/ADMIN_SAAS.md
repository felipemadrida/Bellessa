# Admin SaaS híbrido

Bellessa tiene dos planos de acceso sobre el mismo despliegue:

```text
┌──────────────────────────────────────────────┐
│  Vercel / Docker                             │
│                                              │
│  /login   → panel operativo del salón        │
│  /admin   → panel de plataforma (superadmin) │
│                                              │
│  FastAPI: /api/* (tenant)                    │
│           /api/platform/* (superadmin)       │
│                                              │
│  Neon/Postgres: businesses, users, citas…    │
│  TenantAccount: plan y estado comercial      │
└──────────────────────────────────────────────┘
```

Es “híbrido” porque el **mismo frontend y la misma API** atienden al salón y a la plataforma, pero con identidades y tokens separados. Un token de salón no abre `/api/platform/*` y un token de plataforma no abre el dashboard del salón.

## Acceso demo

```text
URL:      /admin
Correo:   admin@bellessa.mx
Password: admin1234
```

El acceso se crea solo si `SEED_DEMO=true` o si defines `BELLESSA_PLATFORM_ADMIN_PASSWORD` en producción. **Cambia la contraseña antes de un despliegue real.**

## Qué incluye

- Login independiente de plataforma con JWT `scope=platform`.
- Métricas globales: salones, activos, pruebas, suspendidos, clientas, staff, citas 30 días, ingresos 30 días y MRR estimado.
- Lista de tenants con dueña, slug, plan, estado, uso y revenue.
- Cambio de plan **Free / Pro / Salón**.
- Suspensión y reactivación de un salón.
- Búsqueda por nombre, slug o correo.
- Auditoría de cambios de plan/estado.
- Enlace a la página pública de cada salón.
- Los datos sensibles de clientas no se muestran en la plataforma.

## Planes

| Plan | Precio referencia | Staff | Citas/mes | Marketing |
|---|---:|---:|---:|---|
| Free | $0 | 1 | 50 | No |
| Pro | $299 | 3 | 300 | Sí |
| Salón | $599 | 10 | 2,000 | Sí |

El precio es una referencia configurable en `services/plans.py`; **no hay cobro automático** todavía. El límite de staff sí se aplica al crear integrantes. Los límites de citas se muestran en el panel y quedan pendientes de enforcement transaccional.

## Modelo

- `PlatformAdmin`: superadmin, sin `business_id`.
- `TenantAccount`: plan, estado, trial y notas por salón; separado de los datos operativos.
- `AuditLog`: los cambios de plataforma se registran con `user_id=NULL` y el correo del admin en el detalle.
- `User`: dueña/staff del salón; no se reutiliza para plataforma.

## Endpoints

```text
POST  /api/platform/login
GET   /api/platform/me
GET   /api/platform/overview
GET   /api/platform/tenants
PATCH /api/platform/tenants/{business_id}
GET   /api/platform/plans
```

## Seguridad y límites

- Contraseñas con scrypt; token JWT con expiración.
- Sin impersonación de salones en v1.
- Suspender un tenant bloquea sus endpoints operativos, pero no borra datos.
- No hay RLS de PostgreSQL; el aislamiento sigue siendo por `business_id` en la capa de aplicación.
- No hay cobro, facturación ni conciliación de suscripciones.
- El panel no reemplaza al superadmin de una plataforma grande: es el mínimo operativo para administrar los salones de este proyecto.

## Variables de entorno

```text
BELLESSA_SEED_DEMO=true
BELLESSA_PLATFORM_ADMIN_NAME=Felipe Madrid
BELLESSA_PLATFORM_ADMIN_EMAIL=admin@bellessa.mx
BELLESSA_PLATFORM_ADMIN_PASSWORD=cambia-esto-en-produccion
```
