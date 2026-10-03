import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecurringTransactionsController } from './recurring-transactions.controller';
import { RecurringTransactionsService } from './recurring-transactions.service';
import { RecurringTransactionsRepository } from './recurring-transactions.repository';
import { RecurringAutoApplyService } from './recurring-auto-apply.service';
import { RecurringTransactionsScheduler } from './recurring-transactions.scheduler';

@Module({
  imports: [AccountsModule, CategoriesModule, TransactionsModule, NotificationsModule],
  controllers: [RecurringTransactionsController],
  providers: [
    RecurringTransactionsService,
    RecurringTransactionsRepository,
    RecurringAutoApplyService,
    RecurringTransactionsScheduler,
  ],
  exports: [RecurringTransactionsRepository],
})
export class RecurringTransactionsModule {}
