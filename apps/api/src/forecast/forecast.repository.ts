import { Injectable } from '@nestjs/common';
import { Budget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ExpenseTransactionForSuggestion {
  categoryId: string;
  amount: unknown; // Decimal
  category: { id: string; name: string; emoji: string | null };
  account: { currency: string };
}

@Injectable()
export class ForecastRepository {
  constructor(private readonly prisma: PrismaService) {}

  findExpenseTransactionsInWindow(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<ExpenseTransactionForSuggestion[]> {
    // categoryId: { not: null } excluye patas de transferencia (que no
    // tienen categoría) — category: { userId } ya las excluía en la
    // práctica, esto solo lo hace explícito para el tipo de retorno.
    return this.prisma.transaction.findMany({
      where: {
        type: 'EXPENSE',
        occurredAt: { gte: start, lt: end },
        categoryId: { not: null },
        category: { userId },
      },
      select: {
        categoryId: true,
        amount: true,
        category: { select: { id: true, name: true, emoji: true } },
        account: { select: { currency: true } },
      },
    }) as Promise<ExpenseTransactionForSuggestion[]>;
  }

  findBudgetsForUser(userId: string): Promise<Budget[]> {
    return this.prisma.budget.findMany({ where: { userId } });
  }

  // Desde cuándo registra movimientos el usuario — define cuántos meses de
  // historial real hay para promediar. Se mira su primer movimiento con
  // categoría PROPIA (la misma población de la que salen las sugerencias),
  // no el primer movimiento de sus cuentas: en una cuenta compartida a la
  // que se unió después, los movimientos viejos del otro miembro no son
  // historial suyo y deflarían su promedio.
  async findEarliestTransactionDate(userId: string): Promise<Date | null> {
    const first = await this.prisma.transaction.findFirst({
      where: { category: { userId } },
      orderBy: { occurredAt: 'asc' },
      select: { occurredAt: true },
    });
    return first?.occurredAt ?? null;
  }
}
