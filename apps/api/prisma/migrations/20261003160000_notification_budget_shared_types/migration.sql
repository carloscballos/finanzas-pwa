-- Nuevos tipos de aviso: presupuesto cerca/excedido y movimiento de otro
-- miembro en una cuenta compartida. Solo agrega valores (no se usan en esta
-- misma migración — ver gotcha de enums en CLAUDE.md).
ALTER TYPE "NotificationType" ADD VALUE 'BUDGET_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'BUDGET_EXCEEDED';
ALTER TYPE "NotificationType" ADD VALUE 'SHARED_ACCOUNT_TRANSACTION';
