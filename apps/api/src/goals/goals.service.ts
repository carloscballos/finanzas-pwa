import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { GoalsRepository } from './goals.repository';
import { GoalMapper, GoalWithAccount } from './mappers/goal.mapper';
import { GoalResponseDto } from './dto/goal-response.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { CurrencyCode } from '../common/currency';

const DEFAULT_CURRENCY = CurrencyCode.COP;

@Injectable()
export class GoalsService {
  constructor(
    private readonly goalsRepository: GoalsRepository,
    private readonly accountsService: AccountsService,
  ) {}

  async findAllForUser(userId: string): Promise<GoalResponseDto[]> {
    const goals = await this.goalsRepository.findAllForUser(userId);
    return GoalMapper.toResponseList(goals);
  }

  async findOne(userId: string, id: string): Promise<GoalResponseDto> {
    const goal = await this.getOwnedGoal(userId, id);
    return GoalMapper.toResponse(goal);
  }

  async create(userId: string, dto: CreateGoalDto): Promise<GoalResponseDto> {
    // Si la meta está ligada a una cuenta, hereda su moneda (ignora
    // cualquier `currency` que haya mandado el cliente); si no, usa la que
    // eligió o COP por default.
    let currency: string = dto.currency ?? DEFAULT_CURRENCY;
    if (dto.accountId) {
      const account = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
      currency = account.currency;
    }
    const created = await this.goalsRepository.create(userId, dto, currency);
    return GoalMapper.toResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto): Promise<GoalResponseDto> {
    await this.getOwnedGoal(userId, id);

    // Si se cambia la cuenta ligada, la moneda de la meta se actualiza para
    // seguir siendo consistente con esa cuenta.
    let currency: string | undefined;
    if (dto.accountId) {
      const account = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
      currency = account.currency;
    }

    const updated = await this.goalsRepository.update(id, dto, currency);
    return GoalMapper.toResponse(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedGoal(userId, id);
    await this.goalsRepository.delete(id);
  }

  async contribute(userId: string, id: string, dto: ContributeGoalDto): Promise<GoalResponseDto> {
    const goal = await this.getOwnedGoal(userId, id);
    const newAmount = Number(goal.currentAmount) + dto.amount;
    if (newAmount < 0) {
      throw new BadRequestException('El retiro no puede dejar el ahorro acumulado en negativo');
    }

    const account = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    if (account.currency !== goal.currency) {
      throw new BadRequestException(
        `La cuenta debe estar en ${goal.currency} — la meta está en esa moneda`,
      );
    }

    const updated = await this.goalsRepository.addContribution({
      goalId: id,
      accountId: dto.accountId,
      userId,
      amount: dto.amount,
      occurredAt: new Date(),
    });
    return GoalMapper.toResponse(updated);
  }

  private async getOwnedGoal(userId: string, id: string): Promise<GoalWithAccount> {
    const goal = await this.goalsRepository.findById(id);
    if (!goal || goal.userId !== userId) {
      throw new NotFoundException(`Meta ${id} no encontrada`);
    }
    return goal;
  }
}
