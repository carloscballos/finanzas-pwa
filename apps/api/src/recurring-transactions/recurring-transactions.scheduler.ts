import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringTransactionsRepository } from './recurring-transactions.repository';
import { RecurringTransactionsService } from './recurring-transactions.service';

@Injectable()
export class RecurringTransactionsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecurringTransactionsScheduler.name);

  constructor(
    private readonly recurringRepository: RecurringTransactionsRepository,
    private readonly recurringService: RecurringTransactionsService,
  ) {}

  // Corre una vez al iniciar el servidor, además del cron diario — así una
  // ocurrencia vencida no espera hasta la próxima corrida programada.
  async onApplicationBootstrap(): Promise<void> {
    await this.runDueGenerations();
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyCron(): Promise<void> {
    await this.runDueGenerations();
  }

  private async runDueGenerations(): Promise<void> {
    const now = new Date();
    const due = await this.recurringRepository.findDue(now);

    for (const item of due) {
      try {
        await this.recurringService.runDueGenerationFor(item, now);
      } catch (error) {
        this.logger.error(
          `No se pudo generar el movimiento recurrente ${item.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
