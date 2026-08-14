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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CardPurchasesService } from './card-purchases.service';
import { CreateCardPurchaseDto } from './dto/create-card-purchase.dto';
import { UpdateCardPurchaseDto } from './dto/update-card-purchase.dto';
import { PayCardPurchaseInstallmentDto } from './dto/pay-card-purchase-installment.dto';
import { ListCardPurchasesQueryDto } from './dto/list-card-purchases-query.dto';
import { CardPurchaseResponseDto } from './dto/card-purchase-response.dto';

@ApiTags('Card Purchases')
@Auth()
@Controller({ path: 'card-purchases', version: '1' })
export class CardPurchasesController {
  constructor(private readonly cardPurchasesService: CardPurchasesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar compras a cuotas (opcionalmente filtradas por tarjeta)' })
  @ApiResponse({ status: 200, type: [CardPurchaseResponseDto] })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCardPurchasesQueryDto,
  ): Promise<CardPurchaseResponseDto[]> {
    return query.accountId
      ? this.cardPurchasesService.findForAccount(user.id, query.accountId)
      : this.cardPurchasesService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una compra a cuotas por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CardPurchaseResponseDto })
  @ApiResponse({ status: 404, description: 'Compra no encontrada' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CardPurchaseResponseDto> {
    return this.cardPurchasesService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una compra a cuotas con una tarjeta de crédito' })
  @ApiResponse({ status: 201, type: CardPurchaseResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos, o la cuenta no es una tarjeta de crédito' })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCardPurchaseDto,
  ): Promise<CardPurchaseResponseDto> {
    return this.cardPurchasesService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar el comercio de una compra' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CardPurchaseResponseDto })
  @ApiResponse({ status: 404, description: 'Compra no encontrada' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCardPurchaseDto,
  ): Promise<CardPurchaseResponseDto> {
    return this.cardPurchasesService.update(user.id, id, dto);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Pagar una cuota — crea un movimiento real desde la cuenta elegida hacia la tarjeta' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: CardPurchaseResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos, la cuenta de pago es la misma tarjeta, o no coincide en moneda',
  })
  @ApiResponse({ status: 404, description: 'Compra o cuenta no encontrada' })
  @ApiResponse({ status: 409, description: 'La compra ya está pagada por completo' })
  payInstallment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayCardPurchaseInstallmentDto,
  ): Promise<CardPurchaseResponseDto> {
    return this.cardPurchasesService.payInstallment(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una compra (también elimina sus movimientos registrados)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Compra eliminada' })
  @ApiResponse({ status: 404, description: 'Compra no encontrada' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.cardPurchasesService.remove(user.id, id);
  }
}
