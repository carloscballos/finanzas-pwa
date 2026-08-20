export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

// Nunca debería superar creditLimit ni bajar de 0 — se recorta como defensa
// extra por si algún movimiento genérico (fuera del flujo de Compras) deja
// currentBalance en un valor inesperado.
export function computeAvailableCredit(creditLimit: number, currentBalance: number): number {
  return Math.min(creditLimit, Math.max(0, creditLimit + currentBalance))
}

// Igual que muestran los extractos reales (ver card-purchases.service.ts):
// el interés de una cuota es el % mensual sobre lo que queda pendiente ANTES
// de esa cuota — no una cuota fija con interés diluido (amortización
// francesa). Con capital constante, el interés va bajando cada mes a medida
// que remainingBalance baja. Se usa tanto para estimar al crear la compra
// como para precargar el interés al pagar una cuota ya existente.
// La PRIMERA cuota de cualquier compra (installmentsPaid === 0) nunca genera
// interés — sin importar si es a 1 o a 24 cuotas. Confirmado con extractos
// reales: una compra recién hecha (1 de 1, o 1 de N) siempre muestra
// interés $0 ese corte, porque el banco no alcanza a acumular interés sobre
// un saldo que se originó en el mismo ciclo — solo empieza a cobrarse desde
// la segunda cuota en adelante, cuando ya pasó un ciclo completo.
export function estimateCuotaInterest(
  remainingBalance: number,
  interestRatePercent: number | null | undefined,
  installmentsPaid: number,
): number {
  if (installmentsPaid <= 0 || !interestRatePercent || remainingBalance <= 0) return 0
  return Math.round(remainingBalance * (interestRatePercent / 100) * 100) / 100
}

// El capital de la cuota es siempre principal/cuotas — constante mes a mes.
// El interés es solo una referencia de partida; nunca se guarda, el usuario
// la compara contra el extracto real y ajusta a mano. installmentsPaid es
// las cuotas que ya traía la compra al importarla (0 si es nueva) — con 0,
// el estimado de interés sale en 0 (primera cuota, todavía sin interés).
export function estimateInstallmentSplit(
  principal: number,
  interestRatePercent: number,
  installments: number,
  installmentsPaid: number,
): { capital: number; interest: number } {
  if (installments <= 0 || principal <= 0) return { capital: 0, interest: 0 }
  const capital = Math.round((principal / installments) * 100) / 100
  const remainingBalance = round2(principal - installmentsPaid * capital)
  const interest = estimateCuotaInterest(remainingBalance, interestRatePercent, installmentsPaid)
  return { capital, interest }
}
