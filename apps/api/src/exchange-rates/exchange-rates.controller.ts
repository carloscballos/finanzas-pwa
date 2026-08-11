import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRateDto } from './dto/exchange-rate.dto';

@ApiTags('Exchange Rates')
@Auth()
@Controller({ path: 'exchange-rates', version: '1' })
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Get('usd-cop')
  @ApiOperation({ summary: 'Tasa de cambio USD/COP actual (TRM oficial), para previsualizar transferencias' })
  @ApiResponse({ status: 200, type: ExchangeRateDto })
  @ApiResponse({ status: 503, description: 'La fuente automática no está disponible' })
  getUsdToCop(): Promise<ExchangeRateDto> {
    return this.exchangeRatesService.getUsdToCop();
  }
}
