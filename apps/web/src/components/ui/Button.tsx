import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const variantClass = variant === 'secondary' ? 'btn-secondary' : ''
  return <button className={`btn ${variantClass} ${className}`.trim()} {...props} />
}
