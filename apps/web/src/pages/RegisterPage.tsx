import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { FormField, FormError } from '../components/ui/Form'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'
import './Auth.css'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(email, name, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Crear cuenta</h1>
        <FormError>{error}</FormError>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Nombre" htmlFor="name">
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </FormField>
          <FormField label="Email" htmlFor="email">
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </FormField>
          <FormField label="Contraseña" htmlFor="password">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </FormField>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creando…' : 'Crear cuenta'}
          </Button>
        </form>
        <p className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Entra aquí</Link>
        </p>
      </div>
    </div>
  )
}
