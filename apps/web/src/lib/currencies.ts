export type CurrencyCode = 'COP' | 'USD'

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'COP', label: 'Peso colombiano' },
  { code: 'USD', label: 'Dólar estadounidense' },
]

export const DEFAULT_CURRENCY: CurrencyCode = 'COP'
