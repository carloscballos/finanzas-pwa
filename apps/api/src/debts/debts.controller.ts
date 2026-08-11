import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { DebtResponseDto } from './dto/debt-response.dto';

@ApiTags('Debts')
@Auth()
@Controller({ path: 'debts', version: '1' })
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar deudas donde el usuario es acreedor o deudor' })
  @ApiResponse({ status: 200, type: [DebtResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<DebtResponseDto[]> {
    return this.debtsService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una deuda por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: DebtResponseDto })
  @ApiResponse({ status: 404, description: 'Deuda no encontrada' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DebtResponseDto> {
    return this.debtsService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una deuda con otro usuario (por email)' })
  @ApiResponse({ status: 201, type: DebtResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'No existe un usuario con ese email' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDebtDto,
  ): Promise<DebtResponseDto> {
    return this.debtsService.create(user.id, dto);
  }

  @Post(':id/mark-paid')
  @ApiOperation({ summary: 'Marcar la deuda como pagada (queda pendiente de confirmación de la otra parte)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: DebtResponseDto })
  @ApiResponse({ status: 404, description: 'Deuda no encontrada' })
  @ApiResponse({ status: 409, description: 'La deuda ya fue marcada como pagada o ya está liquidada' })
  markPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DebtResponseDto> {
    return this.debtsService.markPaid(user.id, id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirmar el pago (solo quien NO la marcó como pagada)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: DebtResponseDto })
  @ApiResponse({ status: 403, description: 'No puedes confirmar tu propio aviso de pago' })
  @ApiResponse({ status: 404, description: 'Deuda no encontrada' })
  @ApiResponse({ status: 409, description: 'La deuda no está esperando confirmación' })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DebtResponseDto> {
    return this.debtsService.confirm(user.id, id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Rechazar el aviso de pago (vuelve a quedar pendiente)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: DebtResponseDto })
  @ApiResponse({ status: 403, description: 'No puedes rechazar tu propio aviso de pago' })
  @ApiResponse({ status: 404, description: 'Deuda no encontrada' })
  @ApiResponse({ status: 409, description: 'La deuda no está esperando confirmación' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DebtResponseDto> {
    return this.debtsService.reject(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una deuda pendiente (solo quien la creó)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Deuda eliminada' })
  @ApiResponse({ status: 403, description: 'Solo quien la creó puede eliminarla' })
  @ApiResponse({ status: 404, description: 'Deuda no encontrada' })
  @ApiResponse({ status: 409, description: 'Solo se puede eliminar mientras está pendiente' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.debtsService.remove(user.id, id);
  }
}
