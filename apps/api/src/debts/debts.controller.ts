import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';
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
  @ApiOperation({
    summary:
      'Crear una deuda con otra persona — el email es opcional; si no se da o no corresponde a un usuario registrado, la deuda igual se crea con el nombre como referencia',
  })
  @ApiResponse({ status: 201, type: DebtResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDebtDto,
  ): Promise<DebtResponseDto> {
    return this.debtsService.create(user.id, dto);
  }

  @Post(':id/payments')
  @ApiOperation({
    summary:
      'Registrar un abono (parcial o total) — queda pendiente de confirmación de la otra parte; sin monto, abona el saldo pendiente completo',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: DebtResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Monto inválido o mayor al saldo pendiente, la cuenta no coincide en moneda, o (si eres el deudor) no tiene saldo suficiente',
  })
  @ApiResponse({ status: 404, description: 'Deuda no encontrada' })
  @ApiResponse({ status: 409, description: 'La deuda ya está liquidada' })
  registerPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDebtPaymentDto,
  ): Promise<DebtResponseDto> {
    return this.debtsService.registerPayment(user.id, id, dto);
  }

  @Post(':id/payments/:paymentId/confirm')
  @ApiOperation({ summary: 'Confirmar un abono (solo quien no lo registró)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'paymentId', format: 'uuid' })
  @ApiResponse({ status: 201, type: DebtResponseDto })
  @ApiResponse({ status: 403, description: 'No puedes confirmar tu propio abono' })
  @ApiResponse({ status: 404, description: 'Deuda o abono no encontrado' })
  @ApiResponse({ status: 409, description: 'El abono ya fue confirmado/rechazado, o la deuda ya está liquidada' })
  confirmPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ): Promise<DebtResponseDto> {
    return this.debtsService.confirmPayment(user.id, id, paymentId);
  }

  @Post(':id/payments/:paymentId/reject')
  @ApiOperation({ summary: 'Rechazar un abono (solo quien no lo registró)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'paymentId', format: 'uuid' })
  @ApiResponse({ status: 201, type: DebtResponseDto })
  @ApiResponse({ status: 403, description: 'No puedes rechazar tu propio abono' })
  @ApiResponse({ status: 404, description: 'Deuda o abono no encontrado' })
  @ApiResponse({ status: 409, description: 'El abono ya fue confirmado/rechazado' })
  rejectPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ): Promise<DebtResponseDto> {
    return this.debtsService.rejectPayment(user.id, id, paymentId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una deuda pendiente (solo quien la creó) — también elimina sus abonos registrados' })
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
