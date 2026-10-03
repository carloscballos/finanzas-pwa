import { Injectable } from '@nestjs/common';
import { AccountMemberRole, AccountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalWithAccount } from './mappers/goal.mapper';

const WITH_ACCOUNT = { account: { select: { id: true, name: true, initialBalance: true } } } as const;

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

  // Crear la meta crea su cuenta oculta (type GOAL) en la misma operación, con el
  // mismo usuario como OWNER: así las transferencias de aporte/retiro pasan por
  // la validación de acceso de siempre.
  create(userId: string, dto: CreateGoalDto, currency: string): Promise<GoalWithAccount> {
    return this.prisma.savingsGoal.create({
      data: {
        user: { connect: { id: userId } },
        name: dto.name,
        targetAmount: dto.targetAmount,
        currency,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        account: {
          create: {
            name: dto.name,
            type: AccountType.GOAL,
            currency,
            members: { create: { userId, role: AccountMemberRole.OWNER } },
          },
        },
      },
      include: WITH_ACCOUNT,
    });
  }

  // El nombre de la cuenta oculta acompaña al de la meta (así los movimientos
  // dicen "Transferencia hacia <meta>" aunque la meta ya no exista).
  update(id: string, dto: UpdateGoalDto): Promise<GoalWithAccount> {
    return this.prisma.savingsGoal.update({
      where: { id },
      data: {
        name: dto.name,
        targetAmount: dto.targetAmount,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        account: dto.name ? { update: { name: dto.name } } : undefined,
      },
      include: WITH_ACCOUNT,
    });
  }

  // Solo se borra la meta: su cuenta oculta se conserva (ya en cero tras la
  // devolución) para no perder el historial de los movimientos.
  async delete(id: string): Promise<void> {
    await this.prisma.savingsGoal.delete({ where: { id } });
  }
}
