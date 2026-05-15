import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'

const styles = {
  form: {
    display: 'grid',
    gap: '18px',
  },
  label: {
    display: 'grid',
    gap: '8px',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#274038',
  },
  input: {
    minHeight: '54px',
    borderRadius: '18px',
    border: '1px solid #dfd6c8',
    background: '#fffdfa',
    padding: '0 16px',
    font: 'inherit',
    color: '#1f3730',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  },
  note: {
    borderRadius: '24px',
    border: '1px solid #e7dfd2',
    background: 'linear-gradient(180deg, #fffaf4, #fffdf9)',
    padding: '16px 18px',
    fontSize: '0.94rem',
    lineHeight: 1.8,
    color: '#5f6d68',
  },
  submit: {
    minHeight: '54px',
    borderRadius: '999px',
    border: 0,
    background: '#1d6b57',
    color: '#ffffff',
    font: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 18px 40px rgba(29, 107, 87, 0.22)',
  },
  footerButton: {
    border: 0,
    background: 'transparent',
    color: '#1d6b57',
    font: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
  },
  error: {
    margin: 0,
    fontSize: '0.94rem',
    fontWeight: 600,
    color: '#b04e43',
  },
}

export default function LoginPage({ apiBase, onSuccess, onSwitchToSignup, currentUser }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submitStyle = useMemo(
    () => ({
      ...styles.submit,
      opacity: submitting ? 0.7 : 1,
      cursor: submitting ? 'wait' : 'pointer',
    }),
    [submitting],
  )

  if (currentUser) {
    return <Navigate to="/dashboard" replace />
  }

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Login failed.')
      }

      onSuccess(data)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="A simple login for generous giving and thoughtful receiving."
      description="Sign in to keep your shared items moving, respond to people who need them, and stay close to the stories your community is creating."
      formEyebrow="Login"
      formTitle="Continue your community exchange"
      formDescription="Use your existing email and password. The auth flow and saved token behavior stay exactly the same."
      footer={(
        <p style={{ margin: 0 }}>
          Don&apos;t have an account?{' '}
          <button type="button" onClick={onSwitchToSignup} style={styles.footerButton}>
            Create an account
          </button>
        </p>
      )}
    >
      <form style={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="login-email" style={styles.label}>
          <span>Email</span>
          <input
            id="login-email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="jane@example.com"
            autoComplete="email"
            required
            style={styles.input}
          />
        </label>

        <label htmlFor="login-password" style={styles.label}>
          <span>Password</span>
          <input
            id="login-password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Your password"
            autoComplete="current-password"
            required
            style={styles.input}
          />
        </label>

        <div style={styles.note}>
          Givers and receivers both sign in here. We&apos;re only redesigning the welcome flow for now, so your existing account access remains unchanged.
        </div>

        <button type="submit" disabled={submitting} style={submitStyle}>
          {submitting ? 'Logging in...' : 'Log in'}
        </button>

        {error ? <p style={styles.error}>{error}</p> : null}
      </form>
    </AuthShell>
  )
}
