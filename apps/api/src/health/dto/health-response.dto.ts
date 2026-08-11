import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'degraded'] })
  status: 'ok' | 'degraded';

  @ApiProperty({ example: '2026-08-10T15:04:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 42 })
  uptimeSeconds: number;

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  database: 'up' | 'down';
}
