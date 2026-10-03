import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { BudgetsRepository } from './budgets.repository';
import { BudgetAlertsService } from './budget-alerts.service';

@Module({
  imports: [CategoriesModule, NotificationsModule],
  controllers: [BudgetsController],
  providers: [BudgetsService, BudgetsRepository, BudgetAlertsService],
  exports: [BudgetAlertsService],
})
export class BudgetsModule {}
