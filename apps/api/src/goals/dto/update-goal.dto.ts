import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateGoalDto } from './create-goal.dto';

// La moneda se fija al crear y no cambia después (evita que un aporte ya
// registrado quede ambiguo entre dos monedas).
export class UpdateGoalDto extends PartialType(OmitType(CreateGoalDto, ['currency'] as const)) {}
