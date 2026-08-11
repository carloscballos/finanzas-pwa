import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { CurrencyCode } from '../../common/currency';

export class CreateAccountDto {
  @ApiProperty({ description: 'Nombre de la cuenta', example: 'Ahorros Banorte' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.SAVINGS })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({
    enum: CurrencyCode,
    default: CurrencyCode.COP,
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @ApiPropertyOptional({
    description: 'Saldo inicial (puede ser negativo, por ejemplo en tarjetas de crédito)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  initialBalance?: number;
}
