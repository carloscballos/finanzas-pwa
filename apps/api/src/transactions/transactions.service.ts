import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { TransactionsRepository } from './transactions.repository';
import { TransactionMapper, TransactionWithRelations } from './mappers/transaction.mapper';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
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
    await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    const category = await this.categoriesService.getOwnedCategory(userId, dto.categoryId);
    this.assertTypeMatches(dto.type, category.type);

    const created = await this.transactionsRepository.create(userId, dto);
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
    const category =
      dto.categoryId || dto.type
        // existing.categoryId solo es null en patas de transferencia, ya
        // descartadas arriba por assertNotTransferLeg.
        ? await this.categoriesService.getOwnedCategory(userId, dto.categoryId ?? existing.categoryId!)
        : existing.category!;
    this.assertTypeMatches(type, category.type);

    const updated = await this.transactionsRepository.update(id, dto);
    return TransactionMapper.toResponse(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.getAccessibleTransaction(userId, id);
    this.assertEditable(existing);
    await this.transactionsRepository.delete(id);
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
  }
}
