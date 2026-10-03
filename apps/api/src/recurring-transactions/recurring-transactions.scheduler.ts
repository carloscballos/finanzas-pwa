import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { COLOMBIA_TIME_ZONE } from '../common/colombia-time';
import { RecurringAutoApplyService } from './recurring-auto-apply.service';

// Horario: 6:00 a. m. hora de Colombia, todos los días. La lógica vive en
// RecurringAutoApplyService; esta clase solo decide CUÁNDO corre.
@Injectable()
export class RecurringTransactionsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecurringTransactionsScheduler.name);

  constructor(private readonly autoApplyService: RecurringAutoApplyService) {}

  @Cron('0 6 * * *', { name: 'recurring-auto-apply', timeZone: COLOMBIA_TIME_ZONE })
  async handleDaily(): Promise<void> {
    await this.run('cron de las 6 a. m.');
  }

  // Si la API estaba caída o se estaba redesplegando a las 6, la corrida se
  // perdería hasta mañana. Al arrancar se ponen al día las fechas vencidas;
  // es seguro repetirlo porque la aplicación es idempotente.
  onApplicationBootstrap(): void {
    void this.run('arranque');
  }

  private async run(origin: string): Promise<void> {
    try {
      await this.autoApplyService.applyDue();
    } catch (error) {
      this.logger.error(`Falló la ejecución de recurrentes (${origin})`, error);
    }
  }
}
