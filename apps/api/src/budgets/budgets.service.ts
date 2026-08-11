import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { BudgetsRepository } from './budgets.repository';
import { BudgetMapper, BudgetWithCategory } from './mappers/budget.mapper';
import { BudgetResponseDto } from './dto/budget-response.dto';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { getPeriodWindow } from './period-window.util';
import { CurrencyCode } from '../common/currency';

const DEFAULT_PERIOD = 'MONTHLY' as const;
const DEFAULT_CURRENCY = CurrencyCode.COP;

@Injectable()
export class BudgetsService {
  constructor(
    private readonly budgetsRepository: BudgetsRepository,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAllForUser(userId: string): Promise<BudgetResponseDto[]> {
    const budgets = await this.budgetsRepository.findAllForUser(userId);
    return Promise.all(budgets.map((budget) => this.withProgress(budget)));
  }

  async findOne(userId: string, id: string): Promise<BudgetResponseDto> {
    const budget = await this.getOwnedBudget(userId, id);
    return this.withProgress(budget);
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetResponseDto> {
    const category = await this.categoriesService.getOwnedCategory(userId, dto.categoryId);
    if (category.type !== 'EXPENSE') {
      throw new BadRequestException('Solo puedes crear presupuestos para categorías de gasto');
    }

    const period = dto.period ?? DEFAULT_PERIOD;
    const currency = dto.currency ?? DEFAULT_CURRENCY;
    const existing = await this.budgetsRepository.findByCategoryPeriodAndCurrency(
      userId,
      dto.categoryId,
      period,
      currency,
    );
    if (existing) {
      throw new ConflictException('Ya existe un presupuesto para esta categoría, periodo y moneda');
    }

    const created = await this.budgetsRepository.create(userId, { ...dto, period, currency });
    return this.withProgress(created);
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto): Promise<BudgetResponseDto> {
    const budget = await this.getOwnedBudget(userId, id);

    if (dto.period && dto.period !== budget.period) {
      const existing = await this.budgetsRepository.findByCategoryPeriodAndCurrency(
        userId,
        budget.categoryId,
        dto.period,
        budget.currency,
      );
      if (existing) {
        throw new ConflictException('Ya existe un presupuesto para esta categoría, periodo y moneda');
      }
    }

    const updated = await this.budgetsRepository.update(id, dto);
    return this.withProgress(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedBudget(userId, id);
    await this.budgetsRepository.delete(id);
  }

  private async getOwnedBudget(userId: string, id: string): Promise<BudgetWithCategory> {
    const budget = await this.budgetsRepository.findById(id);
    if (!budget || budget.userId !== userId) {
      throw new NotFoundException(`Presupuesto ${id} no encontrado`);
    }
    return budget;
  }

  private async withProgress(budget: BudgetWithCategory): Promise<BudgetResponseDto> {
    const window = getPeriodWindow(budget.period);
    const spent = await this.budgetsRepository.sumExpenses(
      budget.categoryId,
      budget.currency,
      window.start,
      window.end,
    );
    return BudgetMapper.toResponse(budget, spent, window);
  }
}
