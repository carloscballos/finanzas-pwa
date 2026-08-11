import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalWithAccount } from './mappers/goal.mapper';

const WITH_ACCOUNT = { account: { select: { id: true, name: true } } } as const;

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

  addContribution(id: string, amount: number): Promise<GoalWithAccount> {
    return this.prisma.savingsGoal.update({
      where: { id },
      data: { currentAmount: { increment: amount } },
      include: WITH_ACCOUNT,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.savingsGoal.delete({ where: { id } });
  }
}
