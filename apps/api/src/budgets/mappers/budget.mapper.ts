import { Budget } from '@prisma/client';
import { BudgetResponseDto } from '../dto/budget-response.dto';
import { PeriodWindow } from '../period-window.util';

export type BudgetWithCategory = Budget & {
  category: { id: string; name: string; emoji: string | null };
};

export class BudgetMapper {
  static toResponse(budget: BudgetWithCategory, spent: number, window: PeriodWindow): BudgetResponseDto {
    const limitAmount = Number(budget.limitAmount);
    const remaining = limitAmount - spent;
    const percentUsed = limitAmount > 0 ? Math.round((spent / limitAmount) * 100) : 0;

    return {
      id: budget.id,
      category: budget.category,
      limitAmount,
      currency: budget.currency,
      period: budget.period,
      spent,
      remaining,
      percentUsed,
      periodStart: window.start,
      periodEnd: window.end,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
