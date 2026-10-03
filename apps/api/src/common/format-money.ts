// Monto con símbolo para textos de avisos ("$ 25.000"), en formato colombiano.
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}
