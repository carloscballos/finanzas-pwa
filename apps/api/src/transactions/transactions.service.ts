import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, TransactionType, TransactionStatus } from '@prisma/client';
import { formatMoney } from '../common/format-money';
import { BudgetAlertsService } from '../budgets/budget-alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { TransactionsRepository } from './transactions.repository';
import { TransactionMapper, TransactionWithRelations } from './mappers/transaction.mapper';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { ExtractedReceiptResponseDto } from './dto/extracted-receipt-response.dto';
import { ReceiptExtractionService, type ReceiptMediaType } from './receipt-extraction.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly receiptExtractionService: ReceiptExtractionService,
    private readonly budgetAlertsService: BudgetAlertsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    userId: string,
    query: ListTransactionsQueryDto,
  ): Promise<TransactionResponseDto[]> {
    if (query.accountId) {
      await this.accountsService.getAccessibleAccount(userId, query.accountId);
    }
    const transactions = await this.transactionsRepository.findMany({
      userId,
      accountId: query.accountId,
      categoryId: query.categoryId,
      type: query.type,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
    return TransactionMapper.toResponseList(transactions);
  }

  async findOne(userId: string, id: string): Promise<TransactionResponseDto> {
    const transaction = await this.getAccessibleTransaction(userId, id);
    return TransactionMapper.toResponse(transaction);
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionResponseDto> {
    if (!dto.accountId && dto.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('accountId es requerido para transacciones confirmadas');
    }

    // Un pago pendiente puede llegar sin cuenta (Shortcut de Wallet): se guarda
    // en una cuenta provisional y el usuario elige la real al confirmarlo.
    if (!dto.accountId) {
      const defaultAccountId = await this.accountsService.findDefaultAccountId(userId);
      if (!defaultAccountId) {
        throw new BadRequestException('Crea una cuenta en la app antes de registrar pagos desde el Shortcut');
      }
      dto = { ...dto, accountId: defaultAccountId };
    }

    if (dto.accountId) {
      await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    }

    if (!dto.categoryId && dto.status !== TransactionStatus.PENDING) {
      throw new BadRequestException(
        'categoryId es requerido para transacciones confirmadas',
      );
    }

    if (dto.categoryId) {
      const category = await this.categoriesService.getOwnedCategory(userId, dto.categoryId);
      this.assertTypeMatches(dto.type, category.type);
    }

    // Un pago pendiente todavía no mueve saldo: se valida al confirmarlo.
    if (dto.type === TransactionType.EXPENSE && dto.accountId && dto.status !== TransactionStatus.PENDING) {
      await this.accountsService.assertSufficientFunds(userId, dto.accountId, dto.amount);
    }

    const created = await this.transactionsRepository.create(userId, dto);
    if (created.status === TransactionStatus.CONFIRMED) {
      await this.afterMovementConfirmed(userId, created);
    }
    return TransactionMapper.toResponse(created);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.getAccessibleTransaction(userId, id);
    this.assertEditable(existing);

    if (dto.accountId) {
      await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    }

    const type = dto.type ?? existing.type;
    const finalStatus = dto.status ?? existing.status;
    const finalCategoryId = dto.categoryId ?? existing.categoryId;

    if (!finalCategoryId && finalStatus !== TransactionStatus.PENDING) {
      throw new BadRequestException(
        'categoryId es requerido para transacciones confirmadas',
      );
    }

    if (dto.categoryId || dto.type) {
      const category = await this.categoriesService.getOwnedCategory(
        userId,
        dto.categoryId ?? existing.categoryId!,
      );
      this.assertTypeMatches(type, category.type);
    }

    if (type === TransactionType.EXPENSE) {
      const targetAccountId = dto.accountId ?? existing.accountId;
      const editedEffect =
        targetAccountId === existing.accountId
          ? (existing.type === TransactionType.INCOME ? 1 : -1) * Number(existing.amount)
          : 0;
      await this.accountsService.assertSufficientFunds(
        userId,
        targetAccountId,
        dto.amount ?? Number(existing.amount),
        editedEffect,
      );
    }

    const updated = await this.transactionsRepository.update(id, dto);
    // Los pagos del Shortcut de Wallet nacen PENDING y se confirman con un
    // update: ahí es cuando recién cuentan para presupuestos y miembros.
    if (existing.status === TransactionStatus.PENDING && updated.status === TransactionStatus.CONFIRMED) {
      await this.afterMovementConfirmed(userId, updated);
    }
    return TransactionMapper.toResponse(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.getAccessibleTransaction(userId, id);
    this.assertEditable(existing);
    await this.transactionsRepository.delete(id);
  }

  // Efectos laterales de un movimiento que acaba de quedar confirmado: revisar
  // los presupuestos de quien lo registró y avisar a los demás miembros de la
  // cuenta. Ninguno lanza, así que no afectan al movimiento ya guardado.
  async afterMovementConfirmed(
    userId: string,
    transaction: TransactionWithRelations,
  ): Promise<void> {
    if (transaction.type === TransactionType.EXPENSE && transaction.categoryId) {
      await this.budgetAlertsService.checkAfterExpense(userId, {
        categoryId: transaction.categoryId,
        currency: transaction.account.currency,
        amount: Number(transaction.amount),
        occurredAt: transaction.occurredAt,
      });
    }

    try {
      const account = await this.accountsService.getAccessibleAccount(userId, transaction.accountId);
      const others = account.members.filter((member) => member.userId !== userId);
      const what = transaction.type === TransactionType.EXPENSE ? 'un gasto' : 'un ingreso';
      await Promise.all(
        others.map((member) =>
          this.notificationsService.notify(member.userId, {
            type: NotificationType.SHARED_ACCOUNT_TRANSACTION,
            title: `${transaction.createdBy.name} registró ${what} de ${formatMoney(Number(transaction.amount), transaction.account.currency)} en ${account.name}`,
            body: transaction.note ?? undefined,
            link: `/accounts/${account.id}/transactions`,
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`No se pudo avisar a los miembros de la cuenta ${transaction.accountId}`, error);
    }
  }

  // Puramente de lectura — no crea ni modifica nada. Solo sugiere valores
  // para que el usuario los revise (y edite si hace falta) antes de guardar
  // el movimiento con el POST normal.
  async extractReceipt(
    userId: string,
    imageBuffer: Buffer,
    mediaType: ReceiptMediaType,
  ): Promise<ExtractedReceiptResponseDto> {
    const categories = (await this.categoriesService.findAllForUser(userId)).filter(
      (c) => c.type === TransactionType.EXPENSE,
    );

    const extracted = await this.receiptExtractionService.extractReceipt(imageBuffer, mediaType, categories);
    const suggestedCategory = extracted.categoryIndex !== null ? categories[extracted.categoryIndex] : null;

    return {
      merchant: extracted.merchant,
      amount: extracted.amount,
      occurredAt: extracted.purchaseDate,
      suggestedCategory: suggestedCategory
        ? { id: suggestedCategory.id, name: suggestedCategory.name, emoji: suggestedCategory.emoji }
        : null,
    };
  }

  private async getAccessibleTransaction(
    userId: string,
    id: string,
  ): Promise<TransactionWithRelations> {
    const transaction = await this.transactionsRepository.findById(id);
    if (!transaction) {
      throw new NotFoundException(`Movimiento ${id} no encontrado`);
    }
    await this.accountsService.getAccessibleAccount(userId, transaction.accountId);
    return transaction;
  }

  private assertTypeMatches(transactionType: TransactionType, categoryType: TransactionType): void {
    if (transactionType !== categoryType) {
      throw new BadRequestException(
        'El tipo del movimiento no coincide con el tipo de la categoría',
      );
    }
  }

  // Las patas de una transferencia, un aporte/retiro de meta o el pago de un
  // préstamo no se editan ni eliminan sueltas — solo como parte del registro
  // que las generó (TransfersService / GoalsService / LoansService), para no
  // dejar el balance de la cuenta desincronizado con esos registros.
  private assertEditable(transaction: TransactionWithRelations): void {
    if (transaction.transferId) {
      throw new BadRequestException(
        'Este movimiento es parte de una transferencia — edítala o elimínala desde ahí',
      );
    }
    if (transaction.goalId) {
      throw new BadRequestException(
        'Este movimiento es un aporte/retiro de una meta — regístralo desde la meta',
      );
    }
    if (transaction.loanId) {
      throw new BadRequestException(
        'Este movimiento es el pago de un préstamo — regístralo desde el préstamo',
      );
    }
    if (transaction.cardPurchaseId) {
      throw new BadRequestException(
        'Este movimiento es una compra a cuotas o el pago de una cuota — regístralo desde la compra',
      );
    }
    if (transaction.debtId) {
      throw new BadRequestException(
        'Este movimiento es el abono de una deuda — regístralo desde la deuda',
      );
    }
  }
}
