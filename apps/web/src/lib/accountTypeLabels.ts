import type { AccountType } from './api'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  SAVINGS: 'Ahorros',
  CHECKING: 'Cuenta corriente',
  CASH: 'Efectivo',
  CREDIT_CARD: 'Tarjeta de crédito',
  INVESTMENT: 'Inversión',
  OTHER: 'Otra',
}
