import type { ReactNode } from 'react'
import './IconChip.css'

export type IconChipTone = 'accent' | 'neutral' | 'ok' | 'warn' | 'error'

export function IconChip({ children, tone = 'accent' }: { children: ReactNode; tone?: IconChipTone }) {
  return <span className={`ui-icon-chip ui-icon-chip-${tone}`}>{children}</span>
}
