import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';
import { RemindersScheduler } from './reminders.scheduler';

@Module({
  imports: [NotificationsModule],
  providers: [RemindersRepository, RemindersService, RemindersScheduler],
})
export class RemindersModule {}
