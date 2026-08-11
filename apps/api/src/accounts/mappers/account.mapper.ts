import { Account, AccountMember } from '@prisma/client';
import { AccountResponseDto } from '../dto/account-response.dto';

type MemberWithUser = AccountMember & { user: { id: string; name: string; email: string } };

export type AccountWithMembers = Account & { members: MemberWithUser[] };

export class AccountMapper {
  static toResponse(
    account: AccountWithMembers,
    currentUserId: string,
    currentBalance: number,
  ): AccountResponseDto {
    const membership = account.members.find((m) => m.userId === currentUserId);

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialBalance: Number(account.initialBalance),
      currentBalance,
      role: membership!.role,
      memberCount: account.members.length,
      members: account.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  static toResponseList(
    accounts: AccountWithMembers[],
    currentUserId: string,
    balances: Map<string, number>,
  ): AccountResponseDto[] {
    return accounts.map((account) =>
      AccountMapper.toResponse(account, currentUserId, balances.get(account.id) ?? 0),
    );
  }
}
