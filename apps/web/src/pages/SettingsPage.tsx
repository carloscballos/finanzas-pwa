import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Copy, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Layout } from '../components/Layout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import { formatDateOnly } from '../lib/dates'
import './SettingsPage.css'

export function SettingsPage() {
  const { token } = useAuth()
  const [current, setCurrent] = useState<api.CurrentApiKey | null>(null)
  // El token completo solo existe justo después de generarlo; no se puede volver a pedir.
  const [fresh, setFresh] = useState<api.GeneratedApiKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    api
      .getCurrentApiKey(token)
      .then(setCurrent)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el token'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(load, [load])

  async function handleGenerate() {
    if (!token) return
    if (current && !confirm('Al generar uno nuevo, el token actual deja de funcionar y tendrás que pegar el nuevo en el Shortcut. ¿Continuar?'))
      return
    setBusy(true)
    setError(null)
    try {
      const key = await api.generateApiKey(token)
      setFresh(key)
      setCurrent({ hint: key.hint, createdAt: key.createdAt })
      setCopied(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al generar el token')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke() {
    if (!token) return
    if (!confirm('¿Revocar el token? El Shortcut dejará de registrar pagos hasta que generes otro.')) return
    setBusy(true)
    setError(null)
    try {
      await api.revokeApiKey(token)
      setCurrent(null)
      setFresh(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al revocar el token')
    } finally {
      setBusy(false)
    }
  }

  async function copyToken() {
    if (!fresh) return
    try {
      await navigator.clipboard.writeText(fresh.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar; selecciona el token y cópialo a mano.')
    }
  }

  return (
    <Layout>
      <SectionHeader
        as="h1"
        title="Atajo de Apple Wallet"
        subtitle="Registra tus pagos de Wallet como «pendientes» y confírmalos después en la app."
      />

      <div className="settings-container">
        {error && <div className="auth-error">{error}</div>}

        <Card className="settings-card">
          <div className="settings-card-head">
            <h2>Tu token</h2>
            {current && <Badge tone="ok">Activo</Badge>}
          </div>

          {loading ? (
            <p>Cargando…</p>
          ) : fresh ? (
            <>
              <div className="settings-warning" role="alert">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>Cópialo ahora y pégalo en el Shortcut. Por seguridad no se vuelve a mostrar.</span>
              </div>
              <div className="settings-token">{fresh.token}</div>
              <div className="settings-actions">
                <Button onClick={copyToken}>
                  {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado' : 'Copiar token'}
                </Button>
                <Button variant="secondary" onClick={() => setFresh(null)}>
                  Ya lo guardé
                </Button>
              </div>
            </>
          ) : current ? (
            <>
              <div className="settings-token settings-token-hidden">fin_••••••••••••{current.hint}</div>
              <p className="settings-meta">Creado el {formatDateOnly(current.createdAt)}</p>
              <div className="settings-actions">
                <Button variant="secondary" onClick={handleGenerate} disabled={busy}>
                  Generar uno nuevo
                </Button>
                <button type="button" className="link-danger" onClick={handleRevoke} disabled={busy}>
                  Revocar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="settings-meta">Todavía no tienes un token.</p>
              <div className="settings-actions">
                <Button onClick={handleGenerate} disabled={busy}>
                  {busy ? 'Generando…' : 'Generar token'}
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card className="settings-card">
          <div className="settings-card-head">
            <h2>
              <ShieldCheck size={18} aria-hidden="true" /> Qué puede hacer
            </h2>
          </div>
          <p className="settings-meta">
            Este token <strong>solo</strong> sirve para registrar pagos pendientes. No puede ver tus cuentas ni saldos, ni
            confirmar, editar o borrar nada. Si lo pierdes o lo compartes por error, revócalo aquí y genera otro.
          </p>
        </Card>

        <Card className="settings-card">
          <div className="settings-card-head">
            <h2>Cómo usarlo</h2>
          </div>
          <ol className="settings-steps">
            <li>Genera el token y cópialo.</li>
            <li>En la app Atajos del iPhone, crea un atajo con la acción «Obtener contenido de URL».</li>
            <li>
              URL <code>https://api.koystudio.dev/api/v1/transactions</code>, método <code>POST</code>, y los encabezados{' '}
              <code>Content-Type: application/json</code> y <code>Authorization: Bearer</code> + tu token.
            </li>
            <li>
              Cuerpo JSON: <code>type</code> = EXPENSE, <code>amount</code> = el monto, <code>occurredAt</code> = la hora
              actual. No hace falta cuenta ni categoría: las eliges al confirmar.
            </li>
            <li>Opcional: una automatización de Wallet («Se completa un pago») que ejecute el atajo sin preguntar.</li>
          </ol>
          <p className="settings-meta">
            Cada pago aparece en el Inicio como pendiente; ábrelo, elige cuenta y categoría, y confírmalo.
          </p>
        </Card>
      </div>
    </Layout>
  )
}
