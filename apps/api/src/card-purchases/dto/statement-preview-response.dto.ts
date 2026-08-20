import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatementPreviewItemDto } from './statement-preview-item.dto';
import { StatementReconciliationDto } from './statement-reconciliation.dto';

export class StatementPreviewResponseDto {
  @ApiProperty({ type: [StatementPreviewItemDto] })
  items: StatementPreviewItemDto[];

  @ApiPropertyOptional({
    type: StatementReconciliationDto,
    nullable: true,
    description: 'null si el extracto no traía una sección de resumen con totales para verificar',
  })
  reconciliation: StatementReconciliationDto | null;
}
