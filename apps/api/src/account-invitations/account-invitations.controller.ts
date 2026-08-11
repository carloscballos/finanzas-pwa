import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AccountInvitationsService } from './account-invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationResponseDto } from './dto/invitation-response.dto';

@ApiTags('Account Invitations')
@Auth()
@Controller({ path: 'account-invitations', version: '1' })
export class AccountInvitationsController {
  constructor(private readonly invitationsService: AccountInvitationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar invitaciones. Sin accountId: las que me han enviado a mí. Con accountId: las que envió esa cuenta (solo el propietario).',
  })
  @ApiQuery({ name: 'accountId', required: false, format: 'uuid' })
  @ApiResponse({ status: 200, type: [InvitationResponseDto] })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('accountId') accountId?: string,
  ): Promise<InvitationResponseDto[]> {
    if (accountId) {
      return this.invitationsService.findForAccount(user.id, accountId);
    }
    return this.invitationsService.findMine(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Invitar a un usuario (por email) a una cuenta (solo el propietario)' })
  @ApiResponse({ status: 201, type: InvitationResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'No eres el propietario de la cuenta' })
  @ApiResponse({ status: 404, description: 'No existe un usuario con ese email' })
  @ApiResponse({ status: 409, description: 'Ya es miembro o ya tiene una invitación pendiente' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    return this.invitationsService.create(user.id, dto);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Aceptar una invitación recibida' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: InvitationResponseDto })
  @ApiResponse({ status: 404, description: 'Invitación no encontrada' })
  @ApiResponse({ status: 409, description: 'La invitación ya no está pendiente' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationResponseDto> {
    return this.invitationsService.accept(user.id, id);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Rechazar una invitación recibida' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: InvitationResponseDto })
  @ApiResponse({ status: 404, description: 'Invitación no encontrada' })
  @ApiResponse({ status: 409, description: 'La invitación ya no está pendiente' })
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationResponseDto> {
    return this.invitationsService.decline(user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar una invitación enviada (solo el propietario de la cuenta)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: InvitationResponseDto })
  @ApiResponse({ status: 403, description: 'No eres el propietario de la cuenta' })
  @ApiResponse({ status: 404, description: 'Invitación no encontrada' })
  @ApiResponse({ status: 409, description: 'La invitación ya no está pendiente' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationResponseDto> {
    return this.invitationsService.cancel(user.id, id);
  }
}
