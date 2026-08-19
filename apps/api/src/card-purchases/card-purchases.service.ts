import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { CardPurchasesRepository } from './card-purchases.repository';
import { CardPurchaseMapper, CardPurchaseWithAccount } from './mappers/card-purchase.mapper';
import { CardPurchaseResponseDto } from './dto/card-purchase-response.dto';
import { CreateCardPurchaseDto } from './dto/create-card-purchase.dto';
import { UpdateCardPurchaseDto } from './dto/update-card-purchase.dto';
import { PayCardPurchaseInstallmentDto } from './dto/pay-card-purchase-installment.dto';
import { PayMonthlyInstallmentsDto } from './dto/pay-monthly-installments.dto';
import { StatementMatchType, StatementPreviewItemDto } from './dto/statement-preview-item.dto';
import { ExtractedStatementPurchase, StatementExtractionService } from './statement-extraction.service';

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

function isSameDate(a: Date, isoDate: string): boolean {
  return a.toISOString().slice(0, 10) === isoDate;
}

// Comercio + total de cuotas no siempre identifica una sola compra: un banco
// puede rediferir cada cargo mensual de una misma suscripción como una
// compra nueva con el mismo installmentsTotal (ej. 4 compras "Claude.Ai
// Subscription" a 24 cuotas, cada una de un mes distinto). Cuando hay más de
// un candidato, desempata por fecha de compra original y, si tampoco
// alcanza, por el monto total — nunca por orden de aparición.
function findExistingMatch(
  candidates: CardPurchaseWithAccount[],
  item: ExtractedStatementPurchase,
  amount: number,
): CardPurchaseWithAccount | undefined {
  if (candidates.length <= 1) return candidates[0];

  if (item.purchaseDate) {
    const byDate = candidates.find((p) => isSameDate(p.purchasedAt, item.purchaseDate!));
    if (byDate) return byDate;
  }
  return candidates.find((p) => Math.abs(Number(p.amount) - amount) < 0.01) ?? candidates[0];
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
    // de más ni queda remainingBalance negativo. El interés (si lo hay) no
    // participa de este cálculo — ver registerInstallmentPayment.
    const capitalAmount = Math.min(requested, remaining);
    const newRemaining = round2(remaining - capitalAmount);

    const updated = await this.cardPurchasesRepository.registerInstallmentPayment({
      cardPurchaseId: id,
      cardAccountId: purchase.accountId,
      payingAccountId: dto.accountId,
      userId,
      capitalAmount,
      interestAmount: dto.interestAmount ?? 0,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      remainingBalance: newRemaining,
      status: newRemaining <= 0 ? 'PAID_OFF' : 'ACTIVE',
    });
    return CardPurchaseMapper.toResponse(updated);
  }

  // Paga una cuota de cada compra activa de la tarjeta con un solo
  // movimiento (una Transfer real, no un par de Transaction por compra) —
  // así el extracto bancario, que muestra un solo cargo por el total, se
  // refleja igual en la app. El total registrado es editable (dto.amount)
  // para que coincida con lo que realmente se pagó; el avance de cada
  // compra siempre usa su propia cuota (capada a lo que le falte), sin
  // importar el total que se haya escrito.
  async payMonthlyInstallments(
    userId: string,
    dto: PayMonthlyInstallmentsDto,
  ): Promise<CardPurchaseResponseDto[]> {
    const cardAccount = await this.accountsService.getAccessibleAccount(userId, dto.cardAccountId);
    if (cardAccount.type !== 'CREDIT_CARD') {
      throw new BadRequestException('Solo se pueden pagar cuotas de una tarjeta de crédito');
    }
    if (dto.payingAccountId === dto.cardAccountId) {
      throw new BadRequestException('La cuenta de pago debe ser distinta a la tarjeta');
    }

    const payingAccount = await this.accountsService.getAccessibleAccount(userId, dto.payingAccountId);
    if (payingAccount.currency !== cardAccount.currency) {
      throw new BadRequestException(
        `La cuenta debe estar en ${cardAccount.currency} — la tarjeta está en esa moneda`,
      );
    }

    const existing = await this.cardPurchasesRepository.findForAccount(dto.cardAccountId);
    const active = existing.filter((p) => p.status === 'ACTIVE');
    if (active.length === 0) {
      throw new BadRequestException('No hay compras activas para pagar');
    }

    const installments = active.map((p) => {
      const remaining = Number(p.remainingBalance);
      const capital = Math.min(Number(p.installmentAmount), remaining);
      const newRemaining = round2(remaining - capital);
      return {
        cardPurchaseId: p.id,
        capital,
        remainingBalance: newRemaining,
        status: (newRemaining <= 0 ? 'PAID_OFF' : 'ACTIVE') as 'ACTIVE' | 'PAID_OFF',
      };
    });
    // capitalTotal es lo único que se acredita en la tarjeta — el interés,
    // si dto.amount lo incluye, solo sale de la cuenta que paga (ver
    // registerMonthlyPayment).
    const capitalTotal = round2(installments.reduce((sum, i) => sum + i.capital, 0));

    await this.cardPurchasesRepository.registerMonthlyPayment({
      payingAccountId: dto.payingAccountId,
      cardAccountId: dto.cardAccountId,
      userId,
      paidAmount: dto.amount ?? capitalTotal,
      capitalAmount: capitalTotal,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      note: `Pago cuotas de tarjeta (${installments.length} compra${installments.length !== 1 ? 's' : ''})`,
      installments,
    });

    const updated = await this.cardPurchasesRepository.findForAccount(dto.cardAccountId);
    return CardPurchaseMapper.toResponseList(updated);
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
      // Cuota SIN interés — es lo que amortiza el capital, lo único que debe
      // guardarse como installmentAmount. El banco cobra el interés aparte
      // cada mes (no se acumula al capital pendiente), así que no puede
      // afectar remainingBalance ni, por lo tanto, el saldo de la tarjeta —
      // eso fue justo el bug: antes se metía el interés aquí y descontaba de
      // más. Se expone solo informativo en interestAmount.
      const installmentAmount = item.installmentAmount;
      const amount = item.originalAmount ?? round2(installmentAmount * installmentsTotal);
      const interestAmount = item.interestAmount ?? undefined;
      const interestRate = item.interestRatePercent ?? undefined;

      const candidates = activeExisting.filter(
        (p) => merchantsMatch(p.merchant, item.merchant) && p.installmentsTotal === installmentsTotal,
      );
      const match = findExistingMatch(candidates, item, amount);

      if (!match) {
        const purchasedAtSource = item.purchaseDate ?? statementDate;
        return {
          merchant: item.merchant,
          amount,
          installmentsTotal,
          installmentAmount,
          interestAmount,
          interestRate,
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
          interestAmount,
          interestRate,
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
        interestAmount,
        interestRate,
        matchType: StatementMatchType.BEHIND,
        purchaseId: match.id,
        currentInstallmentsPaid: match.installmentsPaid,
        statementInstallmentCurrent: installmentCurrent,
        cuotasBehind,
      };
    });
  }

  // Usado por ForecastService para sumar la cuota mensual esperada de
  // compras a cuotas dentro de la proyección de gastos — por moneda, porque
  // el usuario puede tener tarjetas en COP y USD a la vez.
  async getActiveMonthlyInstallmentTotals(userId: string): Promise<{ currency: string; total: number }[]> {
    const purchases = await this.cardPurchasesRepository.findAllForUser(userId);
    const byCurrency = new Map<string, number>();
    for (const p of purchases) {
      if (p.status !== 'ACTIVE') continue;
      const currency = p.account.currency;
      byCurrency.set(currency, round2((byCurrency.get(currency) ?? 0) + Number(p.installmentAmount)));
    }
    return Array.from(byCurrency.entries()).map(([currency, total]) => ({ currency, total }));
  }

  private async getOwnedPurchase(userId: string, id: string): Promise<CardPurchaseWithAccount> {
    const purchase = await this.cardPurchasesRepository.findById(id);
    if (!purchase || purchase.userId !== userId) {
      throw new NotFoundException(`Compra ${id} no encontrada`);
    }
    return purchase;
  }
}
