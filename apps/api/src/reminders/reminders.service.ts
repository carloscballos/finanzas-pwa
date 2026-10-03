import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { addDays, startOfColombiaDay } from '../common/colombia-time';
import { NotificationsService } from '../notifications/notifications.service';
import { RemindersRepository } from './reminders.repository';

// Recordatorio de la tarde (ver RemindersScheduler). Reglas acordadas:
//  - Si la persona ya registró algo hoy y no tiene pendientes, no se le molesta.
//  - Si tiene pagos pendientes del Shortcut, siempre se le avisa cuántos son.
//  - Se envía como aviso de la campana + push (NotificationsService.notify).
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly remindersRepository: RemindersRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendDailyReminders(now = new Date()): Promise<number> {
    const dayStart = startOfColombiaDay(now);
    const dayEnd = addDays(dayStart, 1);
    let sent = 0;

    for (const userId of await this.remindersRepository.findAllUserIds()) {
      try {
        // Idempotente: si el cron se dispara dos veces (reinicio, dos réplicas),
        // no llega el mismo recordatorio dos veces el mismo día.
        if (await this.notificationsService.wasSentSince(userId, NotificationType.DAILY_REMINDER, dayStart)) {
          continue;
        }

        const [registeredToday, pending] = await Promise.all([
          this.remindersRepository.countRegisteredBetween(userId, dayStart, dayEnd),
          this.remindersRepository.countPending(userId),
        ]);
        if (registeredToday > 0 && pending === 0) continue;

        await this.notificationsService.notify(userId, {
          type: NotificationType.DAILY_REMINDER,
          ...this.buildMessage(registeredToday, pending),
          link: '/',
        });
        sent += 1;
      } catch (error) {
        this.logger.error(`No se pudo preparar el recordatorio del usuario ${userId}`, error);
      }
    }

    this.logger.log(`Recordatorio diario enviado a ${sent} usuario(s)`);
    return sent;
  }

  private buildMessage(registeredToday: number, pending: number): { title: string; body: string } {
    if (pending > 0) {
      return {
        title: pending === 1 ? 'Tienes 1 pago pendiente por confirmar' : `Tienes ${pending} pagos pendientes por confirmar`,
        body:
          registeredToday === 0
            ? 'Confírmalos y registra los movimientos de hoy para mantener tus cuentas al día.'
            : 'Confírmalos para que cuenten en tus saldos.',
      };
    }
    return {
      title: '¿Ya registraste tus movimientos de hoy?',
      body: 'Anótalos ahora para mantener tus cuentas al día.',
    };
  }
}
