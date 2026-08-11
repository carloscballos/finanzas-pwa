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
import { RecurringTransactionResponseDto } from './dto/recurring-transaction-response.dto';

@ApiTags('Recurring Transactions')
@Auth()
@Controller({ path: 'recurring-transactions', version: '1' })
export class RecurringTransactionsController {
  constructor(private readonly recurringService: RecurringTransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar movimientos recurrentes de las cuentas del usuario' })
  @ApiResponse({ status: 200, type: [RecurringTransactionResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<RecurringTransactionResponseDto[]> {
    return this.recurringService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un movimiento recurrente por id' })
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
  @ApiOperation({ summary: 'Crear un movimiento recurrente (se genera automáticamente cada periodo)' })
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
  @ApiOperation({ summary: 'Actualizar monto, nota, fecha fin, o pausar/reactivar' })
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

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un movimiento recurrente (no borra los movimientos ya generados)' })
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
