# WhatsApp manual, Cloud API y bot de citas

Bellessa trae tres capas independientes:

| Capa | Uso | Qué hace |
|---|---|---|
| **Manual (default)** | Operación diaria del salón | Prepara el mensaje con datos reales, abre `wa.me`, copia y confirma el envío. No requiere API ni token. |
| `mock` | Demo, pruebas y desarrollo | Registra cada mensaje en la bandeja y simula respuestas del bot. |
| `cloud` | Automatización opcional | Envía textos por Meta Cloud API. Requiere plantillas aprobadas y respetar la ventana de 24 h. |

## 1. Bandeja manual

Ruta: `/whatsapp/manual`.

1. Elige una cita y una plantilla.
2. La app genera el mensaje y lo deja en estado `pending`.
3. **Abrir WhatsApp** usa un enlace `wa.me` y registra `opened`.
4. El operador confirma manualmente el envío → `confirmed` + `sent_at`.
5. Si no se pudo enviar, marca **No enviado** y se registra `failed` con motivo.

Estados: `pending`, `prepared`, `opened`, `confirmed`, `failed`. **Abrir WhatsApp nunca se considera entrega automática.**

Endpoints:

```text
GET  /api/whatsapp/manual
POST /api/whatsapp/manual
POST /api/whatsapp/manual/{id}/prepare
POST /api/whatsapp/manual/{id}/opened
POST /api/whatsapp/manual/{id}/confirm
POST /api/whatsapp/manual/{id}/failed
```

La tabla `message_logs` guarda el cuerpo, teléfono, clienta, cita, estado y error. Es la trazabilidad del envío manual.

## 2. Modos automáticos

Bellessa también conserva dos modos opcionales:

| Modo | Uso | Qué hace |
|---|---|---|
| `mock` (default) | Demo, pruebas y desarrollo | Registra cada mensaje en la bandeja y simula respuestas del bot. No sale a Meta, no gasta conversaciones y no requiere token. |
| `cloud` | WhatsApp real | Envía textos por Meta Cloud API. Para mensajes iniciados por el negocio se necesitan **plantillas aprobadas** y respetar la ventana de 24 h. |

> Empieza siempre en `mock`. Nunca uses automatizaciones no oficiales ni números personales para pruebas masivas: Meta puede restringir el número.

## 3. Variables de entorno

En `backend/.env` (o en tu proveedor cloud):

```env
BELLESSA_WHATSAPP_PROVIDER=mock          # mock | cloud
BELLESSA_WHATSAPP_TOKEN=EAAG...          # token de Meta (solo cloud)
BELLESSA_WHATSAPP_PHONE_NUMBER_ID=123456789
BELLESSA_WHATSAPP_VERIFY_TOKEN=bellessa-verify
BELLESSA_WHATSAPP_APP_SECRET=...         # opcional pero recomendado
BELLESSA_WHATSAPP_BUSINESS_SLUG=salon-lucia
BELLESSA_SCHEDULER_ENABLED=true
BELLESSA_PUBLIC_BASE_URL=https://agenda.tusalon.mx
```

En Docker, usa los equivalentes sin prefijo en `.env` y `docker-compose.yml` los traduce: `WHATSAPP_PROVIDER`, `WHATSAPP_TOKEN`, etc.

## 4. Configurar Meta paso a paso

1. Entra a [Meta for Developers](https://developers.facebook.com/) y crea una app tipo **Business**.
2. Agrega el producto **WhatsApp** y vincula tu número de WhatsApp Business.
3. En **WhatsApp → API Setup**, copia:
   - `Phone number ID` → `BELLESSA_WHATSAPP_PHONE_NUMBER_ID`
   - Token temporal o permanente → `BELLESSA_WHATSAPP_TOKEN`
4. En **WhatsApp → Configuration → Webhook**, configura:
   - Callback URL: `https://TU-DOMINIO/api/whatsapp/webhook`
   - Verify token: el mismo `BELLESSA_WHATSAPP_VERIFY_TOKEN`
   - Suscribe el campo **messages**.
5. En **App Settings → Basic**, copia el **App Secret** a `BELLESSA_WHATSAPP_APP_SECRET` para validar la firma `X-Hub-Signature-256`.
6. Cambia `BELLESSA_WHATSAPP_PROVIDER=cloud`.
7. Para desarrollo local con webhook real, expón el backend con un túnel HTTPS (por ejemplo `cloudflared tunnel --url http://localhost:8011` o ngrok) y usa esa URL en Meta. El simulador no requiere túnel.

### Verificación

```bash
curl "https://TU-DOMINIO/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=123"
# Debe responder: 123
```

Meta reintenta los webhooks. El endpoint responde 200 incluso si el mensaje no se puede procesar para evitar tormentas de reintentos; los errores quedan en logs.

## 5. Flujo del bot

```
Cliente: Hola
Bot:     menú de servicios numerado
Cliente: 1
Bot:     días disponibles + horarios
Cliente: 2026-11-19
Bot:     horarios del día
Cliente: 10:30
Bot:     pide nombre si es nueva / resumen si ya existe
Cliente: SI
Bot:     cita confirmada + código
Recepción: aviso interno en la bandeja
```

Comandos disponibles en cualquier momento:

| Comando | Acción |
|---|---|
| `HUMANO`, `ASESOR`, `RECEPCION` | Pasa a atención humana y avisa al salón. |
| `CANCELAR` | Cancela la próxima cita activa de esa clienta. |
| `REPROGRAMAR` | Libera la cita actual y reinicia la elección de horario. |
| `MENU` | Reinicia el menú. |
| `BAJA`, `STOP` | Desactiva promociones para esa clienta (los recordatorios transaccionales siguen). |

El estado vive en `whatsapp_conversations`, no en memoria: sobrevive reinicios y puede revisarse en la base. La reserva creada por el bot queda **confirmada**, con `source="whatsapp"`, y se registra en auditoría. Si la clienta es nueva, se crea con `accepts_marketing=False`: el bot no presume consentimiento promocional; recepción puede activarlo en la ficha.

## 6. Simulador y bandeja

En el panel **WhatsApp & marketing**:

- El simulador permite escribir con un teléfono de prueba y ver las respuestas.
- La bandeja muestra cada mensaje con estado (`mock sent`, `sent`, `failed`, `skipped`), plantilla y cliente.
- Si una clienta no acepta marketing, los envíos de campaña quedan como `skipped` con el motivo; los recordatorios de cita sí se permiten por ser transaccionales.
- El botón de campaña prepara mensajes según segmento y plantilla.

## 7. Recordatorios y campañas programadas

El hilo interno (`scheduler`) corre cada `BELLESSA_SCHEDULER_INTERVAL_SECONDS` (300 s por defecto) y es idempotente por `dedupe_key`:

- Recordatorio 24 h y 2 h antes de citas pendientes/confirmadas.
- Cumpleaños del día.
- Reactivación de clientas sin visita a 30, 60 o 90 días.
- Solicitud de reseña 22–26 h después de una cita completada.

Ver [MARKETING.md](MARKETING.md) para las plantillas y el calendario editorial.

## 8. Políticas y costos

- La conexión a Cloud API puede tener costo por conversación según el país y la categoría; Meta ofrece un nivel gratuito limitado y cambia las condiciones. Revisa la tarifa vigente antes de producción.
- Los mensajes de **servicio al cliente** dentro de la ventana de 24 h se pueden responder con texto libre. Para iniciar conversación o mandar promociones fuera de esa ventana se necesita una **plantilla aprobada**.
- Bellessa en modo `mock` no envía nada a Meta; es la opción segura para demos y para aprender el flujo.
- No se debe usar la API para spam: respeta el consentimiento, incluye opción de baja y segmenta.

## 9. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| El webhook no valida | Token distinto | Revisa `BELLESSA_WHATSAPP_VERIFY_TOKEN` y reinicia API |
| Meta responde 403 | Firma inválida | Configura el App Secret correcto o vacíalo solo en local |
| Todo queda en mock | Provider en `mock` | Cambia a `cloud` y configura token/phone ID |
| `failed` al enviar | Fuera de ventana 24 h / plantilla no aprobada / token vencido | Usa plantilla aprobada y token vigente |
| No aparecen recordatorios | Scheduler apagado o no hay citas en la ventana | Activa `BELLESSA_SCHEDULER_ENABLED` y prueba el simulador |
| El bot no responde | Número no vinculado o webhook sin campo `messages` | Revisa suscripción del webhook en Meta |
