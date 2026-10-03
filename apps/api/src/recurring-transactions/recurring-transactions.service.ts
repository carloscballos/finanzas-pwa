import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { colombiaToday, parseDateOnly } from '../common/colombia-time';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { TransactionMapper } from '../transactions/mappers/transaction.mapper';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionResponseDto } from '../transactions/dto/transaction-response.dto';
import { AutoSchedule, RecurringTransactionsRepository } from './recurring-transactions.repository';
import { nextOccurrence } from './recurrence.util';
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
    private readonly transactionsService: TransactionsService,
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

    const schedule = this.buildSchedule(dto.autoApply ?? false, dto.startDate);
    const created = await this.recurringRepository.create(userId, dto, schedule);
    return RecurringTransactionMapper.toResponse(created);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    await this.getAccessible(userId, id);
    // Solo se toca el calendario si el cliente envía autoApply: activarlo exige
    // startDate; apagarlo borra el calendario.
    const schedule =
      dto.autoApply === undefined ? undefined : this.buildSchedule(dto.autoApply, dto.startDate);
    const updated = await this.recurringRepository.update(id, dto, schedule);
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
    const amount = dto.amount ?? Number(item.amount);
    if (item.type === 'EXPENSE') {
      await this.accountsService.assertSufficientFunds(userId, item.accountId, amount);
    }

    const created = await this.transactionsRepository.create(
      userId,
      {
        accountId: item.accountId,
        categoryId: item.categoryId,
        type: item.type,
        amount,
        note: dto.note ?? item.note ?? undefined,
        occurredAt: dto.occurredAt,
      },
      item.id,
    );

    // Si es automática y ya le tocaba (o estaba atrasada), este registro manual
    // cubre esa fecha: se adelanta el calendario para que el cron no la repita.
    if (item.autoApply && item.scheduleStart && item.nextRunOn && item.nextRunOn <= colombiaToday()) {
      await this.recurringRepository.markAppliedAndAdvance(
        id,
        nextOccurrence(item.frequency, item.scheduleStart, item.nextRunOn),
      );
    } else {
      await this.recurringRepository.markApplied(id);
    }
    await this.transactionsService.afterMovementConfirmed(userId, created);
    return TransactionMapper.toResponse(created);
  }

  // autoApply=true exige una primera fecha futura (hora de Colombia): "mañana
  // o después" evita la ambigüedad de una fecha de hoy cuando el cron ya pasó.
  private buildSchedule(autoApply: boolean, startDate?: string): AutoSchedule {
    if (!autoApply) return { autoApply: false, scheduleStart: null, nextRunOn: null };
    if (!startDate) {
      throw new BadRequestException('Para el registro automático indica la primera fecha (startDate)');
    }
    const start = parseDateOnly(startDate);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('startDate no es una fecha válida');
    }
    if (start <= colombiaToday()) {
      throw new BadRequestException('La primera fecha del registro automático debe ser posterior a hoy');
    }
    return { autoApply: true, scheduleStart: start, nextRunOn: start };
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
