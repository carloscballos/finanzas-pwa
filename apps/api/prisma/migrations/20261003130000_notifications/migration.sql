-- Notificaciones dentro de la app (campana). Una fila por usuario y aviso.
CREATE TYPE "NotificationType" AS ENUM (
  'FRIEND_REQUEST_RECEIVED',
  'FRIEND_REQUEST_ACCEPTED',
  'ACCOUNT_INVITATION_RECEIVED',
  'ACCOUNT_INVITATION_ACCEPTED',
  'DEBT_CREATED',
  'DEBT_PAYMENT_PENDING',
  'DEBT_PAYMENT_CONFIRMED',
  'DEBT_PAYMENT_REJECTED'
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
