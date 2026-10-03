import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsRepository } from './transactions.repository';
import { ReceiptExtractionService } from './receipt-extraction.service';

@Module({
  imports: [AccountsModule, CategoriesModule, BudgetsModule, NotificationsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsRepository, ReceiptExtractionService],
  exports: [TransactionsRepository],
})
export class TransactionsModule {}
