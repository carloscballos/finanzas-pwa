import { useEffect, useState, type FormEvent } from 'react'
import { Tags } from 'lucide-react'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Form, FormField, FormError } from '../components/ui/Form'
import { ListRow } from '../components/ui/ListRow'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useCreateFormToggle } from '../components/ui/useCreateFormToggle'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError, type Category, type TransactionType } from '../lib/api'
import './CategoriesPage.css'

function CategoryRow({
  category,
  onSaved,
  onDeleted,
}: {
  category: Category
  onSaved: (category: Category) => void
  onDeleted: (id: string) => void
}) {
  const { token } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [emoji, setEmoji] = useState(category.emoji ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!token) return
    setSaving(true)
    try {
      const updated = await api.updateCategory(token, category.id, { name, emoji })
      onSaved(updated)
      setEditing(false)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo actualizar la categoría')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!token) return
    if (!confirm(`¿Eliminar la categoría "${category.name}"?`)) return
    try {
      await api.deleteCategory(token, category.id)
      onDeleted(category.id)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar la categoría')
    }
  }

  if (editing) {
    return (
      <div className="category-row-edit">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={4}
          style={{ width: '3rem', textAlign: 'center' }}
        />
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <div className="category-row-actions">
          <button onClick={handleSave} disabled={saving}>
            Guardar
          </button>
          <button onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <ListRow
      leading={category.emoji || undefined}
      title={category.name}
      actions={
        <div className="category-row-actions">
          <button onClick={() => setEditing(true)}>Editar</button>
          <button className="link-danger" onClick={handleDelete}>
            Eliminar
          </button>
        </div>
      }
    />
  )
}

export function CategoriesPage() {
  const { token } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { open: showForm, toggle: toggleForm, close: closeForm } = useCreateFormToggle()
  const [name, setName] = useState('')
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [emoji, setEmoji] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api
      .getCategories(token)
      .then(setCategories)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar categorías'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setFormError(null)
    setCreating(true)
    try {
      const category = await api.createCategory(token, { name, type, emoji: emoji || undefined })
      setCategories((prev) => [...prev, category])
      setName('')
      setEmoji('')
      closeForm()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la categoría')
    } finally {
      setCreating(false)
    }
  }

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE')
  const incomeCategories = categories.filter((c) => c.type === 'INCOME')

  function updateOne(updated: Category) {
    setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  function removeOne(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <Layout fabActions={[{ label: 'Nueva categoría', icon: Tags, onClick: toggleForm }]}>
      <SectionHeader as="h1" title="Categorías">
        <Button className={showForm ? '' : 'toolbar-create-btn'} onClick={toggleForm}>
          {showForm ? 'Cancelar' : '+ Nueva categoría'}
        </Button>
      </SectionHeader>

      {showForm && (
        <Card className="ui-form-card">
          <Form onSubmit={handleCreate}>
            <FormError>{formError}</FormError>
            <FormField label="Nombre" htmlFor="cat-name" full>
              <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Comida" />
            </FormField>
            <FormField label="Tipo" htmlFor="cat-type">
              <select id="cat-type" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
                <option value="EXPENSE">Gasto</option>
                <option value="INCOME">Ingreso</option>
              </select>
            </FormField>
            <FormField label="Emoji (opcional)" htmlFor="cat-emoji">
              <input id="cat-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
            </FormField>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear categoría'}
            </Button>
          </Form>
        </Card>
      )}

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <div className="categories-columns">
          <div className="categories-column">
            <h2>Gastos</h2>
            {expenseCategories.length === 0 && <EmptyState>Sin categorías de gasto</EmptyState>}
            <div className="category-list">
              {expenseCategories.map((c) => (
                <CategoryRow key={c.id} category={c} onSaved={updateOne} onDeleted={removeOne} />
              ))}
            </div>
          </div>
          <div className="categories-column">
            <h2>Ingresos</h2>
            {incomeCategories.length === 0 && <EmptyState>Sin categorías de ingreso</EmptyState>}
            <div className="category-list">
              {incomeCategories.map((c) => (
                <CategoryRow key={c.id} category={c} onSaved={updateOne} onDeleted={removeOne} />
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
