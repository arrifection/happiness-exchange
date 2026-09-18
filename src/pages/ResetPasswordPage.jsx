import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'
import PasswordField from '../components/PasswordField.jsx'

function formatApiError(errorData, fallbackMessage) {
  return typeof errorData?.detail === 'string' ? errorData.detail : fallbackMessage
}

export default function ResetPasswordPage({ apiBase }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!token) {
      setError('This reset link is missing a token. Request a new one from the login page.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(`${apiBase}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Unable to reset password.'))
      }
      navigate('/login', { replace: true, state: { passwordReset: true } })
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
      eyebrow="Account Recovery"
      title="Set a New Password"
      description="Choose a new password for your Happiness Exchange account."
      formEyebrow="New Password"
      formTitle="Reset your password"
      formDescription="This link can only be used once and expires after 60 minutes."
      footer={(
        <p className="m-0 text-xs">
          Need a new link?
          {' '}
          <Link className="ml-1 font-bold text-[#8b4cf6] hover:underline" to="/forgot-password">
            Request again
          </Link>
        </p>
      )}
    >
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80" htmlFor="reset-password">
            New Password
          </label>
          <PasswordField
            id="reset-password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
            minLength={8}
            className="min-h-9 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3.5 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80" htmlFor="reset-password-confirm">
            Confirm Password
          </label>
          <PasswordField
            id="reset-password-confirm"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
            minLength={8}
            className="min-h-9 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3.5 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !token}
          className="relative mt-0.5 flex min-h-9 w-full items-center justify-center overflow-hidden rounded-btn bg-[#8b4cf6] px-6 text-xs font-bold uppercase tracking-widest text-white shadow-xs transition hover:bg-[#7b40e6] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Update password'}
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
