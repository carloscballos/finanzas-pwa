-- Resuelve deudas que quedaron esperando confirmación bajo el flujo antiguo
-- (mark-paid a nivel de deuda completa) antes de reemplazarlo por abonos con
-- confirmación por-pago — se asume que "esperando confirmación" ya significaba
-- que el dinero cambió de manos, solo faltaba el visto bueno.
UPDATE "debts" SET "status" = 'SETTLED', "settledAt" = COALESCE("settledAt", CURRENT_TIMESTAMP)
WHERE "status" = 'PAID_PENDING_CONFIRMATION';

-- AlterTable: remainingBalance por deuda, para poder registrar abonos parciales
ALTER TABLE "debts" ADD COLUMN "remainingBalance" DECIMAL(14,2);
UPDATE "debts" SET "remainingBalance" = CASE WHEN "status" = 'SETTLED' THEN 0 ELSE "amount" END;
ALTER TABLE "debts" ALTER COLUMN "remainingBalance" SET NOT NULL;

ALTER TABLE "debts" DROP COLUMN "markedPaidByUserId";

-- CreateEnum
CREATE TYPE "DebtPaymentStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "debt_payments" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "status" "DebtPaymentStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
