import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ForecastService } from './forecast.service';
import { ForecastSummaryDto } from './dto/forecast-summary.dto';
import { BudgetSuggestionDto } from './dto/budget-suggestion.dto';

@ApiTags('Forecast')
@Auth()
@Controller({ path: 'forecast', version: '1' })
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Flujo de caja mensual proyectado por moneda, a partir de los movimientos recurrentes activos',
  })
  @ApiResponse({ status: 200, type: [ForecastSummaryDto] })
  getSummary(@CurrentUser() user: AuthenticatedUser): Promise<ForecastSummaryDto[]> {
    return this.forecastService.getSummary(user.id);
  }

  @Get('budget-suggestions')
  @ApiOperation({
    summary: 'Sugerencias de presupuesto por categoría, basadas en el promedio de gasto real de los últimos 3 meses',
  })
  @ApiResponse({ status: 200, type: [BudgetSuggestionDto] })
  getBudgetSuggestions(@CurrentUser() user: AuthenticatedUser): Promise<BudgetSuggestionDto[]> {
    return this.forecastService.getBudgetSuggestions(user.id);
  }
}
