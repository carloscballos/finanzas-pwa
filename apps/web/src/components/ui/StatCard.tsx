import type { ReactNode } from 'react'
import './StatCard.css'

export function StatCard({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="ui-stat-card">
      <div className="ui-stat-card-label">{label}</div>
      <div className="ui-stat-card-value">{value}</div>
      {sub && <div className="ui-stat-card-sub">{sub}</div>}
    </div>
  )
}
