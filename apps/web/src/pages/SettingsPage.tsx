import { useState, useEffect } from 'react'
import { Copy, CheckCircle } from 'lucide-react'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SectionHeader } from '../components/ui/SectionHeader'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import './SettingsPage.css'

export function SettingsPage() {
  const { token } = useAuth()
  const [apiKey, setApiKey] = useState<api.ApiKeyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    loadApiKey()
  }, [token])

  async function loadApiKey() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const key = await api.getCurrentApiKey(token)
      setApiKey(key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar token')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    if (!token) return
    setGenerating(true)
    setError(null)
    try {
      const key = await api.generateApiKey(token)
      setApiKey(key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar token')
    } finally {
      setGenerating(false)
    }
  }

  function copyToClipboard() {
    if (apiKey?.token) {
      navigator.clipboard.writeText(apiKey.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Layout>
      <SectionHeader as="h1" title="Configuración" subtitle="Administra tu cuenta" />

      <div className="settings-container">
        <section className="settings-section">
          <h2>Token para Shortcut de Apple Wallet</h2>
          <p className="settings-description">
            Genera un token seguro para usar en tu Shortcut de Apple Wallet. Puedes regenerarlo en cualquier momento.
          </p>

          {error && <div className="settings-error">{error}</div>}

          {loading ? (
            <p>Cargando...</p>
          ) : apiKey ? (
            <Card className="settings-token-card">
              <div className="token-display">
                <div className="token-info">
                  <div className="token-label">Token activo</div>
                  <div className="token-value">{apiKey.token.slice(0, 16)}...{apiKey.token.slice(-8)}</div>
                  <div className="token-date">Creado: {new Date(apiKey.createdAt).toLocaleDateString()}</div>
                </div>
                <Button
                  onClick={copyToClipboard}
                  variant={copied ? 'secondary' : undefined}
                >
                  {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="settings-empty">
              <p>No tienes un token generado aún</p>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="settings-button"
          >
            {generating ? 'Generando...' : 'Generar nuevo token'}
          </Button>

          <div className="settings-instructions">
            <h3>Cómo usarlo:</h3>
            <ol>
              <li>Copia el token (botón arriba)</li>
              <li>Abre la app de Shortcuts en tu iPhone</li>
              <li>En el Shortcut de Finanzas, pega el token en el header <code>Authorization</code></li>
              <li>¡Listo! Puedes usar el Shortcut</li>
            </ol>
          </div>
        </section>
      </div>
    </Layout>
  )
}
