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

## Acceso

```text
URL: /admin
Correo y contraseña: NO se publican en el repositorio ni en la interfaz.
```

La cuenta se crea al arrancar **solo si** existe `BELLESSA_PLATFORM_ADMIN_PASSWORD`.
Si esa variable no está definida y el entorno es de demo, se genera una
contraseña aleatoria que aparece **una única vez** en el log del servidor.

Para rotar la contraseña de una cuenta que ya existe (el seed no la sobrescribe):

```bash
python backend/scripts/rotate_platform_admin.py <correo>
```

El script pide la nueva contraseña por consola, sin dejarla en el historial.

## Qué incluye

- Login independiente de plataforma con JWT `scope=platform`.
- Métricas globales: salones, activos, pruebas, suspendidos, archivados, clientas, staff, citas 30 días, ingresos 30 días y MRR estimado.
- **CRUD de tenants**:
  - Crear salón + dueña + catálogo inicial + horarios.
  - Editar nombre, slug, dueña, correo, teléfono, ciudad, plan, estado y notas.
  - Archivar (soft delete) y restaurar; los datos se conservan.
  - Cambio rápido de plan **Free / Pro / Salón** y estado.
- Contraseña temporal generada al crear si no se define una; se muestra una sola vez.
- Búsqueda por nombre, slug o correo; filtro de archivados.
- Auditoría de creación, edición, plan, estado y archivo.
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
POST   /api/platform/login
GET    /api/platform/me
GET    /api/platform/overview
GET    /api/platform/tenants?include_archived=true
GET    /api/platform/tenants/{business_id}
POST   /api/platform/tenants
PATCH  /api/platform/tenants/{business_id}
DELETE /api/platform/tenants/{business_id}   # archiva, no borra datos
GET    /api/platform/plans
```

## Seguridad y límites

- Contraseñas con scrypt; token JWT con expiración.
- Sin impersonación de salones en v1.
- Suspender o archivar un tenant bloquea sus endpoints operativos, pero no borra datos.
- **Archivar es el borrado lógico del CRUD.** No existe borrado permanente desde la interfaz para evitar pérdidas accidentales.
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
