# CLAUDE.md — Finanzas PWA

Contexto para retomar el desarrollo en otra sesión. Para stack, estructura, setup y referencia de API, ver [README.md](README.md) — no se duplica aquí.

## ⚠️ Estado del repo

Hay un commit inicial (`Initial commit`) con todo lo que existía hasta ahí. Las 5 mejoras de la sección siguiente (quién hizo el movimiento, recurrentes simplificados, amigos, transferencias, home) están implementadas y verificadas end-to-end pero **sin commitear** — quedaron así a propósito (solo se commitea cuando el usuario lo pide explícitamente). Antes de seguir tocando código, vale la pena confirmar con el usuario si ya quiere ese commit.

## Cómo retomar

```bash
cd ~/Documents/personal-projects/finanzas-pwa
docker compose up -d postgres
npm install   # si es una sesión/máquina nueva
npm run dev   # backend :3000 (Swagger en /docs) + frontend :5173
```

Requiere Node 24 (`nvm alias default` ya está en 24 a nivel de sistema en esta máquina). Si `node -v` da v23 dentro de una sesión de Claude Code, es porque el PATH de esa shell quedó fijado al arrancar — correr `export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use 24` al inicio de cada comando lo soluciona.

### Usuarios de prueba (contraseña para todos: `clave12345`)

- **carla@example.com** — dueña de "Bbva Nomina" (COP, compartida con Beto), "Cuenta USD" (USD) y "Efectivo" (COP). Tiene categorías, presupuestos (COP y USD), metas, plantillas recurrentes (salario, arriendo, etc.), deudas ya liquidadas, y es amiga de Beto.
- **beto@example.com** — miembro invitado en la cuenta de Carla, amigo de Carla.

La base de datos local tiene bastante data acumulada de sesiones de prueba anteriores (varias cuentas duplicadas tipo "Bbva Nomina"/"bbva Nomina", presupuestos, metas) — el usuario también ha estado probando la app por su cuenta en paralelo (ej. una cuenta "Arriendo" recurrente, un usuario "Carlos Ceballos" en deudas). No es un ambiente limpio; no asumas que lo que ves ahí es solo tuyo.

## Arquitectura y convenciones

El backend tiene ~17 módulos, todos siguiendo el mismo patrón (viene de la skill `nestjs-microservice` del usuario) — mantenerlo al agregar algo nuevo:

- **Capas estrictas**: `*.controller.ts` → `*.service.ts` → `*.repository.ts`. El controller no importa `PrismaService`; el repository no contiene reglas de negocio (esas van en el service).
- **DTOs + Mappers**: las entidades de Prisma nunca se devuelven directo. Cada módulo tiene `dto/create-*.dto.ts`, `dto/*-response.dto.ts`, `mappers/*.mapper.ts` (métodos estáticos `toResponse`/`toResponseList`).
- **Excepciones tipadas** de Nest (`NotFoundException`, `ConflictException`, `ForbiddenException`, `BadRequestException`), nunca `return { error }`.
- **Versionado**: todo bajo `/api/v1/...` (`@Controller({ path: '...', version: '1' })`). Única excepción: `/health`, con `version: VERSION_NEUTRAL` y excluido del prefijo `api` en `main.ts` (endpoint de monitoreo, no de negocio).
- **Swagger completo**: `@ApiOperation` + un `@ApiResponse` por cada código posible (200/201/400/403/404/409...) en cada endpoint.
- **404 en vez de 403 cuando el recurso es ajeno**: acceder a una cuenta/deuda que no es tuya da 404, igual que si no existiera — no se revela su existencia a quien no tiene acceso. 403 se reserva para cuando el usuario ya sabe que el recurso existe pero le falta un permiso específico (ej. un `MEMBER` intentando editar una cuenta, solo puede el `OWNER`).
- **Inmutabilidad post-creación** de ciertos campos, a propósito (no descuido): `Category.type`, `Budget.categoryId`/`currency`, `Goal.currency` (excepto que se re-deriva si cambia la cuenta ligada), `RecurringTransaction.accountId/categoryId/type/frequency`. Cambiar alguno de estos = borrar y crear de nuevo. Evita estados inconsistentes (ej. un presupuesto en USD con gastos ya sumados en COP).
- **Moneda**: `CurrencyCode` enum (`COP`/`USD`) en `apps/api/src/common/currency.ts`, validado con `@IsEnum` en cada DTO — nunca texto libre. Antes de agregar una moneda nueva, revisar cómo la usan Budget (unique constraint incluye `currency`), Goal (se hereda de la cuenta ligada) y Transfers (`ExchangeRatesService.resolveRate` solo sabe convertir COP↔USD) — ver README § Moneda.
- **Cuentas compartidas**: `AccountMember` (roles `OWNER`/`MEMBER`) es la base de todo — una cuenta personal es solo una cuenta con un miembro. Pero **categorías, presupuestos, metas y movimientos recurrentes siguen siendo por-usuario**, no por-cuenta: en una cuenta compartida, cada miembro categoriza y presupuesta por su cuenta, aunque transacten sobre el mismo saldo. Ver "Próximos pasos".
- **Migraciones de Prisma**: cuando se toca un campo/relación usado por varios módulos (ej. agregar `currency` a Budget), suele hacer falta tocar repository + service + mapper + DTOs de ese módulo — no es solo el `schema.prisma`.
- **Transferencias como Transaction sin categoría**: `Transfer` no es una tabla aislada — se materializa como dos `Transaction` (EXPENSE en origen, INCOME en destino) con `categoryId: null` y `transferId` seteado, ligadas a la fila `Transfer`. Así el balance de cuentas (que ya suma `Transaction` por `type`) las contabiliza sin lógica adicional. `TransactionsService.update/remove` rechaza tocar una pata de transferencia directamente (400) — hay que borrar el `Transfer` completo vía `/transfers/:id`.
- **Ciclo de módulos Users ↔ Friends**: `/users/search` (usado por amigos, deudas e invitaciones) necesita saber si cada resultado ya es amigo, y `FriendsService` necesita `UsersService.findByEmail`. Se resolvió con `forwardRef()` en ambos `@Module({ imports: [...] })` — `UsersService` solo depende de `FriendsRepository` (no de `FriendsService`), así que no hay ciclo real a nivel de provider, solo a nivel de import de módulo.

## Gotchas de este entorno (ya resueltos — no perder tiempo re-descubriéndolos)

1. **`nest start --watch` cachea tipos viejos de TypeScript después de una migración de Prisma.** Si aparece un error tipo "Property 'x' does not exist" sobre un campo que SÍ está en el schema recién migrado: `rm apps/api/tsconfig.build.tsbuildinfo` y reiniciar el proceso (`npm run start:dev`). Pasó varias veces esta sesión, siempre se resuelve así.
2. **`prisma migrate dev` no funciona en este entorno** cuando la migración dispara un warning de posible pérdida de datos (ej. agregar una columna a un unique constraint) — pide confirmación interactiva y el entorno no tiene TTY, así que falla con "non-interactive environment". Solución: escribir a mano `prisma/migrations/<timestamp>_nombre/migration.sql` con el SQL, luego `npx prisma migrate deploy` (no pide confirmación) y `npx prisma generate`.
3. **npm 11 (viene con Node 24) bloquea scripts de instalación por default** (`allow-scripts`, feature nueva de npm). Cuando salga el warning tras un `npm install`: `npm approve-scripts <paquete>` para los legítimos (ya aprobados en `package.json` → `allowScripts`: prisma, @prisma/client, @prisma/engines, fsevents, unrs-resolver, bcrypt). `@scarf/scarf` se deja bloqueado a propósito — es solo telemetría de terceros, no hace falta para que nada funcione.

## Próximos pasos sugeridos

De lo que el usuario ha pedido hasta ahora, queda pendiente un solo punto:

- **Compartir categorías/presupuestos/metas entre miembros de una cuenta compartida.** Hoy son estrictamente por-usuario incluso dentro de una cuenta con varios miembros. Antes de implementar, hay una decisión de modelo que discutir con el usuario (no es cosmético): ¿las categorías pasan a pertenecer a la cuenta en vez de al usuario (rompe con que hoy son 100% personales)? ¿o se comparten explícitamente, con su propio criterio de quién puede editarlas? Conviene una ronda de preguntas antes de tocar el schema, como se hizo con "cuentas compartidas" y "deudas compartidas" al inicio.

Fuera de eso, no hay trabajo a medias ni features rotas — todo lo construido está verificado end-to-end (backend con curl + frontend en navegador con dos usuarios reales cuando aplica).

## Mejoras recién implementadas (sin commitear)

Sesión que agregó 5 mejoras sobre lo ya construido — plan completo en el historial de conversación, resumen aquí:

1. **Quién hizo el movimiento**: `TransactionResponseDto.createdBy` (ya existía `createdByUserId`, solo faltaba el nombre). Frontend lo muestra en `AccountTransactionsPage` solo si `account.memberCount > 1`.
2. **Recurrentes simplificados**: se eliminó el cron (`RecurringTransactionsScheduler`, `@nestjs/schedule`) y los campos `startDate/nextRunDate/endDate/lastRunAt`. Ahora es una plantilla pura: `POST /recurring-transactions/:id/apply` crea el movimiento cuando el usuario decide, con los valores editables. `active` cambió de significado: ya no es "sigue generando", es "cuenta en la proyección mensual de /forecast". Al crear un movimiento normal se puede marcar "guardar como plantilla" — son dos llamadas independientes del frontend (`createTransaction` + `createRecurringTransaction`), no una transacción de BD, porque si falla la segunda no debe deshacerse el movimiento ya registrado.
3. **Amigos**: `FriendRequest` (solicitud mutua, mismo patrón que `AccountInvitation`). Nuevo `GET /users/search?q=` (no existía ningún `users.controller.ts` antes) para autocompletar en deudas/invitaciones/amigos, marcando `isFriend`.
4. **Transferencias entre cuentas**: `Transfer` + dos `Transaction` sin categoría (ver arriba). Tasa de cambio COP/USD automática desde la TRM oficial del Banco de la República (`datos.gov.co`, sin API key, se publica 1 vez al día — cacheada 6h) con override manual opcional.
5. **Home**: `HomePage.tsx` en `/` (nueva ruta raíz, reemplaza el default a `/accounts`), compone endpoints ya existentes con `Promise.all` — no hay endpoint de resumen nuevo en el backend.

## Decisiones no obvias (el porqué, no solo el qué)

- **Deudas es independiente de "cuentas compartidas"**, aunque el usuario las pidió juntas al inicio. Son modelos separados (`Debt` vs `Account`+`AccountMember`) porque una deuda es 1:1 entre dos personas identificadas por email al crearla — no necesita un flujo de invitación/aceptación como una cuenta.
- **Las invitaciones a cuenta (y las solicitudes de amistad) no envían ningún correo real.** El campo email solo sirve para encontrar al usuario dentro de la app (confirmado explícitamente con el usuario, que aclaró que no quería un flujo por email real).
- **La proyección de gastos futuros es aritmética simple** (promedio de los últimos 3 meses completos, equivalente mensual de recurrentes activos), no ML — decisión deliberada para que sea auditable/explicable en una app de dinero real, no una caja negra.
- **"Quincenal" = días 15 y último del mes**, no un intervalo fijo de 14 días — es el ciclo de nómina estándar en Colombia (moneda default de la app es COP).
- **Los recurrentes ya no se auto-generan, ni siquiera "pendientes por confirmar".** El usuario fue explícito: quiere abrir la plantilla cuando quiera y decidir en ese momento si la aplica — no una cola de sugerencias esperando aprobación. Es una simplificación deliberada, no una feature a medias.
- **La tasa de cambio automática es la TRM oficial (1 vez al día), no un mercado en vivo.** Es gratis, sin API key, y coherente con que la app ya usa COP como default — se aceptó explícitamente el trade-off de no ser "tick a tick" a cambio de eso. Si se quiere una tasa más en vivo en el futuro, hay que dar de alta un proveedor con key (ej. exchangerate-api.com).
- **Amigos es solo para sugerencias, no da ningún permiso.** Ser amigo de alguien no le da acceso a nada — solo hace que aparezca primero (con badge) en los buscadores de `/users/search`. "Amistad" se deriva de que exista una fila `FriendRequest` con `status: ACCEPTED` entre los dos; no hay una tabla de amistad separada.
