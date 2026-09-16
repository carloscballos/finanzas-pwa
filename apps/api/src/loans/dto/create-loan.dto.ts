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

  @ApiProperty({ example: 20000000, description: 'Monto original desembolsado' })
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

  @ApiPropertyOptional({
    example: 24.88,
    description:
      'Tasa de interés EFECTIVA ANUAL (%), como la cotiza el banco. Se usa para repartir cada cuota en interés y capital. Sin tasa, toda la cuota se toma como capital.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  interestRate?: number;

  @ApiProperty({ example: 72, description: 'Número total de cuotas' })
  @IsInt()
  @IsPositive()
  installmentsTotal: number;

  @ApiProperty({
    example: 294257.61,
    description: 'Valor total de cada cuota como la cobra el banco (capital + interés + seguro)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  installmentAmount: number;

  @ApiPropertyOptional({
    example: 11767,
    description: 'Seguro de vida / cargos fijos incluidos en cada cuota — no amortizan capital',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  insuranceAmount?: number;

  @ApiPropertyOptional({ example: 11, description: 'Día del mes en que vence la cuota (1-31)' })
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

  @ApiPropertyOptional({
    example: 17,
    description: 'Cuotas que ya se pagaron antes de registrar el préstamo (para importar uno en curso) — default 0',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsPaid?: number;

  @ApiPropertyOptional({
    example: 9633016.27,
    description:
      'Saldo de capital pendiente HOY según el extracto. Si se omite, se proyecta con la tasa y las cuotas ya pagadas.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  remainingBalance?: number;
}
