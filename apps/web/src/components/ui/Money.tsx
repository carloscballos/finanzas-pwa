import { formatMoney } from '../../lib/money'
import './Money.css'

export type MoneyTone =
  | 'neutral' // sin color, solo tipografía mono
  | 'balance' // rojo si amount<0, sin verde nunca — saldos/totales
  | 'flow' // verde si amount>0, rojo si amount<0 — netos ya firmados (ingreso-gasto)
  | 'positive' // fuerza verde, sin importar el signo del número (créditos/ingresos con monto siempre positivo en los datos)
  | 'negative' // fuerza rojo, misma idea para deudas/gastos

export type MoneySize = 'sm' | 'md' | 'lg'

interface MoneyProps {
  amount: number
  currency: string
  tone?: MoneyTone
  size?: MoneySize
  /** Antepone un "+" cuando amount >= 0 (formatMoney ya antepone "-" si es negativo). */
  showSign?: boolean
  className?: string
}

export function Money({ amount, currency, tone = 'neutral', size = 'md', showSign = false, className = '' }: MoneyProps) {
  let toneClass = ''
  if (tone === 'balance' && amount < 0) toneClass = 'ui-money-negative'
  if (tone === 'flow') toneClass = amount > 0 ? 'ui-money-positive' : amount < 0 ? 'ui-money-negative' : ''
  if (tone === 'positive') toneClass = 'ui-money-positive'
  if (tone === 'negative') toneClass = 'ui-money-negative'

  const sizeClass = size !== 'md' ? `ui-money-${size}` : ''
  // Para tone="positive"/"negative" el monto en los datos suele venir sin
  // signo (ej. tx.amount, siempre >=0, la dirección la da tx.type) — el
  // signo lo decide el tono, no el número. Para "flow"/"balance"/"neutral"
  // el número sí es el que trae el signo real, y formatMoney ya antepone
  // "-" cuando corresponde, así que solo hace falta agregar el "+".
  let sign = ''
  if (showSign) {
    if (tone === 'negative') sign = '-'
    else if (tone === 'positive') sign = '+'
    else if (amount >= 0) sign = '+'
  }

  return (
    <span className={`figure ${sizeClass} ${toneClass} ${className}`.trim()}>
      {sign}
      {formatMoney(amount, currency)}
    </span>
  )
}
