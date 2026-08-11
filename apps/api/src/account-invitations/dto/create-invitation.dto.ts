import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsUUID } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta a la que se invita' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ example: 'beto@example.com', description: 'Email del usuario a invitar (ya debe tener cuenta en la app)' })
  @IsEmail()
  email: string;
}
