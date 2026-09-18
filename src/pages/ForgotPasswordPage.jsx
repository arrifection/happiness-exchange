import { useState } from 'react'
import { Link } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'

function formatApiError(errorData, fallbackMessage) {
  return typeof errorData?.detail === 'string' ? errorData.detail : fallbackMessage
}

export default function ForgotPasswordPage({ apiBase }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${apiBase}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Unable to send reset email.'))
      }
      setSent(true)
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
      title="Forgot Password"
      description="Enter your email and we will send a reset link if an account exists."
      formEyebrow="Reset Link"
      formTitle="Request a password reset"
      formDescription="For your security we never confirm whether an email is registered."
      footer={(
        <p className="m-0 text-xs">
          Remembered it?
          {' '}
          <Link className="ml-1 font-bold text-[#8b4cf6] hover:underline" to="/login">
            Back to sign in
          </Link>
        </p>
      )}
    >
      {sent ? (
        <div className="rounded-xl border border-[#8b4cf6]/20 bg-[#8b4cf6]/5 p-3 text-center text-xs leading-relaxed text-[#1f1f1f]">
          If an account exists for that email, a password reset link has been sent.
          Check your inbox and spam folder.
        </div>
      ) : (
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80" htmlFor="forgot-email">
              Email Address
            </label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              required
              className="min-h-9 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3.5 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="relative mt-0.5 flex min-h-9 w-full items-center justify-center overflow-hidden rounded-btn bg-[#8b4cf6] px-6 text-xs font-bold uppercase tracking-widest text-white shadow-xs transition hover:bg-[#7b40e6] active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>

          {error ? (
            <div className="rounded-xl border border-[#c65d4a]/20 bg-[#c65d4a]/5 p-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-[#c65d4a]">
              {error}
            </div>
          ) : null}
        </form>
      )}
    </AuthShell>
  )
}
