-- Deudas con contraparte no registrada: creditorId/debtorId pasan a ser
-- opcionales (el que SÍ es el usuario actual siempre está seteado; el otro
-- puede quedar null si esa persona no tiene cuenta en la app), y se agregan
-- counterpartyName/counterpartyEmail como texto libre para ese caso.
ALTER TABLE "debts" ALTER COLUMN "creditorId" DROP NOT NULL;
ALTER TABLE "debts" ALTER COLUMN "debtorId" DROP NOT NULL;
ALTER TABLE "debts" ADD COLUMN "counterpartyName" TEXT;
ALTER TABLE "debts" ADD COLUMN "counterpartyEmail" TEXT;

-- Los abonos ahora se pueden ligar a la cuenta de quien los registra, para
-- generar un Transaction real al confirmarse. Nullable porque ya existen
-- filas de abonos previos a esta migración sin cuenta asociada — para esas,
-- el código simplemente no genera el Transaction retroactivo.
ALTER TABLE "debt_payments" ADD COLUMN "accountId" TEXT;
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Liga el Transaction generado por un abono confirmado con la deuda que lo originó.
ALTER TABLE "transactions" ADD COLUMN "debtId" TEXT;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
