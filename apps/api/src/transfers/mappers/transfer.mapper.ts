import { Transfer } from '@prisma/client';
import { TransferResponseDto } from '../dto/transfer-response.dto';

type AccountSummary = { id: string; name: string; currency: string };
type UserSummary = { id: string; name: string };

export type TransferWithRelations = Transfer & {
  fromAccount: AccountSummary;
  toAccount: AccountSummary;
  createdBy: UserSummary;
};

export class TransferMapper {
  static toResponse(transfer: TransferWithRelations): TransferResponseDto {
    return {
      id: transfer.id,
      fromAccount: transfer.fromAccount,
      toAccount: transfer.toAccount,
      fromAmount: Number(transfer.fromAmount),
      toAmount: Number(transfer.toAmount),
      exchangeRate: transfer.exchangeRate ? Number(transfer.exchangeRate) : null,
      note: transfer.note,
      occurredAt: transfer.occurredAt,
      createdBy: transfer.createdBy,
      createdAt: transfer.createdAt,
    };
  }

  static toResponseList(transfers: TransferWithRelations[]): TransferResponseDto[] {
    return transfers.map(TransferMapper.toResponse);
  }
}
