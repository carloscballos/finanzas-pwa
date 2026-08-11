import { ApiProperty } from '@nestjs/swagger';

export class FriendResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Beto Ruiz' })
  name: string;

  @ApiProperty({ example: 'beto@example.com' })
  email: string;
}
