# PLAN.md — Finanzas PWA

Estado del trabajo y próximos pasos, para que otra sesión pueda continuar sin contexto previo.
Última actualización: **3 de octubre de 2026**.

- **El "por qué" de lo construido** está en [CLAUDE.md](CLAUDE.md) (registro de cambios #1–#25 y "Decisiones no obvias"). Aquí no se repite.
- **Stack, estructura y API**: [README.md](README.md).
- Cada vez que se cierre un punto de este plan, **táchalo o bórralo aquí** y deja el porqué en CLAUDE.md.

---

## 1. Dónde estamos

### En producción (https://www.finance.koystudio.dev)
Todo lo de CLAUDE.md #1–#16: cuentas (personales y compartidas), movimientos, categorías, presupuestos, metas, deudas, préstamos con amortización real, tarjetas de crédito con compras a cuotas, extractos PDF con IA, transferencias COP↔USD con TRM, recurrentes como plantillas, proyección, amigos/invitaciones, token para el atajo de Apple Wallet.

### Rediseño de octubre 2026 (CLAUDE.md #17–#25) — hecho y verificado en local, **NO desplegado**
| # | Qué | Dónde |
|---|---|---|
| 17 | Home en filas de tarjetas (Cuentas, Tarjetas, Presupuestos, Metas, Deudas, Préstamos, Proyección); **crear = `Modal`** | `HomePage.tsx`, `ui/HomeRow.tsx`, `ui/Modal.tsx`, `components/*Form.tsx` |
| — | **Estilo "Koy PDF"** (crema + terracota, IBM Plex, sin sombras), botón de tema claro/oscuro | `index.css`, `ThemeContext` |
| 18 | Detalle de cuenta: Volver → tarjeta → acciones → Movimientos (de a 10) ; compartir cuenta en modal | `AccountTransactionsPage.tsx` |
| 19 | Tarjetas de crédito como sección propia (`/cards`) ; tarjetas de Cuentas/Tarjetas enteras clicables | `CardsPage.tsx` |
| 20 | **Botón global "Nuevo movimiento"** (+ leer facturas con foto/galería/cámara) | `Layout.tsx`, `QuickTransactionModal.tsx`, `TransactionForm.tsx` |
| 21 | Presupuestos: resumen + filas con lápiz/caneca | `BudgetsPage.tsx`, `ui/SummaryCard.tsx` |
| 22 | **Las metas SON cuentas ocultas** (aportar = transferencia, borrar = devolución automática) — **cambio de datos y de contrato de API** | `goals/*`, 2 migraciones |
| 23 | Menú del usuario con Tema + Configuración (Categorías y token viven ahí) | `UserMenu.tsx` |
| 24 | Metas rediseñadas (resumen, editar, Aportar/Retirar en modal, ritmo mensual) | `GoalsPage.tsx`, `GoalContributionForm.tsx` |
| 25 | Deudas reorganizadas (Por confirmar, resumen, Me deben / Yo debo, abono en modal) | `DebtsPage.tsx`, `DebtPaymentForm.tsx` |
| 26 | **Préstamos** rediseñados (resumen, filas, "Vence en N d", pagar cuota en modal, Pagados plegado) | `LoansPage.tsx`, `LoanPaymentForm.tsx`, `lib/dates.ts` (`daysUntilDayOfMonth`) |

Páginas **ya** con el patrón nuevo: Home, Cuentas, Tarjetas, Detalle de cuenta, Presupuestos, Metas, Deudas, **Préstamos**.
Páginas **sin** rediseñar (siguen con el look/estructura anterior, aunque ya con la paleta nueva): **Categorías, Configuración (`/settings`, página del token), Login/Registro**.

> ⚠️ **Trabajo en paralelo (3 oct, ~13:40):** otra sesión de Claude ("Actualizar y revisar proyección") editó `ForecastPage.tsx`/`.css` y creó `components/RecurringForm.tsx` (Proyección con `SummaryCard`, modal para pagos fijos), y el árbol de trabajo mostraba cambios sin comitar en **Amigos, Invitaciones** (`FriendsPage`, `InvitationsPage`, `friends/*`, `account-invitations/*`), `debts.service.ts`, `app.module.ts` y `schema.prisma` que **no son de la sesión de Préstamos**. Antes de tocar Proyección/Amigos/Invitaciones, revisar `git status`/`git diff` y confirmar su estado; no sobrescribir.

---

## 2. Estado del árbol de trabajo (sin comitar)

Casi todo #20–#25 está **sin comitar** (el usuario comitea él mismo; no lo hagas sin que lo pida). Cuando quiera comitar, una agrupación sensata:

1. ✅ **Metas como cuentas — backend + contrato** (deben ir juntos y con el frontend de metas, porque el API cambió):
   `apps/api/prisma/schema.prisma`, las 2 migraciones nuevas (`20261003120000_account_type_goal`, `20261003120100_goals_as_accounts`), `apps/api/src/{goals,accounts,transfers,transactions}/…`, `apps/web/src/lib/api.ts`, `GoalForm.tsx`, `GoalsPage.*`, `GoalContributionForm.tsx`, y el cambio de `AccountTransactionsPage.tsx` que muestra "Meta: …".
2. ✅ **Deudas** (solo frontend): `DebtsPage.*`, `DebtPaymentForm.tsx`.
3. ✅ **Resumen compartido + Presupuestos**: `ui/SummaryCard.*`, `BudgetsPage.*`, `budgets/mappers/budget.mapper.ts` (redondeo de `remaining`).
4. ✅ **Menú de usuario / Layout / Home**: `UserMenu.*`, `Layout.*`, `HomePage.tsx`.
5. **Docs**: `CLAUDE.md`, `README.md`, `PLAN.md`.

Comprobar antes de comitar: `npx tsc --noEmit -p apps/web/tsconfig.app.json` y `npx tsc --noEmit -p apps/api/tsconfig.build.json` (ambos pasan hoy).

---

## 3. Antes de desplegar el rediseño (checklist)

- [ ] **Respaldo de la base de producción (Railway)**. La migración `20261003120100_goals_as_accounts` **reescribe datos**: crea una cuenta oculta por meta (con `initialBalance = currentAmount`), elimina `savings_goals.currentAmount`, cambia FKs. Necesita Postgres ≥ 13 (`gen_random_uuid()`).
- [ ] Desplegar **frontend y backend juntos** (el contrato de `/goals` cambió: ya no hay `account`/`accountId`, y `DELETE /goals/:id?refundAccountId=`).
- [ ] **Web Push**: en Railway agregar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:…`). Generar un par NUEVO para prod con `npx web-push generate-vapid-keys` (no reusar el de `.env` local) y no cambiarlo después: invalida todas las suscripciones. Sin ellas el push queda apagado (la campana sigue). Probar en un iPhone con la PWA instalada.
- [ ] `ANTHROPIC_API_KEY` en Railway si todavía no está (extractos PDF y facturas; sin ella esos endpoints dan 503).
- [ ] Tras desplegar: crear una meta, aportar, retirar y borrar con devolución en producción (la receta está en la sección 6).
- [ ] Revisar que las metas existentes en prod conserven su progreso (la migración debe dejar `currentAmount` como saldo de la cuenta oculta).

---

## 4. Próximos pasos priorizados

### P0 — Seguridad (salió de la revisión inicial; **1–4 y 6 hechos en local, sin comitar ni desplegar**; solo falta el 5)
1. ✅ **API key del Shortcut con acceso total.** Hoy `JwtAuthGuard` trata una API key igual que un JWT: quien la filtre puede leer y borrar todo. Hacer: columna `scope` (`transactions:create`), y que el guard rechace cualquier otra ruta con esa key.
2. ✅ **Key en texto plano en la BD** y `getCurrentToken` la devuelve siempre. Guardar solo el hash (SHA-256), mostrar el token **una sola vez** al generarlo, con prefijo reconocible (`fin_…`). `WALLET_SHORTCUT.md` dice `sk_live_…` y el código genera hex crudo: alinear.
3. ✅ **`revokeToken(userId, token)` ignora `userId`** (`apps/api/src/api-keys/api-keys.service.ts`). Usar `updateMany({ where: { token, userId } })` y 404 si no afectó filas.
4. ✅ **Sin rate limiting ni `helmet`**: `@nestjs/throttler` global (más estricto en `/auth/login` y `/register`) + `helmet`.
5. JWT en `localStorage` con 7 días y sin revocación (XSS lo roba). Corto plazo: bajar expiración; medio plazo: cookie `httpOnly` + refresh.
6. ✅ El guard cae a buscar API key ante **cualquier** fallo de JWT (consulta a la BD en cada JWT vencido) y `JwtStrategy` quedó sin uso. Distinguir por prefijo.

### P1 — Calidad y rendimiento
7. **Pruebas: hay 0.** (`jest` está configurado, no hay ningún `.spec.ts`.) Empezar por funciones puras y reglas de plata: `loans/amortization.util.ts`, `AccountsService.assertSufficientFunds`, `budgets/period-window.util.ts`, `forecast/trailing-window.util.ts`, y los servicios nuevos `GoalsService` (aportar/retirar/borrar con devolución) y los abonos de deuda.
8. **CI** (GitHub Actions): `tsc` de web y api + `build` + `test`. Hoy el único control es probar a mano.
9. **Índices**: el schema no tiene ningún `@@index`. Agregar al menos `Transaction(accountId, occurredAt)` y `Transaction(createdByUserId)`/`categoryId`.
10. **Paginación real** en `GET /transactions`: la del detalle de cuenta ("de a 10") es solo de pantalla; con miles de movimientos sigue trayendo todo.
11. **Partir `AccountTransactionsPage.tsx`** (~1.460 líneas): sacar `CardPurchaseCard`, la subida de extracto, `TransferForm`, y pasar los formularios que quedan inline a `Modal` (ver decisión D6). `lib/api.ts` (~940 líneas) separarlo por módulo.
12. **Capa de datos en el frontend** (React Query/SWR): hoy cada página hace `useEffect`+`fetch`; el aviso `lib/dataEvents.ts` es un parche para refrescar tras el botón global.
13. `packages/shared` existe pero está **vacío y sin uso**: o se usa para compartir los DTO de respuesta, o se borra.
14. Presupuestos usan mes **UTC** y el Home/UI usa mes local (gap conocido, #15): pasar la zona horaria del cliente al backend.
15. Respaldos automáticos de la base de producción.

### P2 — Producto
16. **Rediseñar las páginas que faltan** con el patrón nuevo (resumen con `SummaryCard`, filas anchas, íconos lápiz/caneca, crear en `Modal`): Categorías y la página del token. (Préstamos ya está; Proyección/Amigos/Invitaciones los tiene otra sesión: ver la nota de trabajo en paralelo arriba.)
17. **Crear una categoría desde el formulario de movimiento** ("+ Nueva categoría" en el selector) — justifica haber sacado Categorías del menú.
18. **Gráfica real en Presupuestos** (el boceto decía "alguna gráfica o resumen"; hoy es resumen numérico). Hay que elegir librería: el proyecto no tiene ninguna.
19. **Alertas**: presupuesto ≥ 80 %, vencimiento de tarjeta (ya hay badge "Vence en N d"), cuotas del mes; notificaciones push de la PWA.
20. Exportar a CSV (confianza + declaración de renta). Onboarding para usuarios nuevos (3 pasos) y mejores estados vacíos.
21. **Metas**: aportes desde cuentas en otra moneda usando la TRM (las transferencias ya lo soportan; hoy 400 si no coincide); poder **quitar** la fecha de una meta (PATCH con `undefined` = sin cambio); decidir qué hacer con las **cuentas ocultas huérfanas** que quedan tras borrar una meta (se conservan a propósito, en cero, para no perder historial).
22. **Deudas**: recordatorio por correo (`counterpartyEmail` hoy es solo referencia).
23. En el detalle de una tarjeta el menú resalta "Cuentas" en vez de "Tarjetas" (la ruta es `/accounts/:id/…`).
24. Mover **Amigos/Invitaciones** al menú Configuración (no se hizo; ver D4).
25. Home: las filas de Metas y Presupuestos solo navegan a su página; podrían abrir el aporte/edición directo.

### P3 — Pendientes de verificación
26. **Leer facturas con una foto real** y la **cámara/galería en un celular físico** (en iPhone/Safari `capture` puede comportarse distinto). Hoy solo se simuló el archivo por código; el costo es una llamada a Claude por foto.
27. Meta con fecha **ya vencida**, y abono de deuda como deudor con **saldo insuficiente** (debería mostrar el error de saldo; no se vio en pantalla).
28. Probar todo el rediseño en un celular real y en Safari (los selects nativos se dibujan distinto; ya se les quitó la apariencia nativa para igualar la altura de 35 px).

---

## 5. Decisiones abiertas (necesitan al usuario)

- **D1. Categorías/presupuestos/metas compartidos** entre miembros de una cuenta compartida (hoy son por usuario). ¿Pasan a pertenecer a la cuenta, o se comparten explícitamente con permisos de edición? **Es una decisión de modelo**: conversar antes de tocar el schema, como se hizo con cuentas y deudas compartidas.
- **D2. ¿Tarjetas de crédito en el botón global de movimiento?** Hoy se excluyen porque se alimentan con compras a cuotas (si no, el cupo puede cuadrar mal). ¿Se quiere un gasto simple con tarjeta ahí?
- **D3. ¿Gráfica en Presupuestos?** ¿Cuál tipo (reparto por categoría, tendencia mensual) y con qué librería?
- **D4. ¿Amigos e Invitaciones también a Configuración?** Se movió Categorías; esas dos tampoco son de uso diario.
- **D5. Metas en otra moneda** vía TRM, ¿ahora o después?
- **D6. Formularios que siguen inline** (editar presupuesto/préstamo, compras a cuotas, extracto, pagar cuota): ¿se pasan todos a `Modal` para tener una sola convención?
- **D7. Seguridad (P0)**: ¿se hace antes de mostrar la app a más gente?

---

## 6. Receta de verificación (para no repetir descubrimientos)

```bash
open -a Docker && docker compose up -d postgres   # primero Docker y Postgres
npm run dev                                        # api :3000 (Swagger /docs) + web :5173
```
En Claude Code: `preview_start` → `finanzas-dev`. Si el API no responde, ver gotcha #10 de CLAUDE.md (arrancó antes que Postgres).

- **Usuarios** (clave `clave12345`): `carla@example.com` (cuentas Bbva Nomina −2.117.050 compartida con Beto, Efectivo −425.000, Cuenta USD 866; tarjetas Visa Platino y Tarjeta correcta; 4 metas; deuda con Beto) y `beto@example.com`.
- **La base es de pruebas con datos ficticios** (confirmado por el usuario): se puede modificar para verificar, pero hay que **dejarla como estaba** (prefijo `TEST` en lo que se cree, borrarlo al final, y comprobar los saldos de arriba).
- **Probar como otro usuario**: login por API (`POST /api/v1/auth/login`) y poner el `accessToken` en `localStorage` (clave con "token").
- **Respaldo antes de tocar datos**: `docker exec finanzas-postgres pg_dump -U finanzas finanzas > respaldo.sql` (fuera del repo).
- **SQL directo**: `docker exec finanzas-postgres psql -U finanzas -d finanzas -c "…"`.
- **Verificar UI**: siempre en el navegador (claro, oscuro y celular 375 px), sin desborde horizontal (`scrollWidth == clientWidth`) y sin errores de consola.
- **Leer un boceto en PDF**: `pdftoppm` no está instalado; renderizar con `mupdf` del repo:
  `node -e "import('/…/node_modules/mupdf/dist/mupdf.js').then(m=>{…toPixmap(m.Matrix.scale(1.5,1.5), m.ColorSpace.DeviceRGB, false, true).asPNG()})"` y abrir el PNG con `Read`.

Receta rápida del ciclo de **metas** por API (login → crear meta USD → `POST /goals/:id/contributions` con `amount` ±100 y `accountId` de la cuenta USD → `DELETE /goals/:id?refundAccountId=…`): el saldo de la cuenta debe bajar al aportar y volver exacto al borrar.

---

## 7. Cómo trabaja el usuario (convenciones observadas)

- **Habla español**; las respuestas y la documentación van en español.
- Para cambios grandes de **UX o de modelo**, primero **opinión + opciones + una pregunta**, y se implementa cuando dice "sí / hazlo así". Para cambios visuales concretos, **muestra un boceto o captura** antes o después. Dibuja bocetos en PDF/imagen en `~/Desktop` (leerlos con `Read`).
- **Verifica en el navegador y comparte pruebas**; no le pidas que revise a mano.
- **No comitees ni pushees**; él lo hace cuando está contento.
- **Respeta el estilo**: reutilizar `components/ui/` y los tokens de `index.css` (paleta Koy PDF); nada de CSS suelto ni colores hardcodeados.
- **Realismo del dinero**: el movimiento de plata en la app debe parecerse al de un banco real; no complicar el modelo por lo que el cliente haga fuera de la app (decisión de las metas, #22).
- **Credenciales nunca en el chat**: pedir solo el nombre de la variable y que él la ponga en `.env`.
- Le importan los costos (Railway es de pago; cada lectura de factura/extracto cuesta una llamada a Claude): medir llamadas cuando se prueba esa parte.

---

## 8. Mapa rápido del código

**Frontend** (`apps/web/src`)
- `components/ui/`: `Button, Badge, Card, CardGrid, ListRow, StatCard, ProgressBar, Money, EmptyState, IconChip, SectionHeader, SegmentedControl, Form*, Modal, HomeRow/TileCard/AddTile, SummaryGrid/SummaryCard`.
- `components/`: `Layout` (menú lateral, encabezado, FAB, botón global), `UserMenu` (tema, Configuración, Salir), `QuickTransactionModal`, `TransactionForm`, `AccountForm`, `BudgetForm`, `GoalForm`, `GoalContributionForm`, `DebtForm`, `DebtPaymentForm`, `LoanForm`, `AccountMembers`, `PendingTransactionsDrawer`.
- `context/`: `AuthContext`, `PrivacyContext` (ocultar valores), `ThemeContext`.
- `lib/`: `api.ts` (cliente), `money.ts`, `dates.ts`, `dataEvents.ts`, `currencies.ts`, `accountTypeLabels.ts`.
- Convención: **crear = `Modal`**, **editar = inline** (hoy), `?new=1` abre el modal de creación (`useCreateFormToggle`).

**Backend** (`apps/api/src`), cada módulo `controller → service → repository` + DTOs + mappers: `accounts, account-invitations, api-keys, auth, budgets, card-purchases, categories, debts, exchange-rates, forecast, friends, goals, health, loans, recurring-transactions, transactions, transfers, users`.
- Las **metas** dependen de `accounts` (cuentas `GOAL` ocultas) y de `transfers` (`TransfersService.create(userId, dto, { goalId })`).
- `AccountsService.assertSufficientFunds` es la **única** validación de saldo; todo lo que saca dinero de una cuenta la llama.
- Las cuentas `GOAL` se excluyen en `AccountsRepository.findAllForUser` y en el listado general de `TransactionsRepository.findMany`.
