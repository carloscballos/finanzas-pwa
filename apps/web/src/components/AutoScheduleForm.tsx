import { useState, type FormEvent } from 'react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type RecurringTransaction } from '../lib/api'
import { tomorrowDateInput } from '../lib/dates'

/** Activa el registro automático de un pago fijo que ya existe; se muestra en un Modal. */
export function AutoScheduleForm({
  item,
  onDone,
}: {
  item: RecurringTransaction
  onDone: (updated: RecurringTransaction) => void
}) {
  const { token } = useAuth()
  const [startDate, setStartDate] = useState(tomorrowDateInput())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      onDone(await api.updateRecurringTransaction(token, item.id, { autoApply: true, startDate }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo activar el registro automático')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form onSubmit={submit}>
      <FormError>{error}</FormError>
      <FormField label="Primera vez" htmlFor="auto-start" full>
        <input
          id="auto-start"
          type="date"
          min={tomorrowDateInput()}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <span style={{ fontSize: '0.8rem' }}>
          Desde esa fecha se repite según su frecuencia y se registra solo a las 6 a. m. (hora de Colombia). Si es un
          gasto y no hay saldo, no se crea, te avisamos y se reintenta al día siguiente.
        </span>
      </FormField>
      <Button type="submit" disabled={saving}>
        {saving ? 'Guardando…' : 'Activar registro automático'}
      </Button>
    </Form>
  )
}
