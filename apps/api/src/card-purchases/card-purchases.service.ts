import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { CardPurchasesRepository } from './card-purchases.repository';
import { CardPurchaseMapper, CardPurchaseWithAccount } from './mappers/card-purchase.mapper';
import { CardPurchaseResponseDto } from './dto/card-purchase-response.dto';
import { CreateCardPurchaseDto } from './dto/create-card-purchase.dto';
import { UpdateCardPurchaseDto } from './dto/update-card-purchase.dto';
import { PayCardPurchaseInstallmentDto } from './dto/pay-card-purchase-installment.dto';
import { StatementMatchType, StatementPreviewItemDto } from './dto/statement-preview-item.dto';
import { StatementExtractionService } from './statement-extraction.service';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Comparación tolerante: mismo comercio puede aparecer con mayúsculas,
// acentos o espacios distintos entre el extracto y lo ya registrado.
// Quita diacríticos por código de punto (0x0300-0x036F, marcas combinantes)
// en vez de un regex con caracteres unicode literales, para que el rango sea
// inequívoco en el código fuente.
function normalizeMerchant(name: string): string {
  let stripped = '';
  for (const ch of name.normalize('NFD')) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0300 && code <= 0x036f) continue;
    stripped += ch;
  }
  return stripped.toLowerCase().trim().replace(/\s+/g, ' ');
}

function merchantsMatch(a: string, b: string): boolean {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

@Injectable()
export class CardPurchasesService {
  constructor(
    private readonly cardPurchasesRepository: CardPurchasesRepository,
    private readonly accountsService: AccountsService,
    private readonly statementExtractionService: StatementExtractionService,
  ) {}

  async findAllForUser(userId: string): Promise<CardPurchaseResponseDto[]> {
    const purchases = await this.cardPurchasesRepository.findAllForUser(userId);
    return CardPurchaseMapper.toResponseList(purchases);
  }

  async findForAccount(userId: string, accountId: string): Promise<CardPurchaseResponseDto[]> {
    await this.accountsService.getAccessibleAccount(userId, accountId);
    const purchases = await this.cardPurchasesRepository.findForAccount(accountId);
    return CardPurchaseMapper.toResponseList(purchases);
  }

  async findOne(userId: string, id: string): Promise<CardPurchaseResponseDto> {
    const purchase = await this.getOwnedPurchase(userId, id);
    return CardPurchaseMapper.toResponse(purchase);
  }

  async create(userId: string, dto: CreateCardPurchaseDto): Promise<CardPurchaseResponseDto> {
    const account = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    if (account.type !== 'CREDIT_CARD') {
      throw new BadRequestException(
        'Solo se pueden registrar compras a cuotas en cuentas de tipo tarjeta de crédito',
      );
    }

    const installmentsPaid = dto.installmentsPaid ?? 0;
    if (installmentsPaid > dto.installmentsTotal) {
      throw new BadRequestException('Las cuotas ya pagadas no pueden ser más que el total de cuotas');
    }
    // Solo se contabiliza lo que sigue pendiente hoy — si se está importando
    // una compra que ya traía cuotas pagadas antes de usar la app, esas
    // cuotas pasadas no generan ningún movimiento nuevo.
    const remainingBalance = round2(
      Math.max(0, dto.amount - installmentsPaid * dto.installmentAmount),
    );

    const created = await this.cardPurchasesRepository.create({
      userId,
      accountId: dto.accountId,
      merchant: dto.merchant,
      amount: dto.amount,
      remainingBalance,
      installmentsTotal: dto.installmentsTotal,
      installmentsPaid,
      installmentAmount: dto.installmentAmount,
      interestRate: dto.interestRate,
      purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
      status: remainingBalance <= 0 ? 'PAID_OFF' : 'ACTIVE',
      bookTransaction: !dto.alreadyInBalance,
    });
    return CardPurchaseMapper.toResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateCardPurchaseDto): Promise<CardPurchaseResponseDto> {
    const purchase = await this.getOwnedPurchase(userId, id);

    // installmentAmount es editable a propósito (a diferencia de Loan) para
    // poder corregir la cuota estimada cuando llega el extracto real —
    // remainingBalance se recalcula sobre lo que falta hoy, sin tocar
    // ningún movimiento ya registrado ni el saldo de la cuenta.
    let remainingBalance: number | undefined;
    let status: 'ACTIVE' | 'PAID_OFF' | undefined;
    if (dto.installmentAmount !== undefined) {
      remainingBalance = round2(
        Math.max(0, (purchase.installmentsTotal - purchase.installmentsPaid) * dto.installmentAmount),
      );
      status = remainingBalance <= 0 ? 'PAID_OFF' : 'ACTIVE';
    }

    const updated = await this.cardPurchasesRepository.update(id, {
      merchant: dto.merchant,
      interestRate: dto.interestRate,
      installmentAmount: dto.installmentAmount,
      remainingBalance,
      status,
    });
    return CardPurchaseMapper.toResponse(updated);
  }

  async payInstallment(
    userId: string,
    id: string,
    dto: PayCardPurchaseInstallmentDto,
  ): Promise<CardPurchaseResponseDto> {
    const purchase = await this.getOwnedPurchase(userId, id);
    if (purchase.status === 'PAID_OFF') {
      throw new ConflictException('Esta compra ya está pagada por completo');
    }
    if (dto.accountId === purchase.accountId) {
      throw new BadRequestException('La cuenta de pago debe ser distinta a la tarjeta');
    }

    const payingAccount = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    if (payingAccount.currency !== purchase.account.currency) {
      throw new BadRequestException(
        `La cuenta debe estar en ${purchase.account.currency} — la tarjeta está en esa moneda`,
      );
    }

    const remaining = Number(purchase.remainingBalance);
    const requested = dto.amount ?? Number(purchase.installmentAmount);
    // La última cuota puede ser menor que installmentAmount — nunca se paga
    // de más ni queda remainingBalance negativo.
    const amount = Math.min(requested, remaining);
    const newRemaining = round2(remaining - amount);

    const updated = await this.cardPurchasesRepository.registerInstallmentPayment({
      cardPurchaseId: id,
      cardAccountId: purchase.accountId,
      payingAccountId: dto.accountId,
      userId,
      amount,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      remainingBalance: newRemaining,
      status: newRemaining <= 0 ? 'PAID_OFF' : 'ACTIVE',
    });
    return CardPurchaseMapper.toResponse(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedPurchase(userId, id);
    await this.cardPurchasesRepository.delete(id);
  }

  // Solo lectura: no crea ni modifica nada. El usuario confirma cada fila
  // desde el frontend usando los endpoints ya existentes (create/payInstallment)
  // — así la conciliación reusa exactamente la misma lógica ya probada, en
  // vez de duplicar la contabilización de compras/pagos.
  async previewStatement(
    userId: string,
    accountId: string,
    pdfBuffer: Buffer,
  ): Promise<StatementPreviewItemDto[]> {
    const account = await this.accountsService.getAccessibleAccount(userId, accountId);
    if (account.type !== 'CREDIT_CARD') {
      throw new BadRequestException('Solo se pueden conciliar extractos de tarjetas de crédito');
    }

    const [{ statementDate, purchases: extracted }, existing] = await Promise.all([
      this.statementExtractionService.extractPurchases(pdfBuffer),
      this.cardPurchasesRepository.findForAccount(accountId),
    ]);
    const activeExisting = existing.filter((p) => p.status === 'ACTIVE');

    return extracted.map((item): StatementPreviewItemDto => {
      const installmentsTotal = item.installmentTotal ?? 1;
      const installmentCurrent = item.installmentCurrent ?? 1;
      const installmentAmount = item.installmentAmount;
      const amount = item.originalAmount ?? round2(installmentAmount * installmentsTotal);

      const match = activeExisting.find(
        (p) => merchantsMatch(p.merchant, item.merchant) && p.installmentsTotal === installmentsTotal,
      );

      if (!match) {
        const purchasedAtSource = item.purchaseDate ?? statementDate;
        return {
          merchant: item.merchant,
          amount,
          installmentsTotal,
          installmentAmount,
          matchType: StatementMatchType.NEW,
          suggestedInstallmentsPaid: Math.max(0, installmentCurrent - 1),
          purchasedAt: purchasedAtSource ? new Date(purchasedAtSource).toISOString() : undefined,
        };
      }

      const cuotasBehind = installmentCurrent - match.installmentsPaid;
      if (cuotasBehind <= 0) {
        return {
          merchant: item.merchant,
          amount,
          installmentsTotal,
          installmentAmount,
          matchType: StatementMatchType.UP_TO_DATE,
          purchaseId: match.id,
          currentInstallmentsPaid: match.installmentsPaid,
        };
      }

      return {
        merchant: item.merchant,
        amount,
        installmentsTotal,
        installmentAmount,
        matchType: StatementMatchType.BEHIND,
        purchaseId: match.id,
        currentInstallmentsPaid: match.installmentsPaid,
        statementInstallmentCurrent: installmentCurrent,
        cuotasBehind,
      };
    });
  }

  private async getOwnedPurchase(userId: string, id: string): Promise<CardPurchaseWithAccount> {
    const purchase = await this.cardPurchasesRepository.findById(id);
    if (!purchase || purchase.userId !== userId) {
      throw new NotFoundException(`Compra ${id} no encontrada`);
    }
    return purchase;
  }
}
