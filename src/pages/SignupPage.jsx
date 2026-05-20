import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'

const accountOptions = [
  {
    value: 'giver',
    title: 'Give items',
    description: 'Share things you no longer need.',
  },
  {
    value: 'receiver',
    title: 'Receive items',
    description: 'Request things you need.',
  },
]

function formatApiError(errorData, fallbackMessage) {
  return typeof errorData?.detail === 'string' ? errorData.detail : fallbackMessage
}

export default function SignupPage({ apiBase, onSuccess, currentUser }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    account_type: 'giver',
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
      const response = await fetch(`${apiBase}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Signup failed.'))
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
      eyebrow="Join the Movement"
      title="Create Your Account"
      description="Be part of a community that believes in sharing."
      formEyebrow="Getting Started"
      formTitle="Personal Details"
      formDescription="Fill in your information to set up your profile."
      footer={(
        <p className="m-0 text-xs">
          Already a member?
          {' '}
          <Link className="ml-1 font-bold text-[#8b4cf6] hover:underline" to="/login">
            Sign in here
          </Link>
        </p>
      )}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80" htmlFor="signup-name">
            Full Name
          </label>
          <input
            id="signup-name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="Jane Doe"
            autoComplete="name"
            required
            className="min-h-10 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3.5 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80" htmlFor="signup-email">
            Email Address
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@example.com"
            autoComplete="email"
            required
            className="min-h-10 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3.5 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            className="min-h-10 w-full rounded-input border border-[#efe8da] bg-[#fffdfb] px-3.5 text-xs text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <div className="grid gap-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#8c755f]/80">Account type</p>
          <div className="grid gap-2 grid-cols-2">
            {accountOptions.map((option) => {
              const isSelected = formData.account_type === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData((current) => ({ ...current, account_type: option.value }))}
                  className={`relative flex flex-col items-start rounded-card border p-3 text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-[#8b4cf6] bg-[#efe7ff]/40'
                      : 'border-[#efe8da] bg-[#fffdfb] hover:border-[#8b4cf6]/40'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute right-2 top-2 scale-90">
                      <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#8b4cf6] text-white">
                        <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] font-bold text-[#1f1f1f]">{option.title}</p>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-[#68766d]">{option.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="relative mt-1 flex min-h-10 w-full items-center justify-center overflow-hidden rounded-btn bg-[#8b4cf6] px-6 text-xs font-bold uppercase tracking-widest text-white shadow-xs transition hover:bg-[#7b40e6] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Creating account...' : 'Create Account'}
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
