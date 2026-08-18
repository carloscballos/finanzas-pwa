import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  accent?: boolean
}

export function Card({ interactive = false, accent = false, className = '', ...props }: CardProps) {
  const classes = ['card', 'ui-card']
  if (interactive) classes.push('card-interactive')
  if (accent) classes.push('ui-card-accent')
  if (className) classes.push(className)
  return <div className={classes.join(' ')} {...props} />
}

export function CardHeader({
  title,
  actions,
  className = '',
}: {
  title: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`ui-card-header ${className}`.trim()}>
      <h3>{title}</h3>
      {actions && <div className="ui-card-header-actions">{actions}</div>}
    </div>
  )
}
