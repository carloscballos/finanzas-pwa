import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PushConfigResponseDto {
  @ApiProperty({ description: 'false si el servidor no tiene claves VAPID configuradas' })
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Clave pública VAPID para pushManager.subscribe()' })
  publicKey?: string;
}
