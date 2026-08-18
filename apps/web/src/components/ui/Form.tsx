import type { FormHTMLAttributes, ReactNode } from 'react'
import './Form.css'

export function Form({ className = '', ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={`ui-form ${className}`.trim()} {...props} />
}

export function FormField({
  label,
  htmlFor,
  full = false,
  children,
}: {
  label: string
  htmlFor: string
  full?: boolean
  children: ReactNode
}) {
  return (
    <div className={`ui-field ${full ? 'ui-field-full' : ''}`.trim()}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null
  return <div className="ui-form-error ui-field-full">{children}</div>
}
