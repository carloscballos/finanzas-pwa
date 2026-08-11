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
- `GET/POST/PATCH/DELETE /api/v1/transactions` — movimientos (ingreso/gasto), filtrables por `accountId`/`categoryId`/`type`
- `GET/POST/PATCH/DELETE /api/v1/budgets` — presupuesto por categoría de gasto + periodo (semanal/mensual), con `spent`/`remaining`/`percentUsed` calculados sobre el periodo actual
- `GET/POST/PATCH/DELETE /api/v1/goals` + `POST /api/v1/goals/:id/contributions` — metas de ahorro, opcionalmente ligadas a una cuenta, con aportes/retiros
- `GET/POST/DELETE /api/v1/debts` — deudas entre dos usuarios reales (por email), independientes de las cuentas
- `POST /api/v1/debts/:id/mark-paid` — cualquiera de las dos partes la marca como pagada (queda `PAID_PENDING_CONFIRMATION`)
- `POST /api/v1/debts/:id/confirm` / `POST /api/v1/debts/:id/reject` — solo la parte que **no** la marcó como pagada puede confirmar (→ `SETTLED`) o rechazar (vuelve a `PENDING`)
- `DELETE /api/v1/accounts/:id/members/:userId` — quitar un miembro (el owner quita a otros; un miembro puede salir él mismo; el owner no puede ser eliminado)
- `GET/POST /api/v1/account-invitations` — sin `accountId`: mis invitaciones recibidas. Con `?accountId=`: las que envió esa cuenta (solo el owner). `POST` invita por email (debe ser un usuario ya registrado; no se envía ningún correo, la invitación aparece dentro de la app)
- `POST /api/v1/account-invitations/:id/accept` / `.../decline` / `.../cancel` — el invitado acepta o rechaza; el owner puede cancelar mientras esté `PENDING`. Aceptar crea la membresía de forma atómica (transacción)
- `GET/POST/PATCH/DELETE /api/v1/recurring-transactions` — plantillas de ingreso/gasto que se generan solas cada periodo (semanal/quincenal/mensual/anual)
- `GET /api/v1/forecast/summary` — flujo de caja mensual proyectado por moneda, a partir de los recurrentes activos
- `GET /api/v1/forecast/budget-suggestions` — sugerencia de presupuesto por categoría según el gasto real promedio de los últimos 3 meses completos

Cada cuenta tiene una o más membresías (`AccountMember`, roles `OWNER`/`MEMBER`). Una cuenta personal es simplemente una cuenta con un único miembro. Las cuentas compartidas ya funcionan de punta a punta: invitar por email → aceptar/rechazar → transactar juntos → salir/quitar miembros. Categorías, presupuestos y metas siguen siendo por usuario (no compartidos entre miembros de una cuenta todavía — cada quien categoriza sus propios movimientos aunque estén en la misma cuenta). Las deudas son inherentemente entre dos usuarios (`creditorId`/`debtorId` son usuarios reales), pero requieren que la otra persona ya tenga cuenta — no hay invitación a alguien sin registrar.

## Moneda

Default **COP**, con **USD** también soportado en cuentas, deudas, presupuestos y metas (`CurrencyCode` enum en `common/currency.ts`, validado en cada DTO — no es texto libre). Reglas:

- **Cuentas** y **deudas**: moneda explícita al crear (default COP).
- **Presupuestos**: tienen su propia moneda; `spent` solo suma transacciones de cuentas en esa misma moneda, así un presupuesto "Comida" en COP y otro "Comida" en USD no se mezclan (unique constraint incluye `currency`, así que puedes tener ambos para la misma categoría/periodo).
- **Metas**: si están ligadas a una cuenta, heredan su moneda automáticamente (ignora cualquier moneda que mande el cliente, y se re-deriva si cambias la cuenta ligada); si son independientes, se elige moneda al crear (default COP).

## Movimientos recurrentes y proyección

Un `RecurringTransaction` es una plantilla (cuenta, categoría, monto, frecuencia, fecha de inicio) que un scheduler (`@nestjs/schedule`, `RecurringTransactionsScheduler`) convierte en `Transaction` reales de forma automática:

- Corre una vez al iniciar el servidor y luego todos los días a la 1am (`@Cron`).
- Si una plantilla lleva tiempo vencida (servidor apagado, o `startDate` en el pasado al crearla), genera **todas** las ocurrencias atrasadas de una sola vez (tope de 60 por seguridad) y avanza `nextRunDate` — no genera duplicados ni salta ocurrencias.
- Generar los movimientos y avanzar `nextRunDate` ocurre en una sola transacción de BD, así nunca quedan desalineados.
- Al crear una plantilla ya vencida, la primera ocurrencia se genera al instante (no espera al cron).

**Frecuencias**: semanal (+7 días), **quincenal** (días 15 y último del mes — el ciclo de nómina típico en Colombia, *no* un intervalo fijo de 14 días; ver `recurrence.util.ts`), mensual y anual (con ajuste de fin de mes: 31 ene + 1 mes → 28/29 feb).

La proyección (`/forecast`) no usa IA ni modelos — son dos cálculos transparentes y auditables:
- **Resumen mensual**: suma de los recurrentes activos por moneda (semanal ×52/12, quincenal ×2, anual ÷12, mensual tal cual).
- **Sugerencias de presupuesto**: promedio de gasto real por categoría/moneda en los últimos 3 meses **completos** (excluye el mes en curso, que está a medias), con un botón para crear el presupuesto sugerido en un clic.

## Estado actual

- ✅ Esqueleto: backend, frontend y base de datos corriendo end-to-end
- ✅ Auth (registro/login con JWT) + Cuentas (CRUD, multi-cuenta por usuario, aisladas entre usuarios, balance en vivo)
- ✅ Categorías (con protección al borrar), Transacciones (ingreso/gasto), Presupuestos (con progreso real), Metas de ahorro (con aportes)
- ✅ Deudas entre dos usuarios con flujo de aprobación (marcar pagada → confirmar/rechazar por la otra parte)
- ✅ Cuentas compartidas: invitar por email, aceptar/rechazar, transactar en conjunto, salir/quitar miembros
- ✅ Movimientos recurrentes (generación automática vía cron) + Proyección (resumen mensual y sugerencias de presupuesto)
- ⏳ Pendiente: categorías/presupuestos/metas compartidos entre miembros de una cuenta (hoy cada quien sigue viendo solo los suyos)
