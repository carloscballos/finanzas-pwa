import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { TransfersService } from '../transfers/transfers.service';
import { GoalsRepository } from './goals.repository';
import { GoalMapper, GoalWithAccount } from './mappers/goal.mapper';
import { GoalResponseDto } from './dto/goal-response.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { CurrencyCode } from '../common/currency';

const DEFAULT_CURRENCY = CurrencyCode.COP;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Una meta ES una cuenta oculta (type GOAL): lo ahorrado es su saldo, aportar es
// una transferencia desde una cuenta real hacia ella (para la cuenta de origen
// es un gasto: ya no es dinero disponible) y retirar es la transferencia de vuelta.
@Injectable()
export class GoalsService {
  constructor(
    private readonly goalsRepository: GoalsRepository,
    private readonly accountsService: AccountsService,
    private readonly transfersService: TransfersService,
  ) {}

  async findAllForUser(userId: string): Promise<GoalResponseDto[]> {
    const goals = await this.goalsRepository.findAllForUser(userId);
    const saved = await this.savedAmounts(goals);
    return goals.map((goal) => GoalMapper.toResponse(goal, saved.get(goal.id) ?? 0));
  }

  async findOne(userId: string, id: string): Promise<GoalResponseDto> {
    const goal = await this.getOwnedGoal(userId, id);
    return this.toResponse(goal);
  }

  async create(userId: string, dto: CreateGoalDto): Promise<GoalResponseDto> {
    const created = await this.goalsRepository.create(userId, dto, dto.currency ?? DEFAULT_CURRENCY);
    return this.toResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto): Promise<GoalResponseDto> {
    await this.getOwnedGoal(userId, id);
    const updated = await this.goalsRepository.update(id, dto);
    return this.toResponse(updated);
  }

  // Si la meta tiene dinero ahorrado, se devuelve a `refundAccountId` con una
  // transferencia antes de borrarla — sin esto ese dinero se perdería, porque ya
  // salió de las cuentas reales cuando se aportó.
  async remove(userId: string, id: string, refundAccountId?: string): Promise<void> {
    const goal = await this.getOwnedGoal(userId, id);
    const saved = await this.savedAmount(goal);

    if (saved > 0) {
      if (!refundAccountId) {
        throw new BadRequestException(
          `La meta tiene ${saved.toFixed(2)} ${goal.currency} ahorrados: indica a qué cuenta devolverlos (refundAccountId)`,
        );
      }
      const refundAccount = await this.accountsService.getAccessibleAccount(userId, refundAccountId);
      this.assertSameCurrency(refundAccount.currency, goal.currency);
      await this.transfersService.create(
        userId,
        {
          fromAccountId: goal.accountId,
          toAccountId: refundAccountId,
          fromAmount: saved,
          note: `Devolución de la meta: ${goal.name}`,
        },
        { goalId: goal.id },
      );
    }

    await this.goalsRepository.delete(id);
  }

  async contribute(userId: string, id: string, dto: ContributeGoalDto): Promise<GoalResponseDto> {
    const goal = await this.getOwnedGoal(userId, id);
    const account = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    this.assertSameCurrency(account.currency, goal.currency);

    const occurredAt = dto.occurredAt;

    if (dto.amount > 0) {
      // Aportar: cuenta real -> meta. La validación de saldo es la de siempre
      // (TransfersService.create la hace sobre la cuenta de origen).
      await this.transfersService.create(
        userId,
        { fromAccountId: dto.accountId, toAccountId: goal.accountId, fromAmount: dto.amount, occurredAt },
        { goalId: goal.id },
      );
    } else {
      // Retirar: meta -> cuenta real.
      const withdraw = -dto.amount;
      const saved = await this.savedAmount(goal);
      if (withdraw > saved) {
        throw new BadRequestException('El retiro no puede dejar el ahorro acumulado en negativo');
      }
      await this.transfersService.create(
        userId,
        { fromAccountId: goal.accountId, toAccountId: dto.accountId, fromAmount: withdraw, occurredAt },
        { goalId: goal.id },
      );
    }

    return this.findOne(userId, id);
  }

  private async toResponse(goal: GoalWithAccount): Promise<GoalResponseDto> {
    return GoalMapper.toResponse(goal, await this.savedAmount(goal));
  }

  private async savedAmount(goal: GoalWithAccount): Promise<number> {
    return (await this.savedAmounts([goal])).get(goal.id) ?? 0;
  }

  private async savedAmounts(goals: GoalWithAccount[]): Promise<Map<string, number>> {
    const net = await this.accountsService.getNetMovements(goals.map((g) => g.accountId));
    return new Map(
      goals.map((g) => [g.id, round2(Number(g.account.initialBalance) + (net.get(g.accountId) ?? 0))]),
    );
  }

  private assertSameCurrency(accountCurrency: string, goalCurrency: string): void {
    if (accountCurrency !== goalCurrency) {
      throw new BadRequestException(
        `La cuenta debe estar en ${goalCurrency} — la meta está en esa moneda`,
      );
    }
  }

  private async getOwnedGoal(userId: string, id: string): Promise<GoalWithAccount> {
    const goal = await this.goalsRepository.findById(id);
    if (!goal || goal.userId !== userId) {
      throw new NotFoundException(`Meta ${id} no encontrada`);
    }
    return goal;
  }
}
