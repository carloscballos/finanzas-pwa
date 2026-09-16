import { createContext, useContext, useState, type ReactNode } from 'react'

const HIDDEN_KEY = 'finanzas_hide_values'

interface PrivacyContextValue {
  hideValues: boolean
  toggleHideValues: () => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hideValues, setHideValues] = useState(() => localStorage.getItem(HIDDEN_KEY) === '1')

  function toggleHideValues() {
    setHideValues((prev) => {
      const next = !prev
      localStorage.setItem(HIDDEN_KEY, next ? '1' : '0')
      return next
    })
  }

  return <PrivacyContext.Provider value={{ hideValues, toggleHideValues }}>{children}</PrivacyContext.Provider>
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy debe usarse dentro de <PrivacyProvider>')
  return ctx
}
