import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'
import CountrySelect from '../components/CountrySelect.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { validateWhatsAppInput } from '../lib/whatsappRequirement.js'
import { DEFAULT_COUNTRY } from '../lib/locations.js'

function formatApiError(errorData, fallbackMessage) {
  return typeof errorData?.detail === 'string' ? errorData.detail : fallbackMessage
}

export default function SignupPage({ apiBase, onSuccess, currentUser }) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp_number: '',
    password: '',
    confirmPassword: '',
    country: DEFAULT_COUNTRY,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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

    const whatsappError = validateWhatsAppInput(formData.whatsapp_number)
    if (whatsappError) {
      setError(whatsappError)
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
          whatsapp_number: formData.whatsapp_number,
          password: formData.password,
          country: formData.country,
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
    'min-h-9 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10'
  const labelClass = 'text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80'
  const hasStartedForm = Object.values(formData).some((value) => String(value || '').trim().length > 0)
  const whatsappError = useMemo(
    () => validateWhatsAppInput(formData.whatsapp_number),
    [formData.whatsapp_number],
  )

  const isFormReady = useMemo(() => {
    if (formData.name.trim().length < 2) return false
    if (!formData.email.trim()) return false
    if (whatsappError) return false
    if (formData.password.length < 8) return false
    if (formData.password !== formData.confirmPassword) return false
    if (!formData.country) return false
    return true
  }, [formData, whatsappError])

  const disabledReason = useMemo(() => {
    if (formData.name.trim().length < 2) return 'Add a display name to unlock Create Account.'
    if (!formData.email.trim()) return 'Add your email address to continue.'
    if (whatsappError) return whatsappError
    if (formData.password.length < 8) return 'Password must be at least 8 characters.'
    if (formData.password !== formData.confirmPassword) return 'Passwords must match to continue.'
    if (!formData.country) return 'Choose Pakistan or Saudi Arabia.'
    return ''
  }, [formData, whatsappError])

  const submitStateClass = submitting
    ? 'is-submitting'
    : isFormReady
      ? 'is-ready'
      : 'is-disabled'

  return (
    <AuthShell
      eyebrow="Join the Movement"
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
      <form className="he-auth-signup-form" onSubmit={handleSubmit}>
        <div className="he-auth-signup-field">
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

        <div className="he-auth-signup-field">
          <CountrySelect
            id="signup-country"
            value={formData.country}
            onChange={(country) => setFormData((current) => ({ ...current, country }))}
            disabled={submitting}
            label="Country"
          />
          <p className="m-0 text-[10px] leading-relaxed text-[#68766d]">
            Saved on your account. You will only see cities from this country when requesting or swapping items.
          </p>
        </div>

        <div className="he-auth-signup-field">
          <label className={labelClass} htmlFor="signup-email">Email Address</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@email.com"
            autoComplete="email"
            required
            className={inputClass}
          />
        </div>

        <div className="he-auth-signup-field">
          <label className={labelClass} htmlFor="signup-whatsapp">
            WhatsApp Number <span className="text-[#c65d4a]">*</span>
          </label>
          <input
            id="signup-whatsapp"
            name="whatsapp_number"
            type="tel"
            value={formData.whatsapp_number}
            onChange={handleChange}
            placeholder="+92 300 1234567"
            autoComplete="tel"
            required
            className={inputClass}
          />
          <p className="he-auth-signup-hint">
            Admins only - used to coordinate approved exchanges.
          </p>
          {formData.whatsapp_number.trim() && whatsappError ? (
            <p className="he-auth-signup-status he-auth-signup-status-warning">{whatsappError}</p>
          ) : null}
        </div>

        <div className="he-auth-signup-field">
          <label className={labelClass} htmlFor="signup-password">Password</label>
          <PasswordField
            id="signup-password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </div>

        <div className="he-auth-signup-field">
          <label className={labelClass} htmlFor="signup-confirm">Confirm Password</label>
          <PasswordField
            id="signup-confirm"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
          {formData.confirmPassword && formData.password !== formData.confirmPassword ? (
            <p className="text-[9px] font-bold text-[#c65d4a]">Passwords don&apos;t match yet.</p>
          ) : null}
        </div>

        <div className="he-auth-signup-badge">
          <div className="he-auth-signup-badge-icon" aria-hidden="true">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="he-auth-signup-badge-text">
            Community Member - give items, request items, and leave reviews
          </p>
        </div>

        {error ? (
          <div className="he-auth-signup-error">{error}</div>
        ) : null}

        {hasStartedForm && !isFormReady && !submitting ? (
          <p className="he-auth-signup-status he-auth-signup-status-warning">{disabledReason}</p>
        ) : null}

        <button
          id="signup-submit"
          type="submit"
          disabled={submitting || !isFormReady}
          className={`he-auth-signup-submit ${submitStateClass}`}
          aria-disabled={submitting || !isFormReady}
        >
          {submitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </AuthShell>
  )
}
