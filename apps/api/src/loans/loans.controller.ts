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
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { PayLoanDto } from './dto/pay-loan.dto';
import { LoanResponseDto } from './dto/loan-response.dto';

@ApiTags('Loans')
@Auth()
@Controller({ path: 'loans', version: '1' })
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @ApiOperation({ summary: 'Listar préstamos del usuario' })
  @ApiResponse({ status: 200, type: [LoanResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<LoanResponseDto[]> {
    return this.loansService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un préstamo por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: LoanResponseDto })
  @ApiResponse({ status: 404, description: 'Préstamo no encontrado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LoanResponseDto> {
    return this.loansService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un préstamo' })
  @ApiResponse({ status: 201, type: LoanResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLoanDto,
  ): Promise<LoanResponseDto> {
    return this.loansService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar nombre, tasa de interés o día de pago de un préstamo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: LoanResponseDto })
  @ApiResponse({ status: 404, description: 'Préstamo no encontrado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoanDto,
  ): Promise<LoanResponseDto> {
    return this.loansService.update(user.id, id, dto);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Pagar una cuota — crea un movimiento real en la cuenta elegida' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: LoanResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos, o la cuenta no coincide con la moneda del préstamo',
  })
  @ApiResponse({ status: 404, description: 'Préstamo o cuenta no encontrada' })
  @ApiResponse({ status: 409, description: 'El préstamo ya está pagado por completo' })
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayLoanDto,
  ): Promise<LoanResponseDto> {
    return this.loansService.pay(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un préstamo (también elimina sus pagos registrados)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Préstamo eliminado' })
  @ApiResponse({ status: 404, description: 'Préstamo no encontrado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.loansService.remove(user.id, id);
  }
}
