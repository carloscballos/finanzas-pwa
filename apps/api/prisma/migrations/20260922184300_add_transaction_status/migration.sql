-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "status" "TransactionStatus" NOT NULL DEFAULT 'CONFIRMED';
