import { Module } from '@nestjs/common';
import { RecurringTransactionsModule } from '../recurring-transactions/recurring-transactions.module';
import { CardPurchasesModule } from '../card-purchases/card-purchases.module';
import { LoansModule } from '../loans/loans.module';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { ForecastRepository } from './forecast.repository';

@Module({
  imports: [RecurringTransactionsModule, CardPurchasesModule, LoansModule],
  controllers: [ForecastController],
  providers: [ForecastService, ForecastRepository],
})
export class ForecastModule {}
