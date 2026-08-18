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

// Cuota fija (sistema de amortización francés, el mismo que usan los bancos
// para tarjetas/préstamos): interestRatePercent es la tasa mensual. Es solo
// una estimación de partida — el usuario puede editarla a mano.
export function estimateInstallmentAmount(
  principal: number,
  interestRatePercent: number,
  installments: number,
): number {
  if (installments <= 0 || principal <= 0) return 0
  const r = interestRatePercent / 100
  if (r <= 0) return Math.round((principal / installments) * 100) / 100
  const factor = r / (1 - Math.pow(1 + r, -installments))
  return Math.round(principal * factor * 100) / 100
}
