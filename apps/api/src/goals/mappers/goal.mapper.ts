import { Prisma, SavingsGoal } from '@prisma/client';
import { GoalResponseDto } from '../dto/goal-response.dto';

// La cuenta oculta (type GOAL) que respalda la meta: su saldo es lo ahorrado.
export type GoalWithAccount = SavingsGoal & {
  account: { id: string; name: string; initialBalance: Prisma.Decimal };
};

export class GoalMapper {
  // currentAmount no es una columna: es el saldo de la cuenta de la meta, que
  // calcula el service (initialBalance + neto de movimientos).
  static toResponse(goal: GoalWithAccount, currentAmount: number): GoalResponseDto {
    const targetAmount = Number(goal.targetAmount);

    return {
      id: goal.id,
      name: goal.name,
      targetAmount,
      currentAmount,
      currency: goal.currency,
      percentComplete: targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0,
      targetDate: goal.targetDate,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }
}
