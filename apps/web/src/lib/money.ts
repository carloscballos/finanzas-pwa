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
// (ahí remainingBalance == principal, es la primera cuota) como para
// precargar el interés al pagar una cuota ya existente.
export function estimateCuotaInterest(
  remainingBalance: number,
  interestRatePercent: number | null | undefined,
): number {
  if (!interestRatePercent || remainingBalance <= 0) return 0
  return Math.round(remainingBalance * (interestRatePercent / 100) * 100) / 100
}

// El capital de la cuota es siempre principal/cuotas — constante mes a mes.
// El interés es solo una referencia de partida para la primera cuota; nunca
// se guarda, el usuario la compara contra el extracto real y ajusta a mano.
export function estimateInstallmentSplit(
  principal: number,
  interestRatePercent: number,
  installments: number,
): { capital: number; interest: number } {
  if (installments <= 0 || principal <= 0) return { capital: 0, interest: 0 }
  const capital = Math.round((principal / installments) * 100) / 100
  const interest = estimateCuotaInterest(principal, interestRatePercent)
  return { capital, interest }
}
