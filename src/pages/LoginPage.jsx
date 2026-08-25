import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'
import CountrySelect from '../components/CountrySelect.jsx'
import { IS_LOCAL_DEV, LOCAL_TEST_USERS, loginLocalTestUser } from '../lib/localDevAuth.js'
import { DEFAULT_COUNTRY } from '../lib/locations.js'

function formatApiError(errorData, fallbackMessage) {
  return typeof errorData?.detail === 'string' ? errorData.detail : fallbackMessage
}

export default function LoginPage({ apiBase, onSuccess, currentUser }) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [dummyCountry, setDummyCountry] = useState(DEFAULT_COUNTRY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (currentUser && !IS_LOCAL_DEV) {
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
    if (IS_LOCAL_DEV) {
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

  async function handleLocalTestLogin(user) {
    setSubmitting(true)
    setError('')
    try {
      const data = await loginLocalTestUser(apiBase, user, dummyCountry)
      onSuccess(data)
      navigate('/browse', { replace: true })
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
      {IS_LOCAL_DEV ? (
        <div className="mb-4 rounded-2xl border border-[#8b4cf6]/30 bg-[#efe7ff] p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5a2fc4]">
            Local dummy login
          </p>
          {currentUser ? (
            <p className="mt-1 text-[11px] leading-relaxed text-[#3d246e]">
              Currently signed in as {currentUser.email}. Click User A or User B below to switch.
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-relaxed text-[#3d246e]">
            This is localhost, not happyexchange.net. Dummy login can override country for testing. Regular login uses the country saved on the account.
            </p>
          )}
          <div className="mt-3">
            <CountrySelect
              value={dummyCountry}
              onChange={setDummyCountry}
              disabled={submitting}
              label="Override country (dummy login only)"
            />
          </div>
          <div className="mt-3 grid gap-2">
            {LOCAL_TEST_USERS.map((user) => (
              <button
                key={user.key}
                type="button"
                disabled={submitting}
                onClick={() => handleLocalTestLogin(user)}
                className="rounded-xl bg-[#8b4cf6] px-3 py-2 text-left text-[12px] font-bold text-white disabled:opacity-60"
              >
                Log in as User {user.key}
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/80">
                  {user.email} · {user.password}
                </span>
              </button>
            ))}
          </div>
        </div>
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
          <input
            id="login-password"
            name="password"
            type="password"
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
