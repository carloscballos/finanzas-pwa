import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Toggle state for the app-wide "toolbar → inline create form" convention,
 * seeded from a `?new=1`-style query param so quick actions elsewhere in the
 * app can deep-link straight into an open form (see HomePage's quick
 * actions). Clears the param on close so it doesn't reopen on refresh.
 */
export function useCreateFormToggle(paramName = 'new') {
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(() => searchParams.get(paramName) === '1')

  function clearParam() {
    if (!searchParams.has(paramName)) return
    const next = new URLSearchParams(searchParams)
    next.delete(paramName)
    setSearchParams(next, { replace: true })
  }

  function toggle() {
    setOpen((prev) => {
      if (prev) clearParam()
      return !prev
    })
  }

  function close() {
    if (open) {
      setOpen(false)
      clearParam()
    }
  }

  return { open, toggle, close }
}
