import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AccountsModule } from '../accounts/accounts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { DebtsRepository } from './debts.repository';

@Module({
  imports: [UsersModule, AccountsModule, NotificationsModule],
  controllers: [DebtsController],
  providers: [DebtsService, DebtsRepository],
})
export class DebtsModule {}
