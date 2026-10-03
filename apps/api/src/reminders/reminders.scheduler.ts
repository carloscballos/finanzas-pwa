import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { COLOMBIA_TIME_ZONE } from '../common/colombia-time';
import { RemindersService } from './reminders.service';

// 6:00 p. m. hora de Colombia, todos los días. A propósito NO hay corrida al
// arrancar (como en recurrentes): un redespliegue a las 9 p. m. no debe mandar
// un recordatorio a deshora.
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(private readonly remindersService: RemindersService) {}

  @Cron('0 18 * * *', { name: 'daily-reminder', timeZone: COLOMBIA_TIME_ZONE })
  async handleDaily(): Promise<void> {
    try {
      await this.remindersService.sendDailyReminders();
    } catch (error) {
      this.logger.error('Falló el recordatorio diario', error);
    }
  }
}
