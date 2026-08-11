-- AlterTable
-- Se elimina el scheduler: RecurringTransaction pasa de ser una plantilla
-- con cron (startDate/nextRunDate/endDate/lastRunAt) a una plantilla pura
-- que el usuario aplica manualmente.
ALTER TABLE "recurring_transactions" DROP COLUMN "startDate";
ALTER TABLE "recurring_transactions" DROP COLUMN "nextRunDate";
ALTER TABLE "recurring_transactions" DROP COLUMN "endDate";
ALTER TABLE "recurring_transactions" DROP COLUMN "lastRunAt";
ALTER TABLE "recurring_transactions" ADD COLUMN     "lastAppliedAt" TIMESTAMP(3);
