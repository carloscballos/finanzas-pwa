import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './ListRow.css'

interface ListRowProps {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  actions?: ReactNode
  muted?: boolean
  href?: string
  className?: string
}

export function ListRow({ leading, title, subtitle, trailing, actions, muted = false, href, className = '' }: ListRowProps) {
  const classes = `ui-list-row ${muted ? 'muted' : ''} ${className}`.trim()
  const content = (
    <>
      {leading && <div className="ui-list-row-leading">{leading}</div>}
      <div className="ui-list-row-main">
        <div className="ui-list-row-title">{title}</div>
        {subtitle && <div className="ui-list-row-subtitle">{subtitle}</div>}
      </div>
      {trailing && <div className="ui-list-row-trailing">{trailing}</div>}
      {actions && <div className="ui-list-row-actions">{actions}</div>}
    </>
  )

  if (href) {
    return (
      <Link className={classes} to={href}>
        {content}
      </Link>
    )
  }

  return <div className={classes}>{content}</div>
}
