import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import type { UserSearchResult } from '../lib/api'
import './UserAutocomplete.css'

const DEBOUNCE_MS = 300

export function UserAutocomplete({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string
  value: string
  onChange: (email: string) => void
  placeholder?: string
}) {
  const { token } = useAuth()
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!token || value.trim().length < 2) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      api
        .searchUsers(token, value.trim())
        .then(setResults)
        .catch(() => setResults([]))
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [token, value])

  return (
    <div className="user-autocomplete">
      <input
        id={id}
        type="email"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        required
      />
      {open && results.length > 0 && (
        <ul className="user-autocomplete-list">
          {results.map((r) => (
            <li
              key={r.id}
              onMouseDown={() => {
                onChange(r.email)
                setOpen(false)
              }}
            >
              <div className="user-autocomplete-info">
                <span className="user-autocomplete-name">{r.name}</span>
                <span className="user-autocomplete-email">{r.email}</span>
              </div>
              {r.isFriend && <span className="badge badge-ok">Amigo</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
