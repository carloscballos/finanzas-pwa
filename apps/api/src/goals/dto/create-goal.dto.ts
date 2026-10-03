import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CurrencyCode } from '../../common/currency';

export class CreateGoalDto {
  @ApiProperty({ example: 'Enganche del carro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 50000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetAmount: number;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  targetDate?: string;

  @ApiPropertyOptional({
    enum: CurrencyCode,
    default: CurrencyCode.COP,
    description:
      'Moneda de la meta. Los aportes solo pueden venir de cuentas en esta misma moneda. No cambia después de crearla.',
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;
}
