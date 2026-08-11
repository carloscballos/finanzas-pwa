import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

// El tipo (ingreso/gasto) no se puede cambiar una vez creada la categoría:
// podría dejar inconsistentes los presupuestos y movimientos que ya la usan.
export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['type'] as const),
) {}
