import type { ReactNode } from 'react'
import './SectionHeader.css'

export function SectionHeader({
  as = 'h2',
  title,
  subtitle,
  children,
}: {
  as?: 'h1' | 'h2'
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
}) {
  const Heading = as
  return (
    <div className={`ui-section-header ${as === 'h1' ? 'ui-section-header-page' : ''}`.trim()}>
      <div className="ui-section-header-title">
        <Heading>{title}</Heading>
        {subtitle && <p className="ui-section-header-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="ui-section-header-actions">{children}</div>}
    </div>
  )
}
