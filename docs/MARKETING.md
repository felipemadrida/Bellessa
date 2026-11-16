# Marketing de retención para el salón

Bellessa automatiza lo que más mueve la aguja en un salón pequeño: **que la clienta vuelva y que no falte a su cita**. Todo se apoya en datos que ya viven en la base: última visita, frecuencia, cumpleaños, servicio y consentimiento.

## 1. Consentimiento primero

- Cada ficha tiene `accepts_marketing`.
- Las campañas omiten a quien dijo **BAJA** (el bot la marca automáticamente).
- Los recordatorios de cita son transaccionales y no dependen del consentimiento promocional.
- La plantilla de marketing incluye siempre una vía de baja.
- Meta exige plantillas aprobadas para iniciar conversación fuera de la ventana de 24 h.

## 2. Segmentos disponibles

| Segmento | Regla | Uso |
|---|---|---|
| Todas | Base completa | Anuncios generales y temporada |
| VIP | Top 20% de gasto en 12 meses | Lealtad, upgrades, acceso anticipado |
| Frecuentes | 3+ visitas completadas | Lealtad, upgrades, acceso anticipado |
| Ocasionales | 1–2 visitas completadas | Segundo servicio, paquete de entrada |
| Inactivas 30/60/90 | Sin visita en 30, 60 o 90 días | Win-back escalonado con oferta |
| Cumpleaños hoy | Mismo día/mes | Regalo y reserva de la semana |

La API expone `GET /api/marketing/segments` con conteos y `GET /api/marketing/templates` con las plantillas.

## 3. Automatizaciones activas

El scheduler interno corre cada 5 minutos y es idempotente (no duplica el mismo mensaje):

1. **Recordatorio 24 h** antes de la cita.
2. **Recordatorio 2 h** antes de la cita.
3. **Cumpleaños 7 días antes**, con 15% válido 30 días.
4. **Win-back escalonado** a los 30, 60 y 90 días sin visita.
5. **Reseña** 22–26 h después de una cita completada.

La ficha de cada clienta muestra **puntos** (1 por cada $10 de servicio), **nivel** (Nueva / Frecuente / VIP) y progreso a la recompensa de la 6ta visita. La plantilla `loyalty` puede enviarse manualmente al segmento VIP o frecuentes.

### Campañas manuales

En **WhatsApp & marketing** eliges segmento + plantilla y preparas la campaña. En modo `mock` los mensajes se registran en la bandeja; en modo `cloud` se envían por Meta. La campaña queda en auditoría.

Plantillas incluidas:

- `reminder_24h`
- `reminder_2h`
- `birthday` (día) y `birthday_week` (7 días antes)
- `winback_30`, `winback_60`, `winback_90`
- `valley` (lunes y martes)
- `review`
- `referral` (trae a una amiga, ambas 20% off)
- `seasonal` (temporada / Día de la Madre / fin de año)
- `loyalty` (puntos, nivel y siguiente recompensa)

## 4. Las 5 tácticas que prioriza el producto

1. **No-shows:** dos recordatorios automáticos + confirmación/cancelación por chat. La cita liberada se puede reasignar a lista de espera en la siguiente fase.
2. **Reactivación:** segmento inactivas + oferta de 15% + enlace de reservas.
3. **Upselling / cross-selling:** el menú muestra duración y precio para facilitar la elección; la recomendación automática basada en historial queda como fase 2.
4. **Lealtad:** puntos por gasto, niveles Nueva/Frecuente/VIP y progreso a la 6ta visita; la tarjeta digital y el canje automático están en roadmap.
5. **Cumpleaños y temporada:** automatización mensual + plantillas estacionales con calendario editorial.

## 5. Calendario editorial sugerido

| Mes | Enfoque | Acción de software |
|---|---|---|
| Enero | Año nuevo, nuevo look | Reactivación + reseñas de diciembre |
| Febrero | San Valentín | Paquete de autocuidado / pareja; recordatorios 24 h |
| Marzo | Primavera | Color y tratamiento; segmento frecuentes |
| Abril | Pre-Día de la Madre | Anticipos y paquetes; campaña segmentada |
| Mayo | Día de la Madre | Regalo + cupón para acompañante |
| Junio | Vacaciones | Peinados y uñas; horarios extendidos |
| Julio | Verano | Hidratación y protección; win-back |
| Agosto | Regreso a clases | Cortes prácticos; referidos |
| Septiembre | Independencia | Color; contenido local |
| Octubre | Halloween | Maquillaje temático; lista de espera |
| Noviembre | Buen Fin | Paquetes y bonos; campaña anticipada |
| Diciembre | Fin de año | Novias, posadas y regalos; cierre de agenda |

## 6. Métricas para leer el programa

- Tasa de no-show por mes y por profesional.
- Clientes reactivadas después de una campaña win-back.
- Citas atribuidas a WhatsApp (campo `source`).
- Tasa de respuesta y bajas.
- Ticket promedio de clientas frecuentes vs. ocasionales.
- Ocupación por día/profesional.

Los reportes actuales cubren ingresos, ocupación, comisiones, servicios y clientas; la atribución fina por campaña (cupones/UTM) es la siguiente mejora.

## 7. Límites actuales

- La lealtad se calcula por historial; aún no hay canje ni contador de recompensas canjeadas.
- No hay cupones con código único ni atribución de campaña.
- El scheduler es un hilo interno, suficiente para un salón; a escala se reemplaza por Redis + worker (Celery/RQ/BullMQ).
- El envío Cloud API usa texto; para producción se deben registrar plantillas aprobadas y mapear su nombre.
- La recomendación automática de upselling por historial/IA aún no está implementada; hoy la clienta elige del menú.
