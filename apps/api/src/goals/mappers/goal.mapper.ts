import { SavingsGoal } from '@prisma/client';
import { GoalResponseDto } from '../dto/goal-response.dto';

export type GoalWithAccount = SavingsGoal & { account: { id: string; name: string } | null };

export class GoalMapper {
  static toResponse(goal: GoalWithAccount): GoalResponseDto {
    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);

    return {
      id: goal.id,
      name: goal.name,
      targetAmount,
      currentAmount,
      currency: goal.currency,
      percentComplete: targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0,
      targetDate: goal.targetDate,
      account: goal.account,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }

  static toResponseList(goals: GoalWithAccount[]): GoalResponseDto[] {
    return goals.map(GoalMapper.toResponse);
  }
}
