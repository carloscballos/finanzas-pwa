import { HttpException, Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { colombiaDateAt, colombiaToday } from '../common/colombia-time';
import { formatMoney } from '../common/format-money';
import { AccountsService } from '../accounts/accounts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { TransactionsService } from '../transactions/transactions.service';
import { RecurringTransactionWithRelations } from './mappers/recurring-transaction.mapper';
import { RecurringTransactionsRepository } from './recurring-transactions.repository';
import { nextOccurrence } from './recurrence.util';

// Tope de fechas atrasadas que se ponen al día de una sola corrida (ej. si la
// API estuvo caída varios días). Más allá, el resto sale en la corrida siguiente.
const MAX_CATCH_UP_PER_TEMPLATE = 12;
// Hora (Colombia) con la que se fecha un movimiento automático de un día pasado.
const OCCURRED_AT_HOUR = 6;

export interface AutoApplyResult {
  applied: number;
  failed: number;
}

// Registra solos los ingresos/gastos fijos marcados como automáticos cuando
// llega su fecha. Se llama desde RecurringTransactionsScheduler (cron diario y
// al arrancar la API). Es idempotente: el calendario (`nextRunOn`) se adelanta
// en la misma transacción de BD que crea el movimiento, así correrlo dos veces
// no duplica nada.
//
// Política de fallo (decidida con el usuario): si no se puede registrar (ej.
// saldo insuficiente) NO se crea nada y NO se adelanta el calendario — se
// reintenta en la siguiente corrida — y se avisa UNA sola vez por fecha.
@Injectable()
export class RecurringAutoApplyService {
  private readonly logger = new Logger(RecurringAutoApplyService.name);

  constructor(
    private readonly recurringRepository: RecurringTransactionsRepository,
    private readonly accountsService: AccountsService,
    private readonly transactionsRepository: TransactionsRepository,
    private readonly transactionsService: TransactionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async applyDue(now = new Date()): Promise<AutoApplyResult> {
    const today = colombiaToday(now);
    const result: AutoApplyResult = { applied: 0, failed: 0 };

    const due = await this.recurringRepository.findDue(today);
    for (const template of due) {
      try {
        const partial = await this.applyTemplate(template, today, now);
        result.applied += partial.applied;
        result.failed += partial.failed;
      } catch (error) {
        // Un problema con una plantilla no debe impedir las demás.
        this.logger.error(`Falló la plantilla recurrente ${template.id}`, error);
      }
    }

    if (result.applied > 0 || result.failed > 0) {
      this.logger.log(`Recurrentes automáticos: ${result.applied} registrados, ${result.failed} con fallo`);
    }
    return result;
  }

  private async applyTemplate(
    initial: RecurringTransactionWithRelations,
    today: Date,
    now: Date,
  ): Promise<AutoApplyResult> {
    const result: AutoApplyResult = { applied: 0, failed: 0 };
    let item = initial;

    for (let i = 0; i < MAX_CATCH_UP_PER_TEMPLATE; i++) {
      if (!item.nextRunOn || !item.scheduleStart || item.nextRunOn > today) break;
      const dueOn = item.nextRunOn;
      const next = nextOccurrence(item.frequency, item.scheduleStart, dueOn);

      try {
        const amount = Number(item.amount);
        // Mismas reglas que registrar a mano: el dueño sigue siendo miembro de
        // la cuenta y, si es gasto, tiene con qué pagarlo.
        await this.accountsService.getAccessibleAccount(item.createdByUserId, item.accountId);
        if (item.type === 'EXPENSE') {
          await this.accountsService.assertSufficientFunds(item.createdByUserId, item.accountId, amount);
        }

        // Fechado a la hora del día de la fecha; nunca en el futuro.
        const occurredAt = new Date(Math.min(now.getTime(), colombiaDateAt(dueOn, OCCURRED_AT_HOUR).getTime()));
        const transactionId = await this.recurringRepository.claimAndCreateTransaction(
          item,
          dueOn,
          next,
          occurredAt,
        );
        if (!transactionId) break; // otro proceso ya la registró

        result.applied += 1;
        await this.afterApplied(item, transactionId);
        item = { ...item, nextRunOn: next };
      } catch (error) {
        result.failed += 1;
        await this.handleFailure(item, dueOn, error);
        break; // se reintenta en la próxima corrida; no se salta la fecha
      }
    }
    return result;
  }

  // Efectos del movimiento ya creado. Ninguno puede deshacerlo ni romper el
  // bucle: notify no lanza y los demás se capturan aquí.
  private async afterApplied(item: RecurringTransactionWithRelations, transactionId: string): Promise<void> {
    try {
      const created = await this.transactionsRepository.findById(transactionId);
      if (created) {
        await this.transactionsService.afterMovementConfirmed(item.createdByUserId, created);
      }
    } catch (error) {
      this.logger.error(`No se pudieron revisar presupuestos/miembros del movimiento ${transactionId}`, error);
    }

    await this.notificationsService.notify(item.createdByUserId, {
      type: NotificationType.RECURRING_APPLIED,
      title: `Se registró «${this.label(item)}» por ${formatMoney(Number(item.amount), item.account.currency)}`,
      body: `En ${item.account.name} (movimiento automático)`,
      link: `/accounts/${item.accountId}/transactions`,
    });
  }

  private async handleFailure(
    item: RecurringTransactionWithRelations,
    dueOn: Date,
    error: unknown,
  ): Promise<void> {
    const expected = error instanceof HttpException;
    if (!expected) {
      this.logger.error(`Error inesperado aplicando la plantilla ${item.id}`, error);
    }
    // Una vez por fecha: sin esto, un saldo insuficiente avisaría todos los días.
    if (item.failureNotifiedFor && item.failureNotifiedFor.getTime() === dueOn.getTime()) return;

    const reason = expected ? (error as HttpException).message : 'Ocurrió un error inesperado';
    await this.notificationsService.notify(item.createdByUserId, {
      type: NotificationType.RECURRING_FAILED,
      title: `No se pudo registrar «${this.label(item)}»`,
      body: `${reason}. Lo intentaremos de nuevo mañana; también puedes registrarlo a mano.`,
      link: '/forecast',
    });
    await this.recurringRepository.markFailureNotified(item.id, dueOn);
  }

  private label(item: RecurringTransactionWithRelations): string {
    return item.note?.trim() || item.category.name;
  }
}
