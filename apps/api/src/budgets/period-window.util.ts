import { BudgetPeriod } from '@prisma/client';

export interface PeriodWindow {
  start: Date;
  end: Date;
}

// Ventanas de periodo en UTC: MONTHLY = mes calendario actual,
// WEEKLY = semana ISO actual (lunes a lunes).
export function getPeriodWindow(period: BudgetPeriod, now = new Date()): PeriodWindow {
  if (period === 'MONTHLY') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  }

  const dayOfWeek = now.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}
