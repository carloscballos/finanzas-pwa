import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Body, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferResponseDto } from './dto/transfer-response.dto';

@ApiTags('Transfers')
@Auth()
@Controller({ path: 'transfers', version: '1' })
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar transferencias donde participa una cuenta (origen o destino)' })
  @ApiQuery({ name: 'accountId', required: true, format: 'uuid' })
  @ApiResponse({ status: 200, type: [TransferResponseDto] })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  findForAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Query('accountId', ParseUUIDPipe) accountId: string,
  ): Promise<TransferResponseDto[]> {
    return this.transfersService.findForAccount(user.id, accountId);
  }

  @Post()
  @ApiOperation({ summary: 'Transferir dinero entre dos cuentas donde eres miembro' })
  @ApiResponse({ status: 201, type: TransferResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos, cuentas iguales, o falta tasa de cambio' })
  @ApiResponse({ status: 404, description: 'Alguna de las cuentas no existe o no tienes acceso' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransferDto,
  ): Promise<TransferResponseDto> {
    return this.transfersService.create(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una transferencia (borra sus dos movimientos asociados)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Eliminada' })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.transfersService.remove(user.id, id);
  }
}
