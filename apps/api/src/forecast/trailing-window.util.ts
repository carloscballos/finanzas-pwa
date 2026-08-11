export interface TrailingWindow {
  start: Date;
  end: Date;
}

// Ventana de `monthsBack` meses calendario completos, sin incluir el mes en
// curso (que está a medias y sesgaría el promedio hacia abajo).
export function getTrailingWindow(monthsBack: number, now = new Date()): TrailingWindow {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return { start, end };
}
