import { Notification } from '@prisma/client';
import { NotificationResponseDto } from '../dto/notification-response.dto';

export class NotificationMapper {
  static toResponse(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      read: notification.readAt !== null,
      createdAt: notification.createdAt,
    };
  }

  static toResponseList(notifications: Notification[]): NotificationResponseDto[] {
    return notifications.map(NotificationMapper.toResponse);
  }
}
