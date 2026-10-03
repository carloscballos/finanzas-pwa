import { RecurrenceFrequency } from '@prisma/client';
import { addDays } from '../common/colombia-time';

// Cálculo del calendario de los movimientos recurrentes automáticos. Todo
// trabaja con fechas de calendario (medianoche UTC, ver colombia-time.ts).

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// Un día que no existe en ese mes cae en el último (31 → 30/28, 29-feb → 28-feb).
function clampedDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))));
}

/**
 * Primera ocurrencia ESTRICTAMENTE posterior a `after`, según el patrón que
 * marca `start` (la primera fecha de la plantilla):
 *  - WEEKLY: cada 7 días desde `start`.
 *  - MONTHLY: el mismo día del mes que `start` (con tope en el último día).
 *  - YEARLY: el mismo día y mes que `start`.
 *  - SEMIMONTHLY: los días 15 y último de cada mes (ciclo de nómina colombiano).
 * Nunca devuelve algo anterior a `start`.
 */
export function nextOccurrence(frequency: RecurrenceFrequency, start: Date, after: Date): Date {
  const floor = after < start ? addDays(start, -1) : after;

  if (frequency === 'WEEKLY') {
    const weeks = Math.floor((floor.getTime() - start.getTime()) / (7 * 86_400_000)) + 1;
    return addDays(start, weeks * 7);
  }

  if (frequency === 'YEARLY') {
    let year = floor.getUTCFullYear();
    for (;;) {
      const candidate = clampedDate(year, start.getUTCMonth(), start.getUTCDate());
      if (candidate > floor) return candidate;
      year += 1;
    }
  }

  let year = floor.getUTCFullYear();
  let month = floor.getUTCMonth();
  for (;;) {
    const candidates =
      frequency === 'SEMIMONTHLY'
        ? [clampedDate(year, month, 15), clampedDate(year, month, 31)]
        : [clampedDate(year, month, start.getUTCDate())];
    const found = candidates.find((candidate) => candidate > floor);
    if (found) return found;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
}
