import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
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

  @ApiPropertyOptional({ format: 'uuid', description: 'Cuenta donde se está ahorrando (opcional)' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    enum: CurrencyCode,
    default: CurrencyCode.COP,
    description: 'Se ignora si se especifica accountId: la meta hereda la moneda de esa cuenta',
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;
}
