import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { CurrencyCode } from '../../common/currency';

export enum DebtDirection {
  THEY_OWE_ME = 'THEY_OWE_ME',
  I_OWE_THEM = 'I_OWE_THEM',
}

export class CreateDebtDto {
  // Nombre de la otra persona — siempre requerido. Si counterpartyEmail
  // resuelve a un usuario registrado, se ignora (se usa el nombre real de su
  // cuenta); si no, es el único dato con el que se identifica a esa persona.
  @ApiProperty({ example: 'Beto Ruiz', description: 'Nombre de la otra persona' })
  @IsString()
  @MinLength(1)
  counterpartyName: string;

  @ApiPropertyOptional({
    example: 'beto@example.com',
    description:
      'Email de la otra persona (opcional). Si corresponde a un usuario registrado, la deuda queda vinculada a su cuenta (con confirmación de abonos); si no, la deuda igual se crea, solo como referencia para el futuro (ej. un recordatorio por correo).',
  })
  @IsOptional()
  @IsEmail()
  counterpartyEmail?: string;

  @ApiProperty({ enum: DebtDirection, example: DebtDirection.THEY_OWE_ME })
  @IsEnum(DebtDirection)
  direction: DebtDirection;

  @ApiProperty({ example: 500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ enum: CurrencyCode, default: CurrencyCode.COP })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @ApiPropertyOptional({ example: 'Cena del viernes' })
  @IsOptional()
  @IsString()
  description?: string;
}
