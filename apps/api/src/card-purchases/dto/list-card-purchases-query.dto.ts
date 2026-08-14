import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListCardPurchasesQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por tarjeta' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
