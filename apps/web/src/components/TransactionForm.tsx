import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Image as ImageIcon } from 'lucide-react'
import { Button } from './ui/Button'
import { Form, FormField, FormError } from './ui/Form'
import { SegmentedControl } from './ui/SegmentedControl'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import {
  ApiError,
  type Account,
  type Category,
  type RecurrenceFrequency,
  type Transaction,
  type TransactionType,
} from '../lib/api'
import { dateInputToDateTimeInput, dateTimeInputToIso, nowDateTimeInput } from '../lib/dates'
import { sanitizeDecimalInput } from '../lib/money'
import './TransactionForm.css'

/**
 * Formulario de nuevo movimiento (gasto o ingreso), compartido por la página de
 * una cuenta y el botón global de "Nuevo movimiento".
 *
 * - Con `accountId` la cuenta ya se sabe (desde la página de la cuenta) y no se pregunta.
 * - Sin `accountId` se muestra el selector con `accounts` (el botón global).
 *
 * También sabe leer una factura: con los botones de foto de arriba, o con
 * `scanFile` (cuando la foto se eligió antes de abrir el formulario, ej. desde el
 * botón flotante). Solo sugiere — pre-llena los campos y el usuario revisa y guarda.
 */
const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

// La cámara solo tiene sentido en dispositivos táctiles; en escritorio el
// atributo `capture` se ignora y "Tomar foto" sería igual que "Elegir imagen".
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export function TransactionForm({
  accountId,
  accounts = [],
  categories,
  scanFile,
  onCreated,
}: {
  accountId?: string
  accounts?: Account[]
  categories: Category[]
  scanFile?: File
  onCreated: (tx: Transaction) => void
}) {
  const { token } = useAuth()
  const [selectedAccountId, setSelectedAccountId] = useState(accountId ?? '')
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(nowDateTimeInput())
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateFrequency, setTemplateFrequency] = useState<RecurrenceFrequency>('MONTHLY')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const scannedFileRef = useRef<File | null>(null)

  const categoriesForType = categories.filter((c) => c.type === type)

  function selectType(next: TransactionType) {
    setType(next)
    setCategoryId('')
  }

  async function scanReceipt(file: File) {
    if (!token) return
    setScanning(true)
    setScanError(null)
    try {
      const extracted = await api.extractReceipt(token, file)
      setType('EXPENSE')
      setCategoryId(extracted.suggestedCategory?.id ?? '')
      setAmount(extracted.amount ? String(extracted.amount) : '')
      setNote(extracted.merchant)
      // La factura solo da el día (si lo da) — la hora queda a mediodía y el
      // usuario la ajusta si le importa.
      setDate(extracted.occurredAt ? dateInputToDateTimeInput(extracted.occurredAt) : nowDateTimeInput())
    } catch (err) {
      setScanError(
        (err instanceof ApiError ? err.message : 'No se pudo leer la factura') +
          ' — puedes llenar el movimiento a mano.',
      )
    } finally {
      setScanning(false)
    }
  }

  // Foto elegida antes de abrir el formulario: se lee una sola vez (el ref
  // evita la doble ejecución de los efectos en desarrollo, que sería doble costo).
  useEffect(() => {
    if (!scanFile || scannedFileRef.current === scanFile) return
    scannedFileRef.current = scanFile
    void scanReceipt(scanFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanFile])

  function handleScanInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void scanReceipt(file)
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    if (!selectedAccountId) {
      setFormError('Elige una cuenta')
      return
    }
    if (!categoryId) {
      setFormError('Elige una categoría')
      return
    }
    setFormError(null)
    setCreating(true)
    try {
      const tx = await api.createTransaction(token, {
        accountId: selectedAccountId,
        categoryId,
        type,
        amount: Number(amount),
        note: note || undefined,
        occurredAt: dateTimeInputToIso(date),
      })
      if (saveAsTemplate) {
        try {
          await api.createRecurringTransaction(token, {
            accountId: selectedAccountId,
            categoryId,
            type,
            amount: Number(amount),
            note: note || undefined,
            frequency: templateFrequency,
          })
        } catch (err) {
          alert(
            err instanceof ApiError
              ? `El movimiento se registró, pero no se pudo guardar como plantilla: ${err.message}`
              : 'El movimiento se registró, pero no se pudo guardar como plantilla recurrente',
          )
        }
      }
      onCreated(tx)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar el movimiento')
      setCreating(false)
    }
  }

  return (
    <Form onSubmit={handleCreate}>
      <FormError>{formError}</FormError>
      <div className="ui-field-full tx-scan-row">
        <input ref={cameraInputRef} type="file" accept={RECEIPT_ACCEPT} capture="environment" hidden onChange={handleScanInput} />
        <input ref={galleryInputRef} type="file" accept={RECEIPT_ACCEPT} hidden onChange={handleScanInput} />
        {isTouchDevice() && (
          <Button type="button" variant="secondary" disabled={scanning} onClick={() => cameraInputRef.current?.click()}>
            <Camera size={16} /> Tomar foto
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={scanning} onClick={() => galleryInputRef.current?.click()}>
          <ImageIcon size={16} /> {isTouchDevice() ? 'Elegir imagen' : 'Subir imagen de factura'}
        </Button>
      </div>
      {scanning && <div className="ui-field-full tx-scan-status">Leyendo la factura…</div>}
      {scanError && <div className="ui-field-full tx-scan-status tx-scan-status-error">{scanError}</div>}
      <div className="ui-field-full">
        <SegmentedControl<TransactionType>
          value={type}
          onChange={selectType}
          options={[
            { value: 'EXPENSE', label: 'Gasto', tone: 'error' },
            { value: 'INCOME', label: 'Ingreso', tone: 'ok' },
          ]}
        />
      </div>
      {!accountId && (
        <FormField label="Cuenta" htmlFor="tx-account">
          <select
            id="tx-account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            required
          >
            <option value="" disabled>
              Elige una
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </FormField>
      )}
      <FormField label="Categoría" htmlFor="tx-category">
        <select id="tx-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          <option value="" disabled>
            Elige una
          </option>
          {categoriesForType.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ''}
              {c.name}
            </option>
          ))}
        </select>
        {categoriesForType.length === 0 && (
          <span style={{ fontSize: '0.8rem' }}>
            No tienes categorías de {type === 'EXPENSE' ? 'gasto' : 'ingreso'} — créalas en{' '}
            <Link to="/categories">Categorías</Link>
          </span>
        )}
      </FormField>
      <FormField label="Monto" htmlFor="tx-amount">
        <input
          id="tx-amount"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
          required
        />
      </FormField>
      <FormField label="Fecha y hora" htmlFor="tx-date">
        <input id="tx-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
      </FormField>
      <FormField label="Nota (opcional)" htmlFor="tx-note" full>
        <input id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <div className="ui-field-full tx-template-toggle">
        <label>
          <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
          Guardar como plantilla recurrente
        </label>
        {saveAsTemplate && (
          <select
            aria-label="Frecuencia de la plantilla"
            value={templateFrequency}
            onChange={(e) => setTemplateFrequency(e.target.value as RecurrenceFrequency)}
          >
            <option value="MONTHLY">Mensual</option>
            <option value="SEMIMONTHLY">Quincenal</option>
            <option value="WEEKLY">Semanal</option>
            <option value="YEARLY">Anual</option>
          </select>
        )}
      </div>
      <Button type="submit" disabled={creating || scanning}>
        {creating ? 'Guardando…' : 'Registrar movimiento'}
      </Button>
    </Form>
  )
}
