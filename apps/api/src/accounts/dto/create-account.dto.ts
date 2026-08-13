import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
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

  @ApiPropertyOptional({
    description: 'Cupo de crédito — solo aplica a cuentas type CREDIT_CARD',
    example: 5000000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({
    description: 'Día del mes en que vence el pago (1-31) — solo aplica a cuentas type CREDIT_CARD',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay?: number;
}
