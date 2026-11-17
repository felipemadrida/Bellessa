# Auditoría de Micro-App y Prompt de Producción

Este documento cumple dos funciones:

1. Auditar Bellessa como **micro-app** para salones de belleza, con criterio de simplicidad, cercanía y UI/UX moderno.
2. Entregar un **prompt maestro listo para producción** que un agente de desarrollo puede ejecutar sin ambigüedad.

---

## 1. Veredicto experto

Bellessa es una **micro-app operativa real**, no un prototipo. Cubre el flujo completo del salón (agenda → clienta → cita → cobro → caja → reporte) con aislamiento multiempresa, WhatsApp manual, inventario y Admin SaaS.

Como **producto sencillo para una dueña de salón**, hoy está en un punto de tensión: la base de diseño es muy buena, pero **la cantidad de funciones supera lo que una micro-app debería mostrar de entrada**. El riesgo no es técnico, es de **carga cognitiva**.

| Dimensión | Nota | Observación |
|---|:--:|---|
| Simplicidad percibida | **B** | El shell es limpio, pero hay 11 secciones + Admin + WhatsApp manual; sin onboarding que priorice el día. |
| Amigable / confianza | **A−** | Lenguaje cálido en es-MX, estados vacíos y errores con acción; falta deshacer y confirmaciones en destrucciones. |
| UI/UX moderno | **A** | Paleta crema/rosa/ink, Fraunces + Manrope, tarjetas redondeadas, sombras suaves, bottom nav móvil con CTA central. |
| Mobile-first / PWA | **A−** | Manifest correcto, safe-area y bottom nav; sin offline de datos, sin notificaciones push y sin recarga optimista en toda la app. |
| Accesibilidad | **B+** | Labels asociados, `aria-*` y foco visible; falta revisión de contraste y targets en tablas densas. |
| Rendimiento | **B** | Bundle único de ~487 kB JS; sin code-splitting por ruta, sin virtualización de listas ni skeleton global. |
| Seguridad multitenant | **A−** | `business_id` en servidor, JWT con scope, auditoría; RLS y rate-limit siguen pendientes. |
| Operación producción | **A** | Docker, Vercel+Neon, CI, healthcheck, backups, logs y 30 pruebas backend. |

**Conclusión:** la app es la base correcta. Para “sencilla y amigable” falta una capa de **producto**: onboarding de 3 pasos, dashboard que priorice “qué hago ahora”, búsqueda global, y ocultar lo avanzado (inventario, reportes, campañas) en un nivel “Más”.

---

## 2. Hallazgos de auditoría (micro-app)

> Nota de implementación (2026-11-17): ya se aplicaron la **jerarquía de navegación “Hoy / Más”**, la **búsqueda global de clientas**, el **code-splitting por ruta** y el **acento plateado/dorado** sobre la paleta existente. El onboarding y el “Deshacer” siguen en fase 2.

### 2.1 Lo que ya está bien

- **Diseño propio y coherente**: `Fraunces` para títulos, `Manrope` para cuerpo; crema `#FBF7F2`, ink `#251D1B`, rosa `#C2415A`, dorado `#D9A441`.
- **Mobile real**: bottom nav con CTA central `+ Nueva cita`, safe-area insets, PWA instalable con iconos 192/512.
- **Cercanía al salón**: “clientas”, “corte de caja”, “anticipo”, “dueña”; mensajes transaccionales con contexto.
- **Estados vacíos y de error con acción** (Agenda, Inventario, WhatsApp, Reportes).
- **Trazabilidad**: auditoría, `message_logs`, `stock_movements`, estados de WhatsApp manual.
- **Sin placeholders**: todo botón conectado a API y persistencia.

### 2.2 Grietas a corregir antes de venderlo como “sencillo”

| # | Severidad | Hallazgo | Corrección propuesta |
|---|---|---|---|
| 1 | Alta | 11+ secciones visibles sin jerarquía | Nav primaria de 4 (Inicio, Agenda, Caja, Más); el resto en “Más” según rol |
| 2 | Alta | Dashboard lleno de métricas | Reducir a 3 acciones del día + 1 métrica estrella; mover el resto a Reportes |
| 3 | Alta | No hay onboarding tras el registro | Asistente de 3 pasos: horario → servicio estrella → enlace de reservas |
| 4 | Media | Bundle único ~487 kB | Code-splitting por ruta con `React.lazy` + precarga |
| 5 | Media | Sin búsqueda global | Buscar clienta desde cualquier pantalla |
| 6 | Media | Sin deshacer | Toast con “Deshacer” para cita cancelada, cobro y movimiento de stock |
| 7 | Media | Sin PWA offline | Service worker con shell + cola de escritura offline para citas/cobros |
| 8 | Media | Tablas densas en móvil | Tarjetas por defecto; tablas solo en `lg` |
| 9 | Baja | Contraste de dorado sobre crema | Auditar AA en textos pequeños y badges |
| 10 | Baja | Sin notificaciones push locales | Recordatorio local 2 h antes (Web Push) como fase 2 |

### 2.3 Criterios de “micro-app” que deben respetarse

1. **Una pantalla = un objetivo.** El usuario debe saber qué hacer en 3 segundos.
2. **Lo frecuente a un toque; lo raro a dos.** Cita nueva, cobro y ver agenda en la raíz.
3. **No mostrar datos que no pidan una acción.** Las métricas globales van a Reportes, no al inicio.
4. **El idioma es de salón, no de software.** Nada de “endpoint”, “tenant”, “404”.
5. **Confianza antes que automatización.** WhatsApp manual primero; la nube es opcional.

---

## 3. Prompt maestro de producción

> Pega este bloque como instrucción inicial para construir **BEAUTYHUB / Bellessa** desde cero o para consolidar la versión actual en un producto simple.

```text
Construye una micro-app SaaS multiempresa para salones de belleza en México,
sencilla, cálida y mobile-first. La dueña debe poder operar el salón sin
manual de instrucciones.

STACK OBLIGATORIO
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + React Query.
- Backend: FastAPI + SQLAlchemy 2 + Pydantic v2 + PostgreSQL.
- Seguridad: JWT con scope de salón, scrypt o Argon2, tenant_id en todas
  las entidades, filtros por servidor y auditoría.
- Infraestructura: Docker Compose local; producción en Vercel (front) +
  Neon (Postgres) + GitHub Actions. Sin servicios de pago obligatorios.

REGLAS DE PRODUCTO
1. App funcional, sin placeholders ni botones decorativos.
2. Precios y stock en centavos; moneda MXN; zona horaria America/Mexico_City.
3. Idioma es-MX: "clientas", "corte de caja", "anticipo", "dueña".
4. WhatsApp manual sin API: enlaces wa.me, copiar mensaje, estados
   pending/prepared/opened/confirmed/failed. Abrir WhatsApp NUNCA equivale
   a enviado; solo el operador confirma.
5. Mobile-first: bottom nav de 4 items + CTA central, safe-area, PWA
   instalable con iconos 192/512 y modo offline para lectura.

ARQUITECTURA DE INFORMACIÓN
- Inicio: saludo por franja horaria, resumen mínimo y "¿qué hago ahora?".
- Agenda: día como unidad; crear, reagendar, cancelar, no-show.
- Cobro: flujo cita → pago → recibo → caja, con propina separada.
- Más: clientas, servicios, equipo, inventario, reportes, WhatsApp,
  configuración. Lo avanzado se oculta detrás de "Más".

UI/UX MODERNO
- Tipografía: Fraunces para títulos, Manrope para cuerpo.
- Paleta cálida: crema, ink, rosa y dorado como acento.
- Tarjetas redondeadas, sombras suaves, estados vacíos con acción y
  errores en lenguaje humano con botón de reintento.
- Acciones frecuentes a un toque; confirmar solo lo destructivo; ofrecer
  "Deshacer" en cancelación de citas y movimientos de stock.

CALIDAD MÍNIMA
- Pruebas backend ≥ 80% en reglas críticas y aislamiento multitenant.
- TypeScript estricto y build limpio.
- Lighthouse: LCP < 2.5s, CLS < 0.1, botones ≥ 44px, contraste AA.
- Code-splitting por ruta; bundle inicial < 250 kB gzip.
- 30 pruebas de integración mínimas, incluyendo aislamiento entre salones.

ENTREGABLES
- Código frontend + backend + migraciones + Swagger.
- Docker Compose y guía de despliegue (local + Vercel/Neon).
- Manual de operación en es-MX y checklist de respaldo/recuperación.
- Informe por fase: endpoints, tablas, pruebas y estado de aceptación.

NO HACER
- No migrar a microservicios en v1.
- No agregar IA generativa ni automatizaciones no oficiales de WhatsApp.
- No mostrar datos de otros salones; validar pertenencia en cada consulta.
- No guardar datos operativos solo en el frontend.
- No avanzar de fase sin pruebas verdes.

EMPIEZA POR
1. Fase 0: arquitectura y modelo de datos.
2. Fase 1: registro, login, tenant y aislamiento.
3. Fase 2: onboarding de 3 pasos y agenda día.
4. Después: cobro, clientas, WhatsApp manual, reportes y configuración.
```

---

## 4. Checklist de aceptación de producción

- [ ] El salón se registra, entra y ve su agenda sin leer documentación.
- [ ] Crear, reagendar y cancelar una cita funciona en móvil y no rompe el cobro.
- [ ] Dos salones no pueden leer los datos del otro (prueba automatizada).
- [ ] Un cobro se refleja en caja, recibo y reportes; no se duplica al reintentar.
- [ ] WhatsApp prepara el mensaje y abre `wa.me`; el envío solo lo confirma el operador.
- [ ] PWA instala en Android/iOS y conserva la sesión.
- [ ] Los botones táctiles miden ≥ 44 px y el contraste alcanza AA.
- [ ] El bundle inicial pesa < 250 kB gzip y el LCP es < 2.5 s.
- [ ] Existe guía de respaldo y restauración de PostgreSQL.
- [ ] No hay credenciales ni secretos en el repositorio.

---

## 5. Resumen de recomendación

1. **Consolidar la raíz en 4 secciones** y mover lo avanzado a “Más”. *(aplicado)*
2. **Añadir onboarding de 3 pasos** tras el registro.
3. **Añadir búsqueda global de clientas** *(aplicada)* y toast de “Deshacer” *(pendiente)*.
4. **Dividir el bundle** *(aplicado)* y **virtualizar listas largas** *(pendiente)*.
5. **Convertir el WhatsApp manual en el flujo por defecto** (ya está construido) y dejar Cloud API como opción avanzada.
6. **Mantener el monolito modular**; no microservicios en v1.

Con esto, Bellessa pasa de “plataforma completa” a **micro-app sencilla y amigable** sin perder la potencia que ya tiene.
