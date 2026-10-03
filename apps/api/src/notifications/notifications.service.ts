import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PushService } from '../push/push.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationMapper } from './mappers/notification.mapper';
import { NotificationsListResponseDto } from './dto/notification-response.dto';

const LIST_LIMIT = 50;
const READ_RETENTION_DAYS = 30;

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  /** Ruta del frontend (ej. `/debts`). */
  link?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly pushService: PushService,
  ) {}

  // Lo llaman los demás módulos al ocurrir un evento. Un aviso es un efecto
  // lateral: si falla no debe deshacer ni hacer fallar la operación que lo
  // originó (la solicitud ya se creó, el abono ya se registró), por eso se
  // registra el error y se sigue.
  async notify(userId: string | null | undefined, input: NotifyInput): Promise<void> {
    if (!userId) return;
    try {
      const created = await this.notificationsRepository.create({ userId, ...input });
      // Sin await: la entrega al celular no debe demorar la respuesta de quien
      // originó el aviso (sendToUser no lanza). La fila de arriba es la fuente
      // de verdad; el push es solo otro canal.
      void this.pushService.sendToUser(userId, {
        title: input.title,
        body: input.body,
        url: input.link,
        tag: created.id,
      });
    } catch (error) {
      this.logger.error(`No se pudo crear la notificación ${input.type} para ${userId}`, error);
    }
  }

  async findMine(userId: string): Promise<NotificationsListResponseDto> {
    const cutoff = new Date(Date.now() - READ_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await this.notificationsRepository.removeReadOlderThan(userId, cutoff);
    const [items, unreadCount] = await Promise.all([
      this.notificationsRepository.findLatest(userId, LIST_LIMIT),
      this.notificationsRepository.countUnread(userId),
    ]);
    return { items: NotificationMapper.toResponseList(items), unreadCount };
  }

  async markRead(userId: string, id: string): Promise<void> {
    if ((await this.notificationsRepository.markRead(userId, id)) === 0) {
      throw new NotFoundException('Notificación no encontrada');
    }
  }

  markAllRead(userId: string): Promise<void> {
    return this.notificationsRepository.markAllRead(userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    if ((await this.notificationsRepository.remove(userId, id)) === 0) {
      throw new NotFoundException('Notificación no encontrada');
    }
  }
}
