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

// Cuántos meses calendario completos de la ventana tienen historial real:
// los que van desde el mes del primer movimiento del usuario hasta el fin de
// la ventana. Un usuario que empezó hace un mes tiene 1, no 3 — dividir el
// total entre la ventana completa haría que el promedio saliera a un tercio
// de lo que gastó de verdad. El mes del primer movimiento cuenta completo
// aunque haya empezado a mitad de mes: es aritmética simple y explicable,
// no una estimación.
export function countMonthsOfHistory(window: TrailingWindow, earliestTransaction: Date | null): number {
  if (!earliestTransaction) return 0;
  const firstMonth = new Date(
    Date.UTC(earliestTransaction.getUTCFullYear(), earliestTransaction.getUTCMonth(), 1),
  );
  const from = firstMonth > window.start ? firstMonth : window.start;
  if (from >= window.end) return 0;
  return (
    (window.end.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (window.end.getUTCMonth() - from.getUTCMonth())
  );
}
