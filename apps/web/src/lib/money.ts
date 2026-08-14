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
