-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "currency" SET DEFAULT 'COP';

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'COP';

-- AlterTable
ALTER TABLE "debts" ALTER COLUMN "currency" SET DEFAULT 'COP';

-- AlterTable
ALTER TABLE "savings_goals" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'COP';
