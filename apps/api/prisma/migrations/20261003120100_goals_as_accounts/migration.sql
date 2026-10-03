-- Las metas pasan a ser cuentas (type GOAL). Cada meta existente recibe su
-- cuenta oculta con el saldo inicial igual a lo que llevaba ahorrado
-- (currentAmount), así el progreso no cambia y el historial no se toca.

ALTER TABLE "savings_goals" ADD COLUMN "newAccountId" TEXT;
UPDATE "savings_goals" SET "newAccountId" = gen_random_uuid()::text;

INSERT INTO "accounts" ("id", "name", "type", "currency", "initialBalance", "createdAt", "updatedAt")
SELECT "newAccountId", "name", 'GOAL'::"AccountType", "currency", "currentAmount", NOW(), NOW()
FROM "savings_goals";

INSERT INTO "account_members" ("id", "accountId", "userId", "role", "createdAt")
SELECT gen_random_uuid()::text, "newAccountId", "userId", 'OWNER'::"AccountMemberRole", NOW()
FROM "savings_goals";

-- La cuenta "relacionada" anterior (solo definía la moneda) se reemplaza por la oculta.
ALTER TABLE "savings_goals" DROP CONSTRAINT "savings_goals_accountId_fkey";
UPDATE "savings_goals" SET "accountId" = "newAccountId";
ALTER TABLE "savings_goals" DROP COLUMN "newAccountId";
ALTER TABLE "savings_goals" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "savings_goals" DROP COLUMN "currentAmount";
ALTER TABLE "savings_goals"
  ADD CONSTRAINT "savings_goals_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Borrar una meta ya no borra los movimientos que la mencionan (quedan como
-- historial): antes CASCADE, ahora SET NULL.
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_goalId_fkey";
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "savings_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
