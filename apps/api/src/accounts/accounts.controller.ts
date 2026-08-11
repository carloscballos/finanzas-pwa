import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountResponseDto } from './dto/account-response.dto';

@ApiTags('Accounts')
@Auth()
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar las cuentas del usuario autenticado' })
  @ApiResponse({ status: 200, type: [AccountResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<AccountResponseDto[]> {
    return this.accountsService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una cuenta por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: AccountResponseDto })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una cuenta (el usuario queda como propietario)' })
  @ApiResponse({ status: 201, type: AccountResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una cuenta (solo el propietario)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: AccountResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'No eres el propietario de la cuenta' })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una cuenta (solo el propietario)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Cuenta eliminada' })
  @ApiResponse({ status: 403, description: 'No eres el propietario de la cuenta' })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.accountsService.remove(user.id, id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar un miembro de la cuenta (el owner quita a otros; un miembro puede salir él mismo)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Miembro eliminado' })
  @ApiResponse({ status: 400, description: 'El propietario no puede ser eliminado' })
  @ApiResponse({ status: 403, description: 'No tienes permiso para quitar a este miembro' })
  @ApiResponse({ status: 404, description: 'Cuenta o miembro no encontrado' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ): Promise<void> {
    return this.accountsService.removeMember(user.id, id, targetUserId);
  }
}
