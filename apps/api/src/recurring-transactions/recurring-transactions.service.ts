import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { TransactionMapper } from '../transactions/mappers/transaction.mapper';
import { TransactionResponseDto } from '../transactions/dto/transaction-response.dto';
import { RecurringTransactionsRepository } from './recurring-transactions.repository';
import {
  RecurringTransactionMapper,
  RecurringTransactionWithRelations,
} from './mappers/recurring-transaction.mapper';
import { RecurringTransactionResponseDto } from './dto/recurring-transaction-response.dto';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { ApplyRecurringTransactionDto } from './dto/apply-recurring-transaction.dto';

@Injectable()
export class RecurringTransactionsService {
  constructor(
    private readonly recurringRepository: RecurringTransactionsRepository,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly transactionsRepository: TransactionsRepository,
  ) {}

  async findAllForUser(userId: string): Promise<RecurringTransactionResponseDto[]> {
    const items = await this.recurringRepository.findAllForUser(userId);
    return RecurringTransactionMapper.toResponseList(items);
  }

  async findOne(userId: string, id: string): Promise<RecurringTransactionResponseDto> {
    const item = await this.getAccessible(userId, id);
    return RecurringTransactionMapper.toResponse(item);
  }

  async create(
    userId: string,
    dto: CreateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    const category = await this.categoriesService.getOwnedCategory(userId, dto.categoryId);
    if (category.type !== dto.type) {
      throw new BadRequestException(
        'El tipo del movimiento recurrente no coincide con el tipo de la categoría',
      );
    }

    const created = await this.recurringRepository.create(userId, dto);
    return RecurringTransactionMapper.toResponse(created);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    await this.getAccessible(userId, id);
    const updated = await this.recurringRepository.update(id, dto);
    return RecurringTransactionMapper.toResponse(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getAccessible(userId, id);
    await this.recurringRepository.delete(id);
  }

  // El usuario decide cuándo "aplicar" la plantilla: crea un Transaction
  // real con los valores de la plantilla, sobreescritos por lo que venga en
  // dto (cuenta/categoría/tipo no cambian — ya son válidos desde que se creó
  // la plantilla, y son inmutables).
  async apply(
    userId: string,
    id: string,
    dto: ApplyRecurringTransactionDto,
  ): Promise<TransactionResponseDto> {
    const item = await this.getAccessible(userId, id);

    const created = await this.transactionsRepository.create(
      userId,
      {
        accountId: item.accountId,
        categoryId: item.categoryId,
        type: item.type,
        amount: dto.amount ?? Number(item.amount),
        note: dto.note ?? item.note ?? undefined,
        occurredAt: dto.occurredAt,
      },
      item.id,
    );

    await this.recurringRepository.markApplied(id);
    return TransactionMapper.toResponse(created);
  }

  private async getAccessible(
    userId: string,
    id: string,
  ): Promise<RecurringTransactionWithRelations> {
    const item = await this.recurringRepository.findById(id);
    if (!item) {
      throw new NotFoundException(`Movimiento recurrente ${id} no encontrado`);
    }
    await this.accountsService.getAccessibleAccount(userId, item.accountId);
    return item;
  }
}
