import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalWithAccount } from './mappers/goal.mapper';

const WITH_ACCOUNT = { account: { select: { id: true, name: true } } } as const;

export interface AddContributionInput {
  goalId: string;
  accountId: string;
  userId: string;
  amount: number;
  occurredAt: Date;
}

@Injectable()
export class GoalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<GoalWithAccount[]> {
    return this.prisma.savingsGoal.findMany({
      where: { userId },
      include: WITH_ACCOUNT,
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<GoalWithAccount | null> {
    return this.prisma.savingsGoal.findUnique({ where: { id }, include: WITH_ACCOUNT });
  }

  create(userId: string, dto: CreateGoalDto, currency: string): Promise<GoalWithAccount> {
    return this.prisma.savingsGoal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        currency,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        accountId: dto.accountId,
      },
      include: WITH_ACCOUNT,
    });
  }

  update(id: string, dto: UpdateGoalDto, currency?: string): Promise<GoalWithAccount> {
    return this.prisma.savingsGoal.update({
      where: { id },
      data: {
        name: dto.name,
        targetAmount: dto.targetAmount,
        currency,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        accountId: dto.accountId,
      },
      include: WITH_ACCOUNT,
    });
  }

  // Transacción interactiva (no el array form) porque hay que crear el
  // Transaction real y actualizar currentAmount de forma atómica — mismo
  // principio que TransfersRepository.create. amount positivo (aportar) crea
  // un EXPENSE en accountId; negativo (retirar) crea un INCOME por el valor
  // absoluto — en ambos casos sin categoría (categoryId null), igual que las
  // patas de una transferencia.
  async addContribution(input: AddContributionInput): Promise<GoalWithAccount> {
    const goalId = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          accountId: input.accountId,
          type: input.amount > 0 ? 'EXPENSE' : 'INCOME',
          amount: Math.abs(input.amount),
          occurredAt: input.occurredAt,
          createdByUserId: input.userId,
          goalId: input.goalId,
        },
      });
      const goal = await tx.savingsGoal.update({
        where: { id: input.goalId },
        data: { currentAmount: { increment: input.amount } },
      });
      return goal.id;
    });

    return (await this.findById(goalId))!;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.savingsGoal.delete({ where: { id } });
  }
}
