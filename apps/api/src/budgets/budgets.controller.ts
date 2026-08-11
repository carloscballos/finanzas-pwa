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
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetResponseDto } from './dto/budget-response.dto';

@ApiTags('Budgets')
@Auth()
@Controller({ path: 'budgets', version: '1' })
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar presupuestos con su progreso en el periodo actual' })
  @ApiResponse({ status: 200, type: [BudgetResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<BudgetResponseDto[]> {
    return this.budgetsService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un presupuesto por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: BudgetResponseDto })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un presupuesto para una categoría de gasto' })
  @ApiResponse({ status: 201, type: BudgetResponseDto })
  @ApiResponse({ status: 400, description: 'La categoría no es de tipo gasto' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya existe un presupuesto para esa categoría y periodo' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar el límite o periodo de un presupuesto' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: BudgetResponseDto })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un presupuesto para esa categoría y periodo' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un presupuesto' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Presupuesto eliminado' })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.budgetsService.remove(user.id, id);
  }
}
