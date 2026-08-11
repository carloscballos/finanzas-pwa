import { Injectable } from '@nestjs/common';
import { BudgetPeriod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetWithCategory } from './mappers/budget.mapper';

const WITH_CATEGORY = { category: { select: { id: true, name: true, emoji: true } } } as const;

@Injectable()
export class BudgetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<BudgetWithCategory[]> {
    return this.prisma.budget.findMany({
      where: { userId },
      include: WITH_CATEGORY,
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<BudgetWithCategory | null> {
    return this.prisma.budget.findUnique({ where: { id }, include: WITH_CATEGORY });
  }

  findByCategoryPeriodAndCurrency(
    userId: string,
    categoryId: string,
    period: BudgetPeriod,
    currency: string,
  ): Promise<BudgetWithCategory | null> {
    return this.prisma.budget.findUnique({
      where: { userId_categoryId_period_currency: { userId, categoryId, period, currency } },
      include: WITH_CATEGORY,
    });
  }

  create(userId: string, dto: CreateBudgetDto): Promise<BudgetWithCategory> {
    return this.prisma.budget.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        limitAmount: dto.limitAmount,
        currency: dto.currency,
        period: dto.period,
      },
      include: WITH_CATEGORY,
    });
  }

  update(id: string, dto: UpdateBudgetDto): Promise<BudgetWithCategory> {
    return this.prisma.budget.update({
      where: { id },
      data: { limitAmount: dto.limitAmount, period: dto.period },
      include: WITH_CATEGORY,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.budget.delete({ where: { id } });
  }

  // Solo cuenta gastos de cuentas en la misma moneda que el presupuesto,
  // para no mezclar montos de distintas divisas en una sola suma.
  async sumExpenses(categoryId: string, currency: string, from: Date, to: Date): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        categoryId,
        type: 'EXPENSE',
        occurredAt: { gte: from, lt: to },
        account: { currency },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}
