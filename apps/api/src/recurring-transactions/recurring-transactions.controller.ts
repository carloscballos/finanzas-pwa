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
import { RecurringTransactionsService } from './recurring-transactions.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { ApplyRecurringTransactionDto } from './dto/apply-recurring-transaction.dto';
import { RecurringTransactionResponseDto } from './dto/recurring-transaction-response.dto';
import { TransactionResponseDto } from '../transactions/dto/transaction-response.dto';

@ApiTags('Recurring Transactions')
@Auth()
@Controller({ path: 'recurring-transactions', version: '1' })
export class RecurringTransactionsController {
  constructor(private readonly recurringService: RecurringTransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar plantillas de movimientos recurrentes de las cuentas del usuario' })
  @ApiResponse({ status: 200, type: [RecurringTransactionResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<RecurringTransactionResponseDto[]> {
    return this.recurringService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una plantilla de movimiento recurrente por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RecurringTransactionResponseDto })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecurringTransactionResponseDto> {
    return this.recurringService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear una plantilla de movimiento recurrente (no se genera nada automáticamente)',
  })
  @ApiResponse({ status: 201, type: RecurringTransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o tipo inconsistente con la categoría' })
  @ApiResponse({ status: 404, description: 'Cuenta o categoría no encontrada' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    return this.recurringService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar monto, nota, o si cuenta en la proyección mensual (active)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RecurringTransactionResponseDto })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    return this.recurringService.update(user.id, id, dto);
  }

  @Post(':id/apply')
  @ApiOperation({
    summary:
      'Aplicar la plantilla: crea un movimiento real con sus valores (editables antes de guardar)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyRecurringTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.recurringService.apply(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una plantilla (no borra los movimientos ya creados a partir de ella)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.recurringService.remove(user.id, id);
  }
}
