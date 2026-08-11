import { Injectable } from '@nestjs/common';
import { RecurrenceFrequency } from '@prisma/client';
import { RecurringTransactionsRepository } from '../recurring-transactions/recurring-transactions.repository';
import { ForecastRepository } from './forecast.repository';
import { ForecastSummaryDto } from './dto/forecast-summary.dto';
import { BudgetSuggestionDto } from './dto/budget-suggestion.dto';
import { getTrailingWindow } from './trailing-window.util';

const MONTHS_OF_HISTORY = 3;
const WEEKS_PER_MONTH = 52 / 12;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toMonthlyEquivalent(amount: number, frequency: RecurrenceFrequency): number {
  if (frequency === 'WEEKLY') return amount * WEEKS_PER_MONTH;
  if (frequency === 'SEMIMONTHLY') return amount * 2;
  if (frequency === 'YEARLY') return amount / 12;
  return amount;
}

@Injectable()
export class ForecastService {
  constructor(
    private readonly forecastRepository: ForecastRepository,
    private readonly recurringRepository: RecurringTransactionsRepository,
  ) {}

  async getSummary(userId: string): Promise<ForecastSummaryDto[]> {
    const recurring = await this.recurringRepository.findAllForUser(userId);
    const byCurrency = new Map<string, { income: number; expense: number }>();

    for (const item of recurring) {
      if (!item.active) continue;
      const monthly = toMonthlyEquivalent(Number(item.amount), item.frequency);
      const bucket = byCurrency.get(item.account.currency) ?? { income: 0, expense: 0 };
      if (item.type === 'INCOME') {
        bucket.income += monthly;
      } else {
        bucket.expense += monthly;
      }
      byCurrency.set(item.account.currency, bucket);
    }

    return Array.from(byCurrency.entries()).map(([currency, { income, expense }]) => ({
      currency,
      projectedMonthlyIncome: round2(income),
      projectedMonthlyExpense: round2(expense),
      projectedMonthlyNet: round2(income - expense),
    }));
  }

  async getBudgetSuggestions(userId: string): Promise<BudgetSuggestionDto[]> {
    const window = getTrailingWindow(MONTHS_OF_HISTORY);
    const [transactions, budgets] = await Promise.all([
      this.forecastRepository.findExpenseTransactionsInWindow(userId, window.start, window.end),
      this.forecastRepository.findBudgetsForUser(userId),
    ]);

    interface Accumulator {
      categoryId: string;
      categoryName: string;
      categoryEmoji: string | null;
      currency: string;
      total: number;
    }

    const sums = new Map<string, Accumulator>();
    for (const tx of transactions) {
      const key = `${tx.categoryId}:${tx.account.currency}`;
      const existing = sums.get(key) ?? {
        categoryId: tx.categoryId,
        categoryName: tx.category.name,
        categoryEmoji: tx.category.emoji,
        currency: tx.account.currency,
        total: 0,
      };
      existing.total += Number(tx.amount);
      sums.set(key, existing);
    }

    return Array.from(sums.values())
      .map((s) => {
        const existingBudget = budgets.find(
          (b) => b.categoryId === s.categoryId && b.currency === s.currency,
        );
        return {
          category: { id: s.categoryId, name: s.categoryName, emoji: s.categoryEmoji },
          currency: s.currency,
          averageMonthlySpend: round2(s.total / MONTHS_OF_HISTORY),
          existingBudget: existingBudget
            ? {
                id: existingBudget.id,
                limitAmount: Number(existingBudget.limitAmount),
                period: existingBudget.period,
              }
            : null,
        };
      })
      .sort((a, b) => b.averageMonthlySpend - a.averageMonthlySpend);
  }
}
