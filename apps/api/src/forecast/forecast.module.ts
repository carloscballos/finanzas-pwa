import { Module } from '@nestjs/common';
import { RecurringTransactionsModule } from '../recurring-transactions/recurring-transactions.module';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { ForecastRepository } from './forecast.repository';

@Module({
  imports: [RecurringTransactionsModule],
  controllers: [ForecastController],
  providers: [ForecastService, ForecastRepository],
})
export class ForecastModule {}
