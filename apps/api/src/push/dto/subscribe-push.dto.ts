import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';

// Forma de `PushSubscription.toJSON()` del navegador.
class PushKeysDto {
  @ApiProperty({ description: 'Clave pública del navegador (base64url)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  p256dh: string;

  @ApiProperty({ description: 'Secreto de autenticación (base64url)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  auth: string;
}

export class SubscribePushDto {
  @ApiProperty({ description: 'URL única que asigna el servicio de push del navegador' })
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  @MaxLength(2048)
  endpoint: string;

  @ApiProperty({ type: PushKeysDto })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}
