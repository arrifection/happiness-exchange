import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const STATUS_ENDPOINT = `${API_BASE}/api/status`
const ME_ENDPOINT = `${API_BASE}/api/me`
const TOKEN_KEY = 'happiness_exchange_token'

export default function App() {
  const [view, setView] = useState('signup')
  const [statusInfo, setStatusInfo] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [loadingUser, setLoadingUser] = useState(false)

  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await fetch(STATUS_ENDPOINT)
        const data = await response.json()
        setStatusInfo(data)
      } catch {
        setStatusError(`Could not reach ${STATUS_ENDPOINT}`)
      }
    }

    loadStatus()
  }, [])

  useEffect(() => {
    if (!token) {
      setCurrentUser(null)
      return
    }

    async function loadCurrentUser() {
      setLoadingUser(true)
      setAuthError('')

      try {
        const response = await fetch(ME_ENDPOINT, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || 'Could not load current user.')
        }

        const data = await response.json()
        setCurrentUser(data)
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY)
        setToken('')
        setCurrentUser(null)
        setAuthError(error.message)
      } finally {
        setLoadingUser(false)
      }
    }

    loadCurrentUser()
  }, [token])

  function handleAuthSuccess(data) {
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setToken(data.access_token)
    setCurrentUser(data.user)
    setAuthError('')
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setCurrentUser(null)
    setAuthError('')
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Happiness Exchange</p>
        <h1>Authentication Foundation</h1>
        <p className="intro">
          Create an account, log in, receive a token, and confirm access to a protected route.
        </p>

        <section className="status-panel">
          <h2>Backend status</h2>
          {statusInfo ? (
            <p>
              {statusInfo.status} - {statusInfo.project}
            </p>
          ) : (
            <p>{statusError || 'Checking backend status...'}</p>
          )}
        </section>

        {currentUser ? (
          <section className="user-panel">
            <h2>Logged in</h2>
            <p>Name: {currentUser.name}</p>
            <p>Email: {currentUser.email}</p>
            <p className="token-label">Token stored in localStorage.</p>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </section>
        ) : (
          <>
            <div className="view-switcher">
              <button
                type="button"
                className={view === 'signup' ? 'active' : ''}
                onClick={() => setView('signup')}
              >
                Signup
              </button>
              <button
                type="button"
                className={view === 'login' ? 'active' : ''}
                onClick={() => setView('login')}
              >
                Login
              </button>
            </div>

            {view === 'signup' ? (
              <SignupPage
                apiBase={API_BASE}
                onSuccess={handleAuthSuccess}
                onSwitchToLogin={() => setView('login')}
              />
            ) : (
              <LoginPage
                apiBase={API_BASE}
                onSuccess={handleAuthSuccess}
                onSwitchToSignup={() => setView('signup')}
              />
            )}
          </>
        )}

        {loadingUser && <p className="message">Loading current user...</p>}
        {authError && <p className="message error">{authError}</p>}
      </section>
    </main>
  )
}
