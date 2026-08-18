import type { ReactNode } from 'react'

export type BadgeTone = 'ok' | 'warn' | 'error' | 'neutral'

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
