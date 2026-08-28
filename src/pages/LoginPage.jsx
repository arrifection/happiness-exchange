import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'
import LocalDemoSignIn from '../components/LocalDemoSignIn.jsx'
import PasswordField from '../components/PasswordField.jsx'

function formatApiError(errorData, fallbackMessage) {
  return typeof errorData?.detail === 'string' ? errorData.detail : fallbackMessage
}

export default function LoginPage({ apiBase, onSuccess, currentUser }) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Locally the page stays reachable while signed in, so the dev shortcuts can
  // switch between test accounts without logging out first.
  if (currentUser && !import.meta.env.DEV) {
    return <Navigate to="/" replace />
  }

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function completeLogin(email, password, nextPath = '/browse') {
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(formatApiError(data, 'Login failed.'))
    }

    onSuccess(data)
    if (import.meta.env.DEV) {
      navigate(nextPath, { replace: true })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await completeLogin(formData.email, formData.password)
    } catch (submitError) {
      setError(
        submitError.message === 'Failed to fetch'
          ? `Cannot reach ${apiBase}. Stay on http://localhost:5173 — not the live website.`
          : submitError.message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Community First"
      title="Welcome Back"
      description="Sign in to continue your journey of giving and receiving."
      formEyebrow="Secure Access"
      formTitle="Log in to your account"
      formDescription="Enter your credentials below to access your dashboard."
      footer={(
        <p className="m-0 text-xs">
          New to the community?
          {' '}
          <Link className="ml-1 font-bold text-[#8b4cf6] hover:underline" to="/signup">
            Create an account
          </Link>
        </p>
      )}
    >
      {import.meta.env.DEV ? (
        <LocalDemoSignIn apiBase={apiBase} currentUser={currentUser} onSuccess={onSuccess} />
      ) : null}

      <p className="mb-3 text-center text-[11px] text-[#68766d]">
        New here?{' '}
        <Link to="/signup" className="font-bold text-[#8b4cf6] hover:underline">
          Create an account
        </Link>
      </p>

      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80" htmlFor="login-email">
            Email Address
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@email.com"
            autoComplete="email"
            required
            className="min-h-9 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3.5 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80" htmlFor="login-password">
            Password
          </label>
          <PasswordField
            id="login-password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="min-h-9 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3.5 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="relative mt-0.5 flex min-h-9 w-full items-center justify-center overflow-hidden rounded-btn bg-[#8b4cf6] px-6 text-xs font-bold uppercase tracking-widest text-white shadow-xs transition hover:bg-[#7b40e6] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>

        {error ? (
          <div className="rounded-xl border border-[#c65d4a]/20 bg-[#c65d4a]/5 p-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">
            {error}
          </div>
        ) : null}
      </form>
    </AuthShell>
  )
}
