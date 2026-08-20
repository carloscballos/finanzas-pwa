import { CardPurchase } from '@prisma/client';
import { CardPurchaseResponseDto } from '../dto/card-purchase-response.dto';

export type CardPurchaseWithAccount = CardPurchase & {
  account: { id: string; name: string; currency: string };
};

export class CardPurchaseMapper {
  static toResponse(purchase: CardPurchaseWithAccount): CardPurchaseResponseDto {
    const amount = Number(purchase.amount);
    const remainingBalance = Number(purchase.remainingBalance);

    return {
      id: purchase.id,
      merchant: purchase.merchant,
      amount,
      remainingBalance,
      installmentsTotal: purchase.installmentsTotal,
      installmentsPaid: purchase.installmentsPaid,
      installmentAmount: Number(purchase.installmentAmount),
      interestRate: purchase.interestRate === null ? null : Number(purchase.interestRate),
      lastStatementInterestAmount:
        purchase.lastStatementInterestAmount === null ? null : Number(purchase.lastStatementInterestAmount),
      purchasedAt: purchase.purchasedAt,
      account: purchase.account,
      status: purchase.status,
      // Clamp a 0: si se corrige installmentAmount al alza (interés real
      // mayor al estimado), remainingBalance puede superar el amount
      // original — sin esto, percentPaid se iría negativo.
      percentPaid: amount > 0 ? Math.max(0, Math.round(((amount - remainingBalance) / amount) * 100)) : 0,
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
    };
  }

  static toResponseList(purchases: CardPurchaseWithAccount[]): CardPurchaseResponseDto[] {
    return purchases.map(CardPurchaseMapper.toResponse);
  }
}
