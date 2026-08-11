# Finanzas PWA

App de finanzas personales: PWA responsive (instalable en desktop, iOS, Android, iPad) + backend con API documentada en Swagger.

> ¿Vas a seguir desarrollando esto (tú o una sesión de Claude)? Lee primero [CLAUDE.md](CLAUDE.md) — tiene convenciones del código, gotchas del entorno ya resueltos, usuarios de prueba y qué falta por hacer.

## Stack

- **Backend**: NestJS, PostgreSQL (Prisma), Swagger/OpenAPI, logging estructurado (pino), validación de config (Joi)
- **Frontend**: React + Vite, PWA (manifest + service worker vía `vite-plugin-pwa`)
- **Monorepo**: npm workspaces + Turborepo

## Estructura

```
finanzas-pwa/
├── apps/
│   ├── api/     # NestJS backend
│   └── web/     # React + Vite PWA frontend
├── packages/
│   └── shared/  # (vacío por ahora — tipos/DTOs compartidos a futuro)
├── docker-compose.yml   # PostgreSQL local
└── turbo.json
```

## Requisitos

- Node.js 24 (gestionado con `nvm`, ver `nvm use`)
- Docker Desktop (para PostgreSQL local)

## Cómo correr el proyecto

```bash
# 1. Levantar PostgreSQL
docker compose up -d postgres

# 2. Instalar dependencias (desde la raíz)
npm install

# 3. Levantar backend y frontend juntos
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Swagger: http://localhost:3000/docs
- Health check: http://localhost:3000/health

## Variables de entorno

- `apps/api/.env` — ver `.env.example` (DATABASE_URL, PORT, CORS_ORIGIN, LOG_LEVEL, JWT_SECRET, JWT_EXPIRES_IN)
- `apps/web/.env` — ver `.env.example` (VITE_API_URL)

## API

Todos los endpoints de negocio viven bajo `/api/v1/...` (versionado desde el día uno). `/health` es la excepción, sin prefijo ni versión, para monitoreo.

- `POST /api/v1/auth/register` — crear usuario, devuelve JWT
- `POST /api/v1/auth/login` — iniciar sesión, devuelve JWT
- `GET /api/v1/auth/me` — usuario autenticado actual
- `GET/POST /api/v1/accounts` — listar / crear cuentas del usuario autenticado (`currentBalance` se calcula en vivo: `initialBalance` + ingresos − gastos)
- `GET/PATCH/DELETE /api/v1/accounts/:id` — operar sobre una cuenta (solo el propietario puede editar/eliminar)
- `GET/POST/PATCH/DELETE /api/v1/categories` — categorías propias del usuario (ingreso o gasto); borrar falla con 409 si está en uso
- `GET/POST/PATCH/DELETE /api/v1/transactions` — movimientos (ingreso/gasto), filtrables por `accountId`/`categoryId`/`type`. Cada movimiento expone `createdBy` (quién lo registró — relevante en cuentas compartidas). Las patas de una transferencia (`transferId` no nulo) no se pueden editar/eliminar aquí directamente (400) — ver `/transfers`
- `GET/POST/PATCH/DELETE /api/v1/budgets` — presupuesto por categoría de gasto + periodo (semanal/mensual), con `spent`/`remaining`/`percentUsed` calculados sobre el periodo actual
- `GET/POST/PATCH/DELETE /api/v1/goals` + `POST /api/v1/goals/:id/contributions` — metas de ahorro, opcionalmente ligadas a una cuenta, con aportes/retiros
- `GET/POST/DELETE /api/v1/debts` — deudas entre dos usuarios reales (por email), independientes de las cuentas
- `POST /api/v1/debts/:id/mark-paid` — cualquiera de las dos partes la marca como pagada (queda `PAID_PENDING_CONFIRMATION`)
- `POST /api/v1/debts/:id/confirm` / `POST /api/v1/debts/:id/reject` — solo la parte que **no** la marcó como pagada puede confirmar (→ `SETTLED`) o rechazar (vuelve a `PENDING`)
- `DELETE /api/v1/accounts/:id/members/:userId` — quitar un miembro (el owner quita a otros; un miembro puede salir él mismo; el owner no puede ser eliminado)
- `GET/POST /api/v1/account-invitations` — sin `accountId`: mis invitaciones recibidas. Con `?accountId=`: las que envió esa cuenta (solo el owner). `POST` invita por email (debe ser un usuario ya registrado; no se envía ningún correo, la invitación aparece dentro de la app)
- `POST /api/v1/account-invitations/:id/accept` / `.../decline` / `.../cancel` — el invitado acepta o rechaza; el owner puede cancelar mientras esté `PENDING`. Aceptar crea la membresía de forma atómica (transacción)
- `GET/POST/PATCH/DELETE /api/v1/recurring-transactions` — plantillas de ingreso/gasto que el usuario aplica manualmente cuando quiere (no hay generación automática)
- `POST /api/v1/recurring-transactions/:id/apply` — aplica la plantilla: crea el movimiento real, con monto/nota/fecha editables antes de guardar
- `GET /api/v1/forecast/summary` — flujo de caja mensual proyectado por moneda, a partir de las plantillas recurrentes activas
- `GET /api/v1/forecast/budget-suggestions` — sugerencia de presupuesto por categoría según el gasto real promedio de los últimos 3 meses completos
- `GET /api/v1/users/search?q=` — buscar usuarios por email/nombre (mínimo 2 caracteres), para agregar amigos, invitar a una cuenta, o crear una deuda; marca `isFriend` y ordena amigos primero
- `GET/DELETE /api/v1/friends` / `/friends/:userId` — mis amigos / dejar de serlo
- `GET /api/v1/friends/requests/received` / `/sent` — solicitudes de amistad pendientes
- `POST /api/v1/friends/requests` — enviar solicitud por email; `.../:id/accept` / `.../decline` / `.../cancel`
- `GET /api/v1/exchange-rates/usd-cop` — tasa de cambio USD/COP actual (TRM oficial del Banco de la República, cacheada), para previsualizar transferencias entre monedas
- `GET/POST/DELETE /api/v1/transfers` — transferir dinero entre dos cuentas donde eres miembro (`?accountId=` para listar); si las monedas difieren, usa la tasa automática o una manual (`exchangeRate` en el body); eliminar borra los dos movimientos asociados

Cada cuenta tiene una o más membresías (`AccountMember`, roles `OWNER`/`MEMBER`). Una cuenta personal es simplemente una cuenta con un único miembro. Las cuentas compartidas ya funcionan de punta a punta: invitar por email → aceptar/rechazar → transactar juntos → salir/quitar miembros. Categorías, presupuestos y metas siguen siendo por usuario (no compartidos entre miembros de una cuenta todavía — cada quien categoriza sus propios movimientos aunque estén en la misma cuenta). Las deudas son inherentemente entre dos usuarios (`creditorId`/`debtorId` son usuarios reales), pero requieren que la otra persona ya tenga cuenta — no hay invitación a alguien sin registrar. Los amigos son solo una sugerencia en los buscadores (por email/nombre) de deudas, invitaciones y agregar amigos — no dan ningún permiso ni acceso.

## Moneda

Default **COP**, con **USD** también soportado en cuentas, deudas, presupuestos y metas (`CurrencyCode` enum en `common/currency.ts`, validado en cada DTO — no es texto libre). Reglas:

- **Cuentas** y **deudas**: moneda explícita al crear (default COP).
- **Presupuestos**: tienen su propia moneda; `spent` solo suma transacciones de cuentas en esa misma moneda, así un presupuesto "Comida" en COP y otro "Comida" en USD no se mezclan (unique constraint incluye `currency`, así que puedes tener ambos para la misma categoría/periodo).
- **Metas**: si están ligadas a una cuenta, heredan su moneda automáticamente (ignora cualquier moneda que mande el cliente, y se re-deriva si cambias la cuenta ligada); si son independientes, se elige moneda al crear (default COP).

## Movimientos recurrentes y proyección

Un `RecurringTransaction` es una **plantilla pura** (cuenta, categoría, tipo, monto, nota, frecuencia informativa) — no hay cron ni generación automática. El usuario la aplica cuando quiere con `POST /recurring-transactions/:id/apply`, pudiendo editar monto/nota/fecha antes de guardar; eso crea un `Transaction` real ligado a la plantilla y actualiza `lastAppliedAt`. Al crear un movimiento normal, el frontend puede además guardarlo como plantilla (checkbox + frecuencia) — son dos llamadas independientes, no atómicas: si falla la segunda, el movimiento ya registrado no se deshace.

`active` en una plantilla ya no significa "sigue generando" (no genera nada) sino "cuenta en la proyección mensual de `/forecast`".

**Frecuencias** (solo informativas, usadas por la proyección): semanal (×52/12 al mes), **quincenal** (×2 — el ciclo de nómina típico en Colombia, *no* un intervalo fijo de 14 días), mensual y anual (÷12).

La proyección (`/forecast`) no usa IA ni modelos — son dos cálculos transparentes y auditables:
- **Resumen mensual**: suma de las plantillas activas por moneda (semanal ×52/12, quincenal ×2, anual ÷12, mensual tal cual).
- **Sugerencias de presupuesto**: promedio de gasto real por categoría/moneda en los últimos 3 meses **completos** (excluye el mes en curso, que está a medias), con un botón para crear el presupuesto sugerido en un clic.

## Transferencias entre cuentas

Una `Transfer` mueve dinero entre dos cuentas donde el usuario es miembro (pueden ser compartidas, no solo propias). Se materializa como dos `Transaction` sin categoría (`EXPENSE` en origen, `INCOME` en destino) ligadas por `transferId`, así el balance de cada cuenta —que ya suma `Transaction` por `type`— las contabiliza sin lógica adicional. Si origen y destino tienen la misma moneda, `toAmount = fromAmount`; si no, se usa la tasa automática (`/exchange-rates/usd-cop`, TRM oficial del Banco de la República vía datos.gov.co, cacheada 6h — se publica una vez al día, no es un mercado en vivo) o una tasa manual que el usuario puede ingresar. Eliminar una transferencia borra sus dos movimientos.

## Amigos

Un `FriendRequest` es una solicitud mutua (mismo patrón que invitar a una cuenta): se envía por email, la otra persona acepta o rechaza. "Ser amigos" se deriva de que exista una solicitud `ACCEPTED` entre los dos, en cualquier dirección — no hay una tabla de amistad separada. Los amigos no obtienen ningún permiso ni acceso especial: solo aparecen primero (marcados con `isFriend`) en `/users/search`, usado como autocomplete al crear una deuda, invitar a una cuenta, o agregar un nuevo amigo.

## Estado actual

- ✅ Esqueleto: backend, frontend y base de datos corriendo end-to-end
- ✅ Auth (registro/login con JWT) + Cuentas (CRUD, multi-cuenta por usuario, aisladas entre usuarios, balance en vivo)
- ✅ Categorías (con protección al borrar), Transacciones (ingreso/gasto, con quién las registró), Presupuestos (con progreso real), Metas de ahorro (con aportes)
- ✅ Deudas entre dos usuarios con flujo de aprobación (marcar pagada → confirmar/rechazar por la otra parte)
- ✅ Cuentas compartidas: invitar por email, aceptar/rechazar, transactar en conjunto, salir/quitar miembros
- ✅ Movimientos recurrentes como plantillas de aplicación manual (sin cron) + Proyección (resumen mensual y sugerencias de presupuesto)
- ✅ Amigos (solicitud mutua) usados como sugerencia en los buscadores de usuario
- ✅ Transferencias entre cuentas, con conversión de moneda (tasa automática TRM o manual)
- ✅ Home (`/`): resumen de saldos, proyección, presupuestos en riesgo, metas, deudas pendientes, solicitudes pendientes y movimientos recientes
- ⏳ Pendiente: categorías/presupuestos/metas compartidos entre miembros de una cuenta (hoy cada quien sigue viendo solo los suyos)
