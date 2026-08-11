import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateBudgetDto } from './create-budget.dto';

// La categoría y la moneda no se pueden cambiar después de creado: para
// cambiarlas, se borra el presupuesto y se crea uno nuevo.
export class UpdateBudgetDto extends PartialType(
  OmitType(CreateBudgetDto, ['categoryId', 'currency'] as const),
) {}
