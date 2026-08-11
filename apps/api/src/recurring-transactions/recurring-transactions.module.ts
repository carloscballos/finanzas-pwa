import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { RecurringTransactionsController } from './recurring-transactions.controller';
import { RecurringTransactionsService } from './recurring-transactions.service';
import { RecurringTransactionsRepository } from './recurring-transactions.repository';
import { RecurringTransactionsScheduler } from './recurring-transactions.scheduler';

@Module({
  imports: [AccountsModule, CategoriesModule],
  controllers: [RecurringTransactionsController],
  providers: [RecurringTransactionsService, RecurringTransactionsRepository, RecurringTransactionsScheduler],
  exports: [RecurringTransactionsRepository],
})
export class RecurringTransactionsModule {}
