import { useEffect, useState, type FormEvent } from 'react'
import { Layout } from '../components/Layout'
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
      <div className="category-row">
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
    <div className="category-row">
      {category.emoji && <span className="category-emoji">{category.emoji}</span>}
      <span className="category-name">{category.name}</span>
      <div className="category-row-actions">
        <button onClick={() => setEditing(true)}>Editar</button>
        <button className="link-danger" onClick={handleDelete}>
          Eliminar
        </button>
      </div>
    </div>
  )
}

export function CategoriesPage() {
  const { token } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
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
      setShowForm(false)
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
    <Layout>
      <div className="categories-toolbar">
        <h1>Categorías</h1>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nueva categoría'}
        </button>
      </div>

      {showForm && (
        <form className="create-form" onSubmit={handleCreate}>
          {formError && (
            <div className="auth-error field-full" style={{ margin: 0 }}>
              {formError}
            </div>
          )}
          <div className="field field-full">
            <label htmlFor="cat-name">Nombre</label>
            <input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Comida"
            />
          </div>
          <div className="field">
            <label htmlFor="cat-type">Tipo</label>
            <select id="cat-type" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
              <option value="EXPENSE">Gasto</option>
              <option value="INCOME">Ingreso</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cat-emoji">Emoji (opcional)</label>
            <input id="cat-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
          </div>
          <button className="btn" type="submit" disabled={creating}>
            {creating ? 'Creando…' : 'Crear categoría'}
          </button>
        </form>
      )}

      {loading && <p>Cargando…</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <div className="categories-columns">
          <div className="categories-column">
            <h2>Gastos</h2>
            {expenseCategories.length === 0 && <p className="category-empty">Sin categorías de gasto</p>}
            <div className="category-list">
              {expenseCategories.map((c) => (
                <CategoryRow key={c.id} category={c} onSaved={updateOne} onDeleted={removeOne} />
              ))}
            </div>
          </div>
          <div className="categories-column">
            <h2>Ingresos</h2>
            {incomeCategories.length === 0 && <p className="category-empty">Sin categorías de ingreso</p>}
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
