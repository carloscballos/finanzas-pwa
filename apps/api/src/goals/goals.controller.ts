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
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { GoalResponseDto } from './dto/goal-response.dto';

@ApiTags('Goals')
@Auth()
@Controller({ path: 'goals', version: '1' })
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar metas de ahorro' })
  @ApiResponse({ status: 200, type: [GoalResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<GoalResponseDto[]> {
    return this.goalsService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una meta por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: GoalResponseDto })
  @ApiResponse({ status: 404, description: 'Meta no encontrada' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GoalResponseDto> {
    return this.goalsService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una meta de ahorro' })
  @ApiResponse({ status: 201, type: GoalResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.goalsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una meta de ahorro' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: GoalResponseDto })
  @ApiResponse({ status: 404, description: 'Meta o cuenta no encontrada' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.goalsService.update(user.id, id, dto);
  }

  @Post(':id/contributions')
  @ApiOperation({
    summary:
      'Aportar o retirar del ahorro acumulado de la meta — crea un movimiento real en la cuenta elegida',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: GoalResponseDto })
  @ApiResponse({
    status: 400,
    description: 'El retiro dejaría el ahorro en negativo, o la cuenta no coincide con la moneda de la meta',
  })
  @ApiResponse({ status: 404, description: 'Meta o cuenta no encontrada' })
  contribute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContributeGoalDto,
  ): Promise<GoalResponseDto> {
    return this.goalsService.contribute(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una meta de ahorro' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Meta eliminada' })
  @ApiResponse({ status: 404, description: 'Meta no encontrada' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.goalsService.remove(user.id, id);
  }
}
