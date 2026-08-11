import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { UsersService } from '../users/users.service';
import { AccountInvitationsRepository } from './account-invitations.repository';
import { InvitationMapper, InvitationWithRelations } from './mappers/invitation.mapper';
import { InvitationResponseDto } from './dto/invitation-response.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@Injectable()
export class AccountInvitationsService {
  constructor(
    private readonly invitationsRepository: AccountInvitationsRepository,
    private readonly accountsService: AccountsService,
    private readonly usersService: UsersService,
  ) {}

  async findMine(userId: string): Promise<InvitationResponseDto[]> {
    const invitations = await this.invitationsRepository.findMine(userId);
    return InvitationMapper.toResponseList(invitations);
  }

  async findForAccount(userId: string, accountId: string): Promise<InvitationResponseDto[]> {
    await this.assertOwner(userId, accountId);
    const invitations = await this.invitationsRepository.findForAccount(accountId);
    return InvitationMapper.toResponseList(invitations);
  }

  async create(userId: string, dto: CreateInvitationDto): Promise<InvitationResponseDto> {
    const account = await this.assertOwner(userId, dto.accountId);

    const invitedUser = await this.usersService.findByEmail(dto.email);
    if (!invitedUser) {
      throw new NotFoundException('No existe un usuario registrado con ese email');
    }
    if (invitedUser.id === userId) {
      throw new BadRequestException('No puedes invitarte a ti mismo');
    }
    if (account.members.some((m) => m.userId === invitedUser.id)) {
      throw new ConflictException('Ese usuario ya es miembro de la cuenta');
    }

    const existingPending = await this.invitationsRepository.findPending(dto.accountId, invitedUser.id);
    if (existingPending) {
      throw new ConflictException('Ya existe una invitación pendiente para este usuario en esta cuenta');
    }

    const created = await this.invitationsRepository.create({
      accountId: dto.accountId,
      invitedUserId: invitedUser.id,
      invitedByUserId: userId,
    });
    return InvitationMapper.toResponse(created);
  }

  async accept(userId: string, id: string): Promise<InvitationResponseDto> {
    const invitation = await this.getMyInvitation(userId, id);
    if (invitation.status !== 'PENDING') {
      throw new ConflictException('Esta invitación ya no está pendiente');
    }
    const updated = await this.invitationsRepository.accept(invitation);
    return InvitationMapper.toResponse(updated);
  }

  async decline(userId: string, id: string): Promise<InvitationResponseDto> {
    const invitation = await this.getMyInvitation(userId, id);
    if (invitation.status !== 'PENDING') {
      throw new ConflictException('Esta invitación ya no está pendiente');
    }
    const updated = await this.invitationsRepository.updateStatus(id, 'DECLINED');
    return InvitationMapper.toResponse(updated);
  }

  async cancel(userId: string, id: string): Promise<InvitationResponseDto> {
    const invitation = await this.invitationsRepository.findById(id);
    if (!invitation) {
      throw new NotFoundException(`Invitación ${id} no encontrada`);
    }
    await this.assertOwner(userId, invitation.accountId);
    if (invitation.status !== 'PENDING') {
      throw new ConflictException('Esta invitación ya no está pendiente');
    }
    const updated = await this.invitationsRepository.updateStatus(id, 'CANCELED');
    return InvitationMapper.toResponse(updated);
  }

  private async getMyInvitation(userId: string, id: string): Promise<InvitationWithRelations> {
    const invitation = await this.invitationsRepository.findById(id);
    if (!invitation || invitation.invitedUserId !== userId) {
      throw new NotFoundException(`Invitación ${id} no encontrada`);
    }
    return invitation;
  }

  private async assertOwner(userId: string, accountId: string) {
    const account = await this.accountsService.getAccessibleAccount(userId, accountId);
    const membership = account.members.find((m) => m.userId === userId);
    if (membership?.role !== 'OWNER') {
      throw new ForbiddenException('Solo el propietario puede administrar invitaciones de esta cuenta');
    }
    return account;
  }
}
