// Colombia es UTC-5 todo el año (no tiene horario de verano), así que basta un
// desfase fijo: sin librerías de zonas horarias ni sorpresas por DST.
//
// "Fecha de calendario" = un Date a medianoche UTC que representa solo el día
// (el formato en que Prisma lee/escribe las columnas @db.Date).
const COLOMBIA_OFFSET_HOURS = -5;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const COLOMBIA_TIME_ZONE = 'America/Bogota';

/** El día de calendario de `now` en Colombia, como fecha de calendario. */
export function colombiaToday(now = new Date()): Date {
  const local = new Date(now.getTime() + COLOMBIA_OFFSET_HOURS * HOUR_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** El instante real en que empieza (00:00 en Colombia) el día de `now`. */
export function startOfColombiaDay(now = new Date()): Date {
  return new Date(colombiaToday(now).getTime() - COLOMBIA_OFFSET_HOURS * HOUR_MS);
}

/** Instante real de las `hour`:00 en Colombia de una fecha de calendario. */
export function colombiaDateAt(date: Date, hour: number): Date {
  return new Date(date.getTime() + (hour - COLOMBIA_OFFSET_HOURS) * HOUR_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** "YYYY-MM-DD" ↔ fecha de calendario. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
