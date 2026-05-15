import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'

function formatApiError(errorData, fallbackMessage) {
  return typeof errorData?.detail === 'string' ? errorData.detail : fallbackMessage
}

export default function LoginPage({ apiBase, onSuccess, currentUser }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
        throw new Error(formatApiError(data, 'Login failed.'))
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
      eyebrow="Community First"
      title="Welcome Back"
      description="Sign in to continue your journey of giving and receiving. Every small act creates a wave of happiness."
      formEyebrow="Secure Access"
      formTitle="Log in to your account"
      formDescription="Enter your credentials below to access your dashboard and items."
      footer={(
        <p className="m-0">
          New to the community?
          {' '}
          <Link className="ml-1 font-bold text-[#8b4cf6] hover:underline" to="/signup">
            Create an account
          </Link>
        </p>
      )}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]" htmlFor="login-email">
            Email Address
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@example.com"
            autoComplete="email"
            required
            className="min-h-11 w-full rounded-xl border border-[#f1e2b8] bg-[#fffdfa] px-4 text-sm text-[#1f1f1f] shadow-sm outline-none transition-all focus:border-[#8b4cf6] focus:ring-4 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]" htmlFor="login-password">
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
            className="min-h-11 w-full rounded-xl border border-[#f1e2b8] bg-[#fffdfa] px-4 text-sm text-[#1f1f1f] shadow-sm outline-none transition-all focus:border-[#8b4cf6] focus:ring-4 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="relative mt-2 flex min-h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-[#8b4cf6] px-6 text-[13px] font-bold uppercase tracking-widest text-white shadow-lg shadow-[#8b4cf6]/20 transition-all hover:bg-[#7b40e6] hover:shadow-xl hover:shadow-[#8b4cf6]/30 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>

        {error ? (
          <div className="rounded-xl border border-[#c65d4a]/20 bg-[#c65d4a]/5 p-3 text-center text-[11px] font-bold uppercase tracking-widest text-[#c65d4a]">
            {error}
          </div>
        ) : null}
      </form>
    </AuthShell>
  )
}
