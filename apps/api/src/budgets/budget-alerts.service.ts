import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { formatMoney } from '../common/format-money';
import { NotificationsService } from '../notifications/notifications.service';
import { BudgetsRepository } from './budgets.repository';
import { getPeriodWindow } from './period-window.util';

const WARNING_RATIO = 0.7;

const PERIOD_LABEL = { MONTHLY: 'mensual', WEEKLY: 'semanal' } as const;

export interface ConfirmedExpense {
  categoryId: string;
  /** Moneda de la cuenta donde se gastó (los presupuestos son por moneda). */
  currency: string;
  amount: number;
  occurredAt: Date;
}

// Avisa al dueño del presupuesto cuando un gasto lo lleva al 70 % o al 100 %.
// No guarda estado: compara lo gastado ANTES y DESPUÉS de este gasto y avisa
// solo si cruzó el umbral, así cada umbral suena una vez por periodo sin
// necesitar tareas programadas ni columnas de "ya avisé". Si un gasto salta
// de <70 % a ≥100 % se manda solo el aviso de excedido.
@Injectable()
export class BudgetAlertsService {
  private readonly logger = new Logger(BudgetAlertsService.name);

  constructor(
    private readonly budgetsRepository: BudgetsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Nunca lanza: es un efecto lateral de registrar un gasto.
  async checkAfterExpense(userId: string, expense: ConfirmedExpense): Promise<void> {
    try {
      const budgets = await this.budgetsRepository.findAllByCategoryAndCurrency(
        userId,
        expense.categoryId,
        expense.currency,
      );
      for (const budget of budgets) {
        const window = getPeriodWindow(budget.period);
        // Un gasto con fecha de otro periodo no mueve este presupuesto.
        if (expense.occurredAt < window.start || expense.occurredAt >= window.end) continue;

        const limit = Number(budget.limitAmount);
        if (limit <= 0) continue;

        const spentAfter = await this.budgetsRepository.sumExpenses(
          budget.categoryId,
          budget.currency,
          window.start,
          window.end,
        );
        const spentBefore = spentAfter - expense.amount;
        const detail = `Llevas ${formatMoney(spentAfter, budget.currency)} de ${formatMoney(limit, budget.currency)} (${PERIOD_LABEL[budget.period]})`;

        if (spentBefore < limit && spentAfter >= limit) {
          await this.notificationsService.notify(userId, {
            type: NotificationType.BUDGET_EXCEEDED,
            title: `Superaste tu presupuesto de ${budget.category.name}`,
            body: detail,
            link: '/budgets',
          });
        } else if (spentBefore < limit * WARNING_RATIO && spentAfter >= limit * WARNING_RATIO) {
          await this.notificationsService.notify(userId, {
            type: NotificationType.BUDGET_WARNING,
            title: `Vas en ${Math.floor((spentAfter / limit) * 100)} % de tu presupuesto de ${budget.category.name}`,
            body: detail,
            link: '/budgets',
          });
        }
      }
    } catch (error) {
      this.logger.error(`No se pudo revisar los presupuestos del usuario ${userId}`, error);
    }
  }
}
