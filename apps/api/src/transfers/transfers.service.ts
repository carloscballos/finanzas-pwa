import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { TransfersRepository } from './transfers.repository';
import { TransferMapper } from './mappers/transfer.mapper';
import { TransferResponseDto } from './dto/transfer-response.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly transfersRepository: TransfersRepository,
    private readonly accountsService: AccountsService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async findForAccount(userId: string, accountId: string): Promise<TransferResponseDto[]> {
    await this.accountsService.getAccessibleAccount(userId, accountId);
    const transfers = await this.transfersRepository.findForAccount(accountId);
    return TransferMapper.toResponseList(transfers);
  }

  async create(userId: string, dto: CreateTransferDto): Promise<TransferResponseDto> {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('La cuenta origen y la cuenta destino deben ser distintas');
    }
    const fromAccount = await this.accountsService.getAccessibleAccount(userId, dto.fromAccountId);
    const toAccount = await this.accountsService.getAccessibleAccount(userId, dto.toAccountId);

    let toAmount = dto.fromAmount;
    let exchangeRate: number | null = null;

    if (fromAccount.currency !== toAccount.currency) {
      exchangeRate = dto.exchangeRate ?? (await this.resolveRate(fromAccount.currency, toAccount.currency));
      toAmount = round2(dto.fromAmount * exchangeRate);
    }

    const created = await this.transfersRepository.create(userId, {
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      fromAmount: dto.fromAmount,
      toAmount,
      exchangeRate,
      note: dto.note,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
    });
    return TransferMapper.toResponse(created);
  }

  async remove(userId: string, id: string): Promise<void> {
    const transfer = await this.transfersRepository.findById(id);
    if (!transfer) {
      throw new NotFoundException(`Transferencia ${id} no encontrada`);
    }
    const accessible =
      (await this.hasAccountAccess(userId, transfer.fromAccountId)) ||
      (await this.hasAccountAccess(userId, transfer.toAccountId));
    if (!accessible) {
      throw new NotFoundException(`Transferencia ${id} no encontrada`);
    }
    await this.transfersRepository.delete(id);
  }

  // Multiplicador fromCurrency -> toCurrency (toAmount = fromAmount ×
  // multiplicador). Solo COP/USD están soportados en toda la app
  // (common/currency.ts), así que basta con estos dos casos.
  private async resolveRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const { rate: usdToCop } = await this.exchangeRatesService.getUsdToCop();
    if (fromCurrency === 'USD' && toCurrency === 'COP') return usdToCop;
    if (fromCurrency === 'COP' && toCurrency === 'USD') return 1 / usdToCop;
    throw new BadRequestException(
      `No hay tasa automática para convertir ${fromCurrency} a ${toCurrency} — ingresa una tasa manual`,
    );
  }

  private async hasAccountAccess(userId: string, accountId: string): Promise<boolean> {
    try {
      await this.accountsService.getAccessibleAccount(userId, accountId);
      return true;
    } catch {
      return false;
    }
  }
}
