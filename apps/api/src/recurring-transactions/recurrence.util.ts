import { RecurrenceFrequency } from '@prisma/client';

function atSameTime(year: number, monthIndex: number, day: number, source: Date): Date {
  return new Date(
    Date.UTC(
      year,
      monthIndex,
      day,
      source.getUTCHours(),
      source.getUTCMinutes(),
      source.getUTCSeconds(),
    ),
  );
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// SEMIMONTHLY ("quincenal"): ocurre los días 15 y último del mes — el ciclo
// de nómina típico en Colombia. No es un intervalo fijo de 14 días: desde
// cualquier fecha, la siguiente ocurrencia es "el 15" o "el último día",
// lo que venga primero.
function nextSemimonthly(date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastDay = lastDayOfMonth(year, month);

  if (day < 15) {
    return atSameTime(year, month, 15, date);
  }
  if (day < lastDay) {
    return atSameTime(year, month, lastDay, date);
  }
  // día === lastDay (el mes ya cerró su segunda quincena): pasa al 15 del
  // mes siguiente.
  return atSameTime(year, month + 1, 15, date);
}

// Suma un periodo en UTC. Para MONTHLY/YEARLY, si el día no existe en el mes
// destino (ej. 31 de enero + 1 mes), cae al último día de ese mes en vez de
// desbordar al mes siguiente (comportamiento de calendario esperado).
export function addInterval(date: Date, frequency: RecurrenceFrequency): Date {
  if (frequency === 'WEEKLY') {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (frequency === 'SEMIMONTHLY') {
    return nextSemimonthly(date);
  }

  const monthsToAdd = frequency === 'YEARLY' ? 12 : 1;
  const targetMonthIndex = date.getUTCMonth() + monthsToAdd;
  const day = Math.min(date.getUTCDate(), lastDayOfMonth(date.getUTCFullYear(), targetMonthIndex));

  return atSameTime(date.getUTCFullYear(), targetMonthIndex, day, date);
}
