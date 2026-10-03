-- Tipos de aviso de los cronjobs: recordatorio diario y movimientos recurrentes
-- automáticos (solo ADD VALUE; no se usan en esta migración).
ALTER TYPE "NotificationType" ADD VALUE 'DAILY_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'RECURRING_APPLIED';
ALTER TYPE "NotificationType" ADD VALUE 'RECURRING_FAILED';

-- Aplicación automática de plantillas recurrentes. Las existentes quedan en
-- manual (autoApply = false): nada se ejecuta solo hasta que el usuario lo active.
ALTER TABLE "recurring_transactions" ADD COLUMN "autoApply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recurring_transactions" ADD COLUMN "scheduleStart" DATE;
ALTER TABLE "recurring_transactions" ADD COLUMN "nextRunOn" DATE;
ALTER TABLE "recurring_transactions" ADD COLUMN "failureNotifiedFor" DATE;

-- El cron busca plantillas pendientes de ejecutar.
CREATE INDEX "recurring_transactions_autoApply_nextRunOn_idx" ON "recurring_transactions"("autoApply", "nextRunOn");
