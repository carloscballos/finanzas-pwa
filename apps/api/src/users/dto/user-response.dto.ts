import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'a3f1c2b0-9e4d-4b1a-8f3c-1d2e3f4a5b6c' })
  id: string;

  @ApiProperty({ example: 'usuario@ejemplo.com' })
  email: string;

  @ApiProperty({ example: 'Juan Pérez' })
  name: string;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;
}
