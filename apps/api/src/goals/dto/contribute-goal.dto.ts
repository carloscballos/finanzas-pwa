import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, NotEquals } from 'class-validator';

export class ContributeGoalDto {
  @ApiProperty({
    example: 500,
    description: 'Positivo para aportar, negativo para retirar. No puede ser 0.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @NotEquals(0)
  amount: number;
}
