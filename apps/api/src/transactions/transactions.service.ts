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
    const transactions = await this.transactionsRepository.findMany({ userId, ...query });
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
    this.assertNotTransferLeg(existing);

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
    this.assertNotTransferLeg(existing);
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

  // Las patas de una transferencia (transferId no nulo) solo se editan o
  // eliminan como parte de la transferencia completa (ver TransfersService),
  // nunca sueltas — si no, quedaría una transferencia con una sola pata.
  private assertNotTransferLeg(transaction: TransactionWithRelations): void {
    if (transaction.transferId) {
      throw new BadRequestException(
        'Este movimiento es parte de una transferencia — edítala o elimínala desde ahí',
      );
    }
  }
}
