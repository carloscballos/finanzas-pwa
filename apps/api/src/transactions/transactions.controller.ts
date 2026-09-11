import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { ExtractedReceiptResponseDto } from './dto/extracted-receipt-response.dto';
import { SUPPORTED_RECEIPT_MEDIA_TYPES } from './receipt-extraction.service';

const MAX_RECEIPT_SIZE_BYTES = 8 * 1024 * 1024;

@ApiTags('Transactions')
@Auth()
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar movimientos (opcionalmente filtrados por cuenta/categoría/tipo/rango de fechas)',
  })
  @ApiResponse({ status: 200, type: [TransactionResponseDto] })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<TransactionResponseDto[]> {
    return this.transactionsService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un movimiento por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un movimiento (ingreso o gasto)' })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, tipo inconsistente con la categoría, o (si es un gasto) la cuenta no tiene saldo/cupo suficiente',
  })
  @ApiResponse({ status: 404, description: 'Cuenta o categoría no encontrada' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(user.id, dto);
  }

  @Post('extract-receipt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RECEIPT_SIZE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiOperation({
    summary:
      'Subir la foto de una factura/recibo y sugerir los datos del gasto (comercio, monto, fecha, categoría) — no crea ni modifica nada, el usuario decide si los usa',
  })
  @ApiResponse({ status: 201, type: ExtractedReceiptResponseDto })
  @ApiResponse({ status: 400, description: 'Falta el archivo, o no es una imagen soportada (jpg/png/webp/gif)' })
  @ApiResponse({ status: 503, description: 'El servicio de lectura no está disponible' })
  extractReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ExtractedReceiptResponseDto> {
    if (!file) {
      throw new BadRequestException('Debes subir una foto');
    }
    const mediaType = SUPPORTED_RECEIPT_MEDIA_TYPES.find((m) => m === file.mimetype);
    if (!mediaType) {
      throw new BadRequestException('La imagen debe ser JPG, PNG, WEBP o GIF');
    }
    return this.transactionsService.extractReceipt(user.id, file.buffer, mediaType);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un movimiento' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, tipo inconsistente con la categoría, o (si es un gasto) la cuenta no tiene saldo/cupo suficiente',
  })
  @ApiResponse({ status: 404, description: 'Movimiento, cuenta o categoría no encontrada' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un movimiento' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Movimiento eliminado' })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.transactionsService.remove(user.id, id);
  }
}
