import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const STATUS_ENDPOINT = `${API_BASE}/api/status`

export default function App() {
  const [health, setHealth] = useState(null)   // null = loading
  const [error, setError]   = useState(false)

  useEffect(() => {
    async function checkHealth() {
      try {
        const res  = await fetch(STATUS_ENDPOINT)
        const data = await res.json()
        setHealth(data)
      } catch {
        setError(true)
      }
    }
    checkHealth()
  }, [])

  // Derive display values
  const statusLabel  = error ? 'Unreachable' : health ? 'Online' : 'Checking…'
  const statusClass  = error ? 'status-dot--error' : health ? 'status-dot--ok' : 'status-dot--loading'
  const projectLabel = health?.project ?? '—'

  return (
    <>
      <main className="page">
        <section className="hero">
          <p className="hero__badge">MVP · v0.1</p>

          <h1 className="hero__title">Happiness Exchange</h1>

          <p className="hero__subtitle">
            Give what you don't need. Receive what you do.&nbsp;
            A free item donation and exchange platform.
          </p>

          {/* ── Backend health card ── */}
          <div className="health-card" role="status" aria-live="polite">
            <p className="health-card__label">Backend Status</p>

            <p className="health-card__status">
              <span className={`status-dot ${statusClass}`} />
              {statusLabel}
            </p>

            {health && (
              <p className="health-card__db">
                Project: <span>{projectLabel}</span>
              </p>
            )}

            {error && (
              <p className="health-card__db" style={{ color: 'var(--color-error)' }}>
                Could not reach {STATUS_ENDPOINT}
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        © 2026 Happiness Exchange — MVP build
      </footer>
    </>
  )
}
