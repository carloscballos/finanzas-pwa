import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { RecurringTransactionsRepository } from './recurring-transactions.repository';
import {
  RecurringTransactionMapper,
  RecurringTransactionWithRelations,
} from './mappers/recurring-transaction.mapper';
import { RecurringTransactionResponseDto } from './dto/recurring-transaction-response.dto';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { addInterval } from './recurrence.util';

// Tope de seguridad: si una plantilla llevara mucho tiempo sin correr (ej.
// servidor apagado meses), no generamos un número ilimitado de ocurrencias
// atrasadas de golpe.
const MAX_CATCH_UP_OCCURRENCES = 60;

@Injectable()
export class RecurringTransactionsService {
  private readonly logger = new Logger(RecurringTransactionsService.name);

  constructor(
    private readonly recurringRepository: RecurringTransactionsRepository,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
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
    // Si ya está vencida desde el día 1 (startDate <= ahora), no hace falta
    // esperar al cron de la 1am ni a un reinicio: se genera de inmediato.
    await this.runDueGenerationFor(created, new Date());
    const fresh = await this.recurringRepository.findById(created.id);
    return RecurringTransactionMapper.toResponse(fresh!);
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

  // Genera todas las ocurrencias vencidas (nextRunDate <= now) de una sola
  // plantilla y avanza su nextRunDate. Usado tanto al crear (primera
  // ocurrencia inmediata si aplica) como por el scheduler (cron diario).
  async runDueGenerationFor(item: RecurringTransactionWithRelations, now: Date): Promise<void> {
    const occurredAtDates: Date[] = [];
    let cursor = item.nextRunDate;
    let iterations = 0;

    while (
      cursor <= now &&
      (!item.endDate || cursor <= item.endDate) &&
      iterations < MAX_CATCH_UP_OCCURRENCES
    ) {
      occurredAtDates.push(cursor);
      cursor = addInterval(cursor, item.frequency);
      iterations++;
    }

    const stillActive = !item.endDate || cursor <= item.endDate;

    if (occurredAtDates.length === 0) {
      if (!stillActive && item.active) {
        await this.recurringRepository.generateOccurrences(item, [], cursor, false);
      }
      return;
    }

    await this.recurringRepository.generateOccurrences(item, occurredAtDates, cursor, stillActive);
    this.logger.log(`Generó ${occurredAtDates.length} movimiento(s) para ${item.id}`);
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
