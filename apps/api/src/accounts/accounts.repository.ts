import { Injectable } from '@nestjs/common';
import { AccountMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountWithMembers } from './mappers/account.mapper';

const WITH_MEMBERS = {
  members: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAccountDto, ownerId: string): Promise<AccountWithMembers> {
    return this.prisma.account.create({
      data: {
        name: dto.name,
        type: dto.type,
        currency: dto.currency,
        initialBalance: dto.initialBalance,
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
      include: WITH_MEMBERS,
    });
  }

  findAllForUser(userId: string): Promise<AccountWithMembers[]> {
    return this.prisma.account.findMany({
      where: { members: { some: { userId } } },
      include: WITH_MEMBERS,
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<AccountWithMembers | null> {
    return this.prisma.account.findUnique({ where: { id }, include: WITH_MEMBERS });
  }

  findMembership(accountId: string, userId: string): Promise<AccountMember | null> {
    return this.prisma.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
    });
  }

  update(id: string, dto: UpdateAccountDto): Promise<AccountWithMembers> {
    return this.prisma.account.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        currency: dto.currency,
        initialBalance: dto.initialBalance,
      },
      include: WITH_MEMBERS,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.account.delete({ where: { id } });
  }

  async removeMember(accountId: string, userId: string): Promise<void> {
    await this.prisma.accountMember.delete({ where: { accountId_userId: { accountId, userId } } });
  }

  // Neto (ingresos − gastos) por cuenta. No incluye initialBalance: eso lo
  // suma el service, que es quien conoce la regla de negocio del balance.
  async getNetMovements(accountIds: string[]): Promise<Map<string, number>> {
    if (accountIds.length === 0) return new Map();

    const grouped = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { accountId: { in: accountIds } },
      _sum: { amount: true },
    });

    const net = new Map<string, number>();
    for (const row of grouped) {
      const amount = Number(row._sum.amount ?? 0);
      const delta = row.type === 'INCOME' ? amount : -amount;
      net.set(row.accountId, (net.get(row.accountId) ?? 0) + delta);
    }
    return net;
  }
}
