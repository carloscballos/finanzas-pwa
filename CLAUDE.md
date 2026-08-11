# CLAUDE.md — Finanzas PWA

Contexto para retomar el desarrollo en otra sesión. Para stack, estructura, setup y referencia de API, ver [README.md](README.md) — no se duplica aquí.

## ⚠️ Estado del repo

**No existe ningún commit todavía.** Todo el proyecto (auth, cuentas, categorías, transacciones, presupuestos, metas, deudas, cuentas compartidas, recurrentes, proyección) está sin versionar en git — `git log` está vacío. Antes de hacer cambios grandes, vale la pena proponerle al usuario un primer commit para tener un punto de retorno.

## Cómo retomar

```bash
cd ~/Documents/personal-projects/finanzas-pwa
docker compose up -d postgres
npm install   # si es una sesión/máquina nueva
npm run dev   # backend :3000 (Swagger en /docs) + frontend :5173
```

Requiere Node 24 (`nvm alias default` ya está en 24 a nivel de sistema en esta máquina). Si `node -v` da v23 dentro de una sesión de Claude Code, es porque el PATH de esa shell quedó fijado al arrancar — correr `export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use 24` al inicio de cada comando lo soluciona.

### Usuarios de prueba (contraseña para todos: `clave12345`)

- **carla@example.com** — dueña de "Bbva Nomina" (COP, compartida con Beto) y "Cuenta USD" (USD). Tiene categorías, presupuestos (COP y USD), metas, recurrentes (salario, arriendo, etc.) y deudas ya liquidadas.
- **beto@example.com** — miembro invitado en la cuenta de Carla.

La base de datos local tiene bastante data acumulada de sesiones de prueba anteriores (varias cuentas duplicadas tipo "Bbva Nomina"/"bbva Nomina", presupuestos, metas) — el usuario también ha estado probando la app por su cuenta en paralelo (ej. una cuenta "Arriendo" recurrente, un usuario "Carlos Ceballos" en deudas). No es un ambiente limpio; no asumas que lo que ves ahí es solo tuyo.

## Arquitectura y convenciones

El backend tiene ~13 módulos, todos siguiendo el mismo patrón (viene de la skill `nestjs-microservice` del usuario) — mantenerlo al agregar algo nuevo:

- **Capas estrictas**: `*.controller.ts` → `*.service.ts` → `*.repository.ts`. El controller no importa `PrismaService`; el repository no contiene reglas de negocio (esas van en el service).
- **DTOs + Mappers**: las entidades de Prisma nunca se devuelven directo. Cada módulo tiene `dto/create-*.dto.ts`, `dto/*-response.dto.ts`, `mappers/*.mapper.ts` (métodos estáticos `toResponse`/`toResponseList`).
- **Excepciones tipadas** de Nest (`NotFoundException`, `ConflictException`, `ForbiddenException`, `BadRequestException`), nunca `return { error }`.
- **Versionado**: todo bajo `/api/v1/...` (`@Controller({ path: '...', version: '1' })`). Única excepción: `/health`, con `version: VERSION_NEUTRAL` y excluido del prefijo `api` en `main.ts` (endpoint de monitoreo, no de negocio).
- **Swagger completo**: `@ApiOperation` + un `@ApiResponse` por cada código posible (200/201/400/403/404/409...) en cada endpoint.
- **404 en vez de 403 cuando el recurso es ajeno**: acceder a una cuenta/deuda que no es tuya da 404, igual que si no existiera — no se revela su existencia a quien no tiene acceso. 403 se reserva para cuando el usuario ya sabe que el recurso existe pero le falta un permiso específico (ej. un `MEMBER` intentando editar una cuenta, solo puede el `OWNER`).
- **Inmutabilidad post-creación** de ciertos campos, a propósito (no descuido): `Category.type`, `Budget.categoryId`/`currency`, `Goal.currency` (excepto que se re-deriva si cambia la cuenta ligada), `RecurringTransaction.accountId/categoryId/type/frequency/startDate`. Cambiar alguno de estos = borrar y crear de nuevo. Evita estados inconsistentes (ej. un presupuesto en USD con gastos ya sumados en COP).
- **Moneda**: `CurrencyCode` enum (`COP`/`USD`) en `apps/api/src/common/currency.ts`, validado con `@IsEnum` en cada DTO — nunca texto libre. Antes de agregar una moneda nueva, revisar cómo la usan Budget (unique constraint incluye `currency`) y Goal (se hereda de la cuenta ligada) — ver README § Moneda.
- **Cuentas compartidas**: `AccountMember` (roles `OWNER`/`MEMBER`) es la base de todo — una cuenta personal es solo una cuenta con un miembro. Pero **categorías, presupuestos, metas y movimientos recurrentes siguen siendo por-usuario**, no por-cuenta: en una cuenta compartida, cada miembro categoriza y presupuesta por su cuenta, aunque transacten sobre el mismo saldo. Ver "Próximos pasos".
- **Migraciones de Prisma**: cuando se toca un campo/relación usado por varios módulos (ej. agregar `currency` a Budget), suele hacer falta tocar repository + service + mapper + DTOs de ese módulo — no es solo el `schema.prisma`.

## Gotchas de este entorno (ya resueltos — no perder tiempo re-descubriéndolos)

1. **`nest start --watch` cachea tipos viejos de TypeScript después de una migración de Prisma.** Si aparece un error tipo "Property 'x' does not exist" sobre un campo que SÍ está en el schema recién migrado: `rm apps/api/tsconfig.build.tsbuildinfo` y reiniciar el proceso (`npm run start:dev`). Pasó varias veces esta sesión, siempre se resuelve así.
2. **`prisma migrate dev` no funciona en este entorno** cuando la migración dispara un warning de posible pérdida de datos (ej. agregar una columna a un unique constraint) — pide confirmación interactiva y el entorno no tiene TTY, así que falla con "non-interactive environment". Solución: escribir a mano `prisma/migrations/<timestamp>_nombre/migration.sql` con el SQL, luego `npx prisma migrate deploy` (no pide confirmación) y `npx prisma generate`.
3. **npm 11 (viene con Node 24) bloquea scripts de instalación por default** (`allow-scripts`, feature nueva de npm). Cuando salga el warning tras un `npm install`: `npm approve-scripts <paquete>` para los legítimos (ya aprobados en `package.json` → `allowScripts`: prisma, @prisma/client, @prisma/engines, fsevents, unrs-resolver, bcrypt). `@scarf/scarf` se deja bloqueado a propósito — es solo telemetría de terceros, no hace falta para que nada funcione.

## Próximos pasos sugeridos

De lo que el usuario pidió originalmente, queda pendiente un solo punto:

- **Compartir categorías/presupuestos/metas entre miembros de una cuenta compartida.** Hoy son estrictamente por-usuario incluso dentro de una cuenta con varios miembros. Antes de implementar, hay una decisión de modelo que discutir con el usuario (no es cosmético): ¿las categorías pasan a pertenecer a la cuenta en vez de al usuario (rompe con que hoy son 100% personales)? ¿o se comparten explícitamente, con su propio criterio de quién puede editarlas? Conviene una ronda de preguntas antes de tocar el schema, como se hizo con "cuentas compartidas" y "deudas compartidas" al inicio.

Fuera de eso, no hay trabajo a medias ni features rotas — todo lo construido está verificado end-to-end (backend con curl + frontend en navegador con dos usuarios reales cuando aplica).

## Decisiones no obvias (el porqué, no solo el qué)

- **Deudas es independiente de "cuentas compartidas"**, aunque el usuario las pidió juntas al inicio. Son modelos separados (`Debt` vs `Account`+`AccountMember`) porque una deuda es 1:1 entre dos personas identificadas por email al crearla — no necesita un flujo de invitación/aceptación como una cuenta.
- **Las invitaciones a cuenta no envían ningún correo real.** El campo email solo sirve para encontrar al usuario dentro de la app (confirmado explícitamente con el usuario, que aclaró que no quería un flujo por email real).
- **La proyección de gastos futuros es aritmética simple** (promedio de los últimos 3 meses completos, equivalente mensual de recurrentes activos), no ML — decisión deliberada para que sea auditable/explicable en una app de dinero real, no una caja negra.
- **"Quincenal" = días 15 y último del mes**, no un intervalo fijo de 14 días — es el ciclo de nómina estándar en Colombia (moneda default de la app es COP).
