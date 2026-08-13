import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { CurrencyCode } from '../../common/currency';

export class CreateLoanDto {
  @ApiProperty({ example: 'Préstamo carro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 20000000, description: 'Monto original del préstamo' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  principal: number;

  @ApiPropertyOptional({
    enum: CurrencyCode,
    default: CurrencyCode.COP,
    description: 'Se ignora si se especifica accountId: el préstamo hereda la moneda de esa cuenta',
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @ApiPropertyOptional({ example: 1.5, description: 'Tasa de interés anual (%) — solo informativa' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  interestRate?: number;

  @ApiProperty({ example: 24, description: 'Número total de cuotas' })
  @IsInt()
  @IsPositive()
  installmentsTotal: number;

  @ApiProperty({ example: 950000, description: 'Monto de cada cuota' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  installmentAmount: number;

  @ApiPropertyOptional({ example: 5, description: 'Día del mes en que vence la cuota (1-31)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Cuenta desde la que se pagarán las cuotas (opcional, preselecciona la cuenta en cada pago)',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
