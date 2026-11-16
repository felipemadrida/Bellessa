# Despliegue con GitHub + Vercel + Neon

> Instancia de demostración ya desplegada:
> - Web: https://bellessa-web.vercel.app
> - Admin SaaS: https://bellessa-web.vercel.app/admin
> - API: https://bellessa-api.vercel.app/api/docs
> - Repo: https://github.com/felipemadrida/Bellessa

Sí se puede usar tu app de prueba. La forma más simple y gratuita es:

```text
GitHub (código + CI)
   │
   ├── Vercel · frontend React/Vite   →  https://tu-salon.vercel.app
   ├── Vercel · API FastAPI           →  https://tu-api.vercel.app
   └── Neon · PostgreSQL              →  base administrada
```

Vercel ejecuta FastAPI como función serverless (framework preset). El scheduler persistente **no** corre en serverless: se desactiva y se usa `/api/internal/tick` con Vercel Cron o cron-job.org cada 15 minutos.

> Si el agente no ve tus sesiones, autentica **la CLI** (no solo el navegador) y crea `.env.deploy` desde `.env.deploy.example`. La guía asume que `vercel whoami` y `gh auth status` funcionan en esta misma máquina.

## 1. GitHub

1. Crea el repositorio y sube el proyecto.
2. El workflow `.github/workflows/ci.yml` ejecuta pytest y build del frontend.
3. Vercel se conecta al mismo repo; cada push crea un Preview y el merge a `main` produce Production.

## 2. Neon

1. Crea un proyecto en [Neon](https://neon.tech).
2. Copia la connection string **pooled**.
3. Asegúrate de incluir `sslmode=require`:
   ```text
   postgresql+psycopg://USUARIO:PASSWORD@HOST/neondb?sslmode=require
   ```
   Si el proveedor entrega `postgres://`, cambia el esquema a `postgresql+psycopg://`.
4. No uses la URL de la base local ni SQLite en Vercel.

## 3. API en Vercel

1. **Add New → Project → Import Git Repository**.
2. Root Directory: `backend`.
3. Framework Preset: **FastAPI** (Vercel debe detectar `main.py` y `requirements.txt`).
4. Build Command: dejar el detectado; Output: no aplica.
5. Environment Variables:

| Variable | Valor |
|---|---|
| `BELLESSA_DATABASE_URL` | connection string de Neon |
| `BELLESSA_JWT_SECRET` | secreto largo y aleatorio |
| `BELLESSA_SEED_DEMO` | `true` solo para demo; `false` en producción |
| `BELLESSA_CORS_ORIGINS` | `https://tu-salon.vercel.app` |
| `BELLESSA_CORS_ORIGIN_REGEX` | opcional: `https://.*\.vercel\.app` para previews |
| `BELLESSA_PUBLIC_BASE_URL` | `https://tu-salon.vercel.app` |
| `BELLESSA_API_PUBLIC_BASE_URL` | `https://tu-api.vercel.app` |
| `BELLESSA_CRON_SECRET` | secreto para tareas internas |
| `CRON_SECRET` | el mismo secreto (lo usa Vercel Cron) |
| `BELLESSA_WHATSAPP_PROVIDER` | `mock` inicialmente |
| `BELLESSA_WHATSAPP_VERIFY_TOKEN` | token del webhook |
| `BELLESSA_SCHEDULER_ENABLED` | **`false`** en Vercel |
| `BELLESSA_PLATFORM_ADMIN_NAME` | Nombre del superadmin |
| `BELLESSA_PLATFORM_ADMIN_EMAIL` | Correo del superadmin (no el demo en producción) |
| `BELLESSA_PLATFORM_ADMIN_PASSWORD` | Contraseña larga del superadmin |

6. Deploy.
7. Inicializa tablas/datos una vez:
   ```bash
   curl -X POST https://tu-api.vercel.app/api/internal/bootstrap \
     -H "Authorization: Bearer TU_CRON_SECRET"
   ```
   Debe responder `{"ok":true,"seeded":true}` la primera vez.
8. Verifica:
   ```bash
   curl https://tu-api.vercel.app/api/health
   # {"status":"ok","database":"ok",...}
   ```

### Cron en Vercel

`backend/vercel.json` declara un cron diario a las 15:00 UTC para tareas de marketing. En Hobby la frecuencia puede estar limitada. Para recordatorios de 24 h/2 h crea un cron gratuito en [cron-job.org](https://cron-job.org) cada 15 minutos:

- URL: `https://tu-api.vercel.app/api/internal/tick`
- Método: `POST`
- Header: `Authorization: Bearer TU_CRON_SECRET`

Alternativa: Vercel Pro permite crons más frecuentes. El endpoint es idempotente por `dedupe_key`, así que varias ejecuciones no duplican mensajes.

## 4. Frontend en Vercel

1. **Add New → Project** con el mismo repo.
2. Root Directory: `frontend`.
3. Framework Preset: **Vite**.
4. Build: `npm run build`; Output: `dist` (`frontend/vercel.json` ya lo declara).
5. Variable:
   ```text
   VITE_API_URL=https://tu-api.vercel.app/api
   ```
6. Deploy.
7. Vuelve a la API y confirma que `BELLESSA_CORS_ORIGINS` tenga exactamente el dominio web.
8. Prueba login demo, agenda y `/whatsapp`.

> Si el frontend se despliega antes de conocer el dominio final, actualiza CORS y `PUBLIC_BASE_URL` y redeploy la API.

## 5. WhatsApp en Vercel

1. En Meta → WhatsApp → Configuration:
   - Callback URL: `https://tu-api.vercel.app/api/whatsapp/webhook`
   - Verify token: `BELLESSA_WHATSAPP_VERIFY_TOKEN`
2. Suscribe `messages`.
3. Configura `BELLESSA_WHATSAPP_PROVIDER=cloud`, token, phone ID y App Secret.
4. Empieza con `mock` para probar el simulador sin tocar Meta.

La guía completa está en [WHATSAPP.md](WHATSAPP.md).

## 6. Limitaciones de Vercel para este proyecto

- **Sin scheduler persistente:** el hilo de recordatorios se desactiva; usa cron externo.
- **Cold starts y timeout:** las consultas son rápidas, pero el primer request puede tardar.
- **Sin SQLite ni disco persistente:** Neon es obligatorio.
- **Funciones serverless:** no uses `BELLESSA_SCHEDULER_ENABLED=true`.
- **WhatsApp webhook:** la API debe ser HTTPS; Vercel lo da.
- **Docker** sigue siendo la opción para un VPS o para desarrollo local.

## 7. Checklist de aceptación

- [ ] `/api/health` responde `database: ok`.
- [ ] `/api/internal/bootstrap` creó tablas.
- [ ] Login demo funciona desde el dominio web.
- [ ] Agenda y reserva pública cargan.
- [ ] `/whatsapp` muestra el simulador mock.
- [ ] Cron externo llama `/api/internal/tick` sin 401.
- [ ] `CRON_SECRET` no está en el repo.
- [ ] CORS no usa `*`.
