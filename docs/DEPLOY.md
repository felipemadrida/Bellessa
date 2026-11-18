# Despliegue de Bellessa

Todas las piezas son open source y gratuitas: PostgreSQL, FastAPI, React, nginx y Docker. No hay servicios de pago obligatorios.

> En Docker Compose las variables se llaman sin prefijo (`WHATSAPP_PROVIDER`, `JWT_SECRET`). La API las recibe con el prefijo `BELLESSA_`; el compose ya hace esa traducción. En un hosting que ejecute el contenedor directamente, usa los nombres `BELLESSA_*`.

## 1. Variables de entorno

| Variable | Ejemplo | Uso |
|---|---|---|
| `POSTGRES_PASSWORD` | `una-clave-larga` | Contraseña de Postgres en Compose |
| `JWT_SECRET` | `openssl rand -hex 32` | Firma de tokens; **obligatorio cambiarlo** |
| `SEED_DEMO` | `false` en producción | Crea el Salón Demo de demostración |
| `WEB_PORT` | `8090` | Puerto público del frontend |
| `PUBLIC_BASE_URL` | `https://agenda.tusalon.mx` | Links de WhatsApp y página pública |
| `CORS_ORIGINS` | `https://agenda.tusalon.mx` | Orígenes permitidos |
| `CORS_ORIGIN_REGEX` | `https://.*\\.vercel\\.app` | Opcional para previews de Vercel |
| `API_PUBLIC_BASE_URL` | `https://api.tusalon.mx` | URL pública de la API (webhook) |
| `CRON_SECRET` | `...` | Protege `/api/internal/tick` y bootstrap |
| `WHATSAPP_PROVIDER` | `mock` / `cloud` | Simulador local o Meta Cloud API |
| `WHATSAPP_TOKEN` | `EAAG...` | Token de Meta (solo cloud) |
| `WHATSAPP_PHONE_NUMBER_ID` | `123456789` | Phone number ID de Meta |
| `WHATSAPP_VERIFY_TOKEN` | `bellessa-verify` | Verificación del webhook |
| `WHATSAPP_APP_SECRET` | `...` | Firma HMAC del webhook |
| `WHATSAPP_BUSINESS_SLUG` | `salon-lucia` | Negocio que atiende el número |
| `SCHEDULER_ENABLED` | `true` | Recordatorios y campañas automáticas |
| `BELLESSA_DATABASE_URL` | `postgresql+psycopg://...` | Solo si no usas Compose |

Genera el secreto:

```bash
openssl rand -hex 32
# PowerShell: [Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

## 2. Docker Compose en un VPS

Requisitos: Ubuntu 22.04/24.04, 1 GB RAM, Docker + Compose.

```bash
git clone <tu-repo> bellessa
cd bellessa
cp .env.example .env
# edita .env: JWT_SECRET, POSTGRES_PASSWORD, PUBLIC_BASE_URL, SEED_DEMO=false
docker compose up -d --build
docker compose ps
```

Abre `http://IP:8080`.

### HTTPS con Caddy (gratis)

Instala Caddy en el host y usa este `Caddyfile`:

```caddy
agenda.tusalon.mx {
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo caddy run --config /etc/caddy/Caddyfile
```

Caddy obtiene y renueva el certificado TLS automáticamente. Alternativa: Nginx + Certbot.

### Conectar WhatsApp

1. Empieza con `WHATSAPP_PROVIDER=mock` y prueba el simulador del panel.
2. Para Cloud API, configura token, phone ID, verify token y App Secret.
3. En Meta → WhatsApp → Configuration, usa como callback:
   `https://TU-DOMINIO/api/whatsapp/webhook`
4. Suscribe el campo `messages`.
5. Verifica el challenge y manda un mensaje de prueba.

La guía completa, plantillas, flujo del bot y límites de política están en [`WHATSAPP.md`](WHATSAPP.md). En producción el webhook exige HTTPS y `PUBLIC_BASE_URL` debe ser tu dominio real.

### Operación

```bash
docker compose logs -f api
docker compose restart api
docker compose down
```

Respaldo de base:

```bash
docker exec bellessa-db pg_dump -U bellessa bellessa > respaldo-$(date +%F).sql
```

Restauración:

```bash
cat respaldo-2026-11-16.sql | docker exec -i bellessa-db psql -U bellessa -d bellessa
```

## 3. Vercel + Neon + GitHub

Si ya tienes una app de prueba en Vercel y Neon, la ruta más directa es:

- **Frontend** React/Vite en Vercel.
- **API** FastAPI en Vercel (framework preset) o en Render.
- **PostgreSQL** en Neon.
- **Cron** externo gratuito para recordatorios.

La guía exacta, variables, bootstrap y cron está en [`DEPLOY_VERCEL_NEON.md`](DEPLOY_VERCEL_NEON.md).

## 4. Opción administrada gratuita

Arquitectura recomendada para costo cero:

| Pieza | Opción gratuita | Nota |
|---|---|---|
| Frontend | Cloudflare Pages / Netlify / Vercel | Build `npm run build`, salida `dist` |
| API | Render free / Fly.io / Koyeb | Contenedor `backend/`; necesita HTTPS y variables |
| PostgreSQL | Neon free / Supabase free | Usa connection string con `sslmode=require` |
| Archivos | No aplica | Recibos se generan al vuelo |

### API en Render

1. Crea un **Web Service** desde el repo, root `backend/`.
2. Runtime: Docker.
3. Variables: `BELLESSA_DATABASE_URL`, `BELLESSA_JWT_SECRET`, `BELLESSA_CORS_ORIGINS`, `BELLESSA_PUBLIC_BASE_URL`, `BELLESSA_API_PUBLIC_BASE_URL`, `BELLESSA_SEED_DEMO=false`, `BELLESSA_WHATSAPP_PROVIDER`, `BELLESSA_WHATSAPP_TOKEN`, `BELLESSA_WHATSAPP_PHONE_NUMBER_ID`, `BELLESSA_WHATSAPP_VERIFY_TOKEN`, `BELLESSA_WHATSAPP_APP_SECRET`, `BELLESSA_SCHEDULER_ENABLED=true`, `BELLESSA_CRON_SECRET`, `BELLESSA_PLATFORM_ADMIN_EMAIL`, `BELLESSA_PLATFORM_ADMIN_PASSWORD`.
4. Puerto: `8000`.
5. Verifica `https://tu-api.onrender.com/api/health`.

### Frontend en Cloudflare Pages

- Build command: `npm run build`
- Output: `dist`
- Variable `VITE_API_URL=https://tu-api.onrender.com/api`
- Si usas el contenedor nginx incluido, no necesitas `VITE_API_URL`: el proxy `/api` apunta al servicio `api`.

### Postgres en Neon

1. Crea proyecto y base.
2. Copia la cadena `postgresql://usuario:password@host/db?sslmode=require`.
3. Adáptala para SQLAlchemy/psycopg:
   `postgresql+psycopg://usuario:password@host/db?sslmode=require`.
4. Configúrala como `BELLESSA_DATABASE_URL`.

## 5. Respaldos

Incluimos scripts listos para usar:

```bash
# Linux/macOS (PostgreSQL en Docker o SQLite local)
bash scripts/backup.sh

# Windows PowerShell
.\scripts\backup.ps1
```

Los archivos se guardan en `backups/` con fecha y hora. Para automatizar en un VPS:

```cron
30 2 * * * cd /opt/bellessa && ./scripts/backup.sh >> /var/log/bellessa-backup.log 2>&1
```

Restauración de PostgreSQL:

```bash
docker compose exec -T db psql -U bellessa -d bellessa < backups/bellessa-20261116-023000.sql
```

Guarda los respaldos fuera del servidor (otro disco o almacenamiento en la nube) y prueba la restauración al menos una vez al trimestre.

## 6. Integración continua

`.github/workflows/ci.yml` ejecuta en cada push/PR:

- `pytest` del backend con Python 3.12 (SQLite en memoria).
- `npm ci` + `npm run build` del frontend (TypeScript estricto).

Si usas GitHub, no necesitas configurar secretos para el CI. El despliegue a tu nube queda fuera del workflow a propósito para que revises el entorno antes de publicar.

## 7. Checklist de producción

- [ ] `JWT_SECRET` aleatorio y fuera del repo.
- [ ] `SEED_DEMO=false` y base sin datos demo.
- [ ] HTTPS activo; `PUBLIC_BASE_URL` con `https://`.
- [ ] `CORS_ORIGINS` con el dominio real (sin `*`).
- [ ] Respaldos automáticos de Postgres.
- [ ] Monitoreo de `/api/health` y alertas de caída.
- [ ] Límite de intentos de login (proxy o WAF).
- [ ] Política de privacidad y aviso de datos de clientas (LFPDPPP).
- [ ] Rotación de contraseñas del equipo al salir una persona.

## 8. Dominio y PWA

1. Apunta el dominio al proxy (Caddy/Cloudflare).
2. Verifica que `manifest.webmanifest` y `sw.js` respondan 200.
3. En Android/iOS, “Agregar a pantalla de inicio”; se abrirá en modo standalone.
4. El service worker no cachea `/api`: si cambias de backend, la app sigue funcionando.

## 9. Escalar

- Una instancia de API soporta decenas de salones pequeños.
- Varias réplicas: mover el rate limit en memoria a Redis y usar un almacén compartido para locks de agenda.
- Separar reportes pesados a un worker (Celery/RQ) cuando el volumen crezca.
- Añadir CDN para `/assets` si el frontend se sirve estático.
- Si se integra WhatsApp Cloud API, usar webhooks idempotentes y cola de envío.

## 10. Solución de problemas

| Síntoma | Causa probable | Fix |
|---|---|---|
| `502` en `/api` | API no arrancó o DB no está lista | `docker compose logs api db`; esperar healthcheck |
| `CORS error` | Origen no listado | Ajustar `CORS_ORIGINS` |
| Login 401 en producción | `JWT_SECRET` cambió | Volver a iniciar sesión |
| Horas corridas | Zona del salón mal configurada | Revisar `timezone` del negocio (debe ser IANA) |
| PWA con assets viejos | Caché del service worker | Subir versión de `CACHE` en `sw.js` o recargar forzado |
| No aparecen slots | Día cerrado, fuera de ventana o sin horario del staff | Revisar horarios y `booking_window_days` |
