import { ApiProperty } from '@nestjs/swagger';

export class UserSearchResultDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Beto Ruiz' })
  name: string;

  @ApiProperty({ example: 'beto@example.com' })
  email: string;

  @ApiProperty({ example: true, description: 'Si ya es amigo del usuario autenticado' })
  isFriend: boolean;
}
