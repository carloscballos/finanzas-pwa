import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  body: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Ruta del frontend a la que lleva el aviso' })
  link: string | null;

  @ApiProperty()
  read: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class NotificationsListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items: NotificationResponseDto[];

  @ApiProperty({ description: 'Avisos sin leer en total (no solo los de esta página)' })
  unreadCount: number;
}
