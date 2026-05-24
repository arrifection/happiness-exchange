import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'

function formatApiError(errorData, fallbackMessage) {
  return typeof errorData?.detail === 'string' ? errorData.detail : fallbackMessage
}

export default function SignupPage({ apiBase, onSuccess, currentUser }) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (currentUser) {
    return <Navigate to="/" replace />
  }

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
    if (error) setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch(`${apiBase}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Signup failed.'))
      }

      onSuccess(data)
      navigate('/check-email', {
        replace: true,
        state: { email: formData.email.trim().toLowerCase() },
      })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'min-h-10 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3.5 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10'
  const labelClass = 'text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80'

  return (
    <AuthShell
      eyebrow="Join the Movement"
      title="Create Your Account"
      description="Every member can give and receive. Be part of a community built on trust."
      formEyebrow="Community Member"
      formTitle="Your Details"
      formDescription="Fill in your information to get started."
      footer={(
        <p className="m-0 text-xs">
          Already a member?{' '}
          <Link className="ml-1 font-bold text-[#8b4cf6] hover:underline" to="/login">
            Sign in here
          </Link>
        </p>
      )}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>

        {/* Name */}
        <div className="grid gap-1">
          <label className={labelClass} htmlFor="signup-name">Display Name / Username</label>
          <input
            id="signup-name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Sara Khan"
            autoComplete="name"
            required
            className={inputClass}
          />
        </div>

        {/* Email */}
        <div className="grid gap-1">
          <label className={labelClass} htmlFor="signup-email">Email Address</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@example.com"
            autoComplete="email"
            required
            className={inputClass}
          />
        </div>

        {/* Password */}
        <div className="grid gap-1">
          <label className={labelClass} htmlFor="signup-password">Password</label>
          <div className="relative">
            <input
              id="signup-password"
              name="password"
              type={showPass ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8c755f] hover:text-[#8b4cf6]"
              tabIndex={-1}
            >
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="grid gap-1">
          <label className={labelClass} htmlFor="signup-confirm">Confirm Password</label>
          <div className="relative">
            <input
              id="signup-confirm"
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8c755f] hover:text-[#8b4cf6]"
              tabIndex={-1}
            >
              {showConfirm ? 'Hide' : 'Show'}
            </button>
          </div>
          {formData.confirmPassword && formData.password !== formData.confirmPassword && (
            <p className="text-[9px] font-bold text-[#c65d4a]">Passwords don't match yet.</p>
          )}
        </div>

        {/* Community Member badge */}
        <div className="flex items-center gap-2 rounded-xl border border-[#8b4cf6]/20 bg-[#efe7ff]/30 px-3 py-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#8b4cf6]/20 text-[#8b4cf6]">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-[10px] font-bold text-[#8b4cf6]">
            Community Member — give items, request items, chat & review
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || (formData.confirmPassword && formData.password !== formData.confirmPassword)}
          className="relative mt-1 flex min-h-10 w-full items-center justify-center overflow-hidden rounded-btn bg-[#8b4cf6] px-6 text-xs font-bold uppercase tracking-widest text-white shadow-xs transition hover:bg-[#7b40e6] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Creating account...' : 'Join Community'}
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
