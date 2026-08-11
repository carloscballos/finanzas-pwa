import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CreateFriendRequestDto {
  @ApiProperty({ example: 'beto@example.com', description: 'Email del usuario a agregar (ya debe tener cuenta en la app)' })
  @IsEmail()
  email: string;
}
