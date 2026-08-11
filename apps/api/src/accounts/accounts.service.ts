import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsRepository } from './accounts.repository';
import { AccountMapper, AccountWithMembers } from './mappers/account.mapper';
import { AccountResponseDto } from './dto/account-response.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly accountsRepository: AccountsRepository) {}

  async create(userId: string, dto: CreateAccountDto): Promise<AccountResponseDto> {
    const account = await this.accountsRepository.create(dto, userId);
    return AccountMapper.toResponse(account, userId, Number(account.initialBalance));
  }

  async findAllForUser(userId: string): Promise<AccountResponseDto[]> {
    const accounts = await this.accountsRepository.findAllForUser(userId);
    const balances = await this.computeCurrentBalances(accounts);
    return AccountMapper.toResponseList(accounts, userId, balances);
  }

  async findOne(userId: string, accountId: string): Promise<AccountResponseDto> {
    const account = await this.getAccountForMember(userId, accountId);
    const balances = await this.computeCurrentBalances([account]);
    return AccountMapper.toResponse(account, userId, balances.get(account.id) ?? 0);
  }

  async update(
    userId: string,
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    await this.assertOwner(userId, accountId);
    const updated = await this.accountsRepository.update(accountId, dto);
    const balances = await this.computeCurrentBalances([updated]);
    return AccountMapper.toResponse(updated, userId, balances.get(updated.id) ?? 0);
  }

  async remove(userId: string, accountId: string): Promise<void> {
    await this.assertOwner(userId, accountId);
    await this.accountsRepository.delete(accountId);
  }

  // Usado por Transactions/Goals para validar que el usuario tiene acceso a
  // la cuenta (cualquier rol, no solo owner) antes de operar sobre ella.
  async getAccessibleAccount(userId: string, accountId: string): Promise<AccountWithMembers> {
    return this.getAccountForMember(userId, accountId);
  }

  // El owner puede quitar a cualquier otro miembro; un miembro puede
  // quitarse a sí mismo (salir de la cuenta). El owner no puede ser
  // eliminado — no hay flujo de transferencia de propiedad todavía.
  async removeMember(requesterId: string, accountId: string, targetUserId: string): Promise<void> {
    const account = await this.getAccountForMember(requesterId, accountId);
    const requesterMembership = account.members.find((m) => m.userId === requesterId)!;
    const targetMembership = account.members.find((m) => m.userId === targetUserId);

    if (!targetMembership) {
      throw new NotFoundException('Ese usuario no es miembro de esta cuenta');
    }

    const isSelf = requesterId === targetUserId;
    if (!isSelf && requesterMembership.role !== 'OWNER') {
      throw new ForbiddenException('Solo el propietario puede quitar miembros de la cuenta');
    }
    if (targetMembership.role === 'OWNER') {
      throw new BadRequestException('El propietario no puede salir ni ser eliminado de la cuenta');
    }

    await this.accountsRepository.removeMember(accountId, targetUserId);
  }

  private async computeCurrentBalances(
    accounts: AccountWithMembers[],
  ): Promise<Map<string, number>> {
    const net = await this.accountsRepository.getNetMovements(accounts.map((a) => a.id));
    const balances = new Map<string, number>();
    for (const account of accounts) {
      balances.set(account.id, Number(account.initialBalance) + (net.get(account.id) ?? 0));
    }
    return balances;
  }

  // Cuenta inexistente y cuenta a la que no perteneces se tratan igual (404)
  // para no revelar la existencia de cuentas ajenas.
  private async getAccountForMember(
    userId: string,
    accountId: string,
  ): Promise<AccountWithMembers> {
    const account = await this.accountsRepository.findById(accountId);
    const isMember = account?.members.some((member) => member.userId === userId);
    if (!account || !isMember) {
      throw new NotFoundException(`Cuenta ${accountId} no encontrada`);
    }
    return account;
  }

  private async assertOwner(userId: string, accountId: string): Promise<void> {
    const account = await this.getAccountForMember(userId, accountId);
    const membership = account.members.find((member) => member.userId === userId);
    if (membership?.role !== 'OWNER') {
      throw new ForbiddenException('Solo el propietario puede modificar esta cuenta');
    }
  }
}
