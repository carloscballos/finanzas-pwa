import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CurrencyCode } from '../../common/currency';

export enum DebtDirection {
  THEY_OWE_ME = 'THEY_OWE_ME',
  I_OWE_THEM = 'I_OWE_THEM',
}

export class CreateDebtDto {
  @ApiProperty({ example: 'beto@example.com', description: 'Email de la otra persona (ya debe tener cuenta)' })
  @IsEmail()
  counterpartyEmail: string;

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
