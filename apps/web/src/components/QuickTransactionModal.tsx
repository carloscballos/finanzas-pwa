import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from './ui/Modal'
import { EmptyState } from './ui/EmptyState'
import { TransactionForm } from './TransactionForm'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Account, type Category } from '../lib/api'
import { emitDataChanged } from '../lib/dataEvents'

// Carga cuentas y categorías al abrirse (el Modal solo monta su contenido
// cuando está abierto, así que esto corre una vez por apertura y los saldos
// que se ven en el selector siempre están al día).
function QuickTransactionContent({ onDone, scanFile }: { onDone: () => void; scanFile?: File }) {
  const { token } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    Promise.all([api.getAccounts(token), api.getCategories(token)])
      .then(([accs, cats]) => {
        // Las tarjetas de crédito se alimentan con compras a cuotas (ahí se
        // cuida que el cupo cuadre), no con movimientos sueltos.
        setAccounts(accs.filter((a) => a.type !== 'CREDIT_CARD'))
        setCategories(cats)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tus cuentas'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <p>Cargando…</p>
  if (error) return <div className="auth-error">{error}</div>
  if (accounts.length === 0) {
    return (
      <EmptyState>
        Primero necesitas una cuenta. <Link to="/accounts?new=1" onClick={onDone}>Crear una cuenta</Link>
      </EmptyState>
    )
  }

  return (
    <TransactionForm
      accounts={accounts}
      categories={categories}
      scanFile={scanFile}
      onCreated={() => {
        emitDataChanged()
        onDone()
      }}
    />
  )
}

/** "Nuevo movimiento" desde cualquier parte de la app, eligiendo la cuenta en el formulario. */
/** Con `scanFile` el formulario se abre leyendo esa foto de factura. */
export function QuickTransactionModal({
  open,
  onClose,
  scanFile,
}: {
  open: boolean
  onClose: () => void
  scanFile?: File
}) {
  return (
    <Modal open={open} onClose={onClose} title="Nuevo movimiento">
      <QuickTransactionContent onDone={onClose} scanFile={scanFile} />
    </Modal>
  )
}
