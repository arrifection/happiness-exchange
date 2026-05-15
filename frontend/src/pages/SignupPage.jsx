import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'

const accountOptions = [
  {
    value: 'giver',
    title: 'I want to give items',
    description: 'List items you no longer need.',
  },
  {
    value: 'receiver',
    title: 'I want to receive items',
    description: 'Browse items and request what you need.',
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
      description="Be part of a community that believes in sharing. Whether you want to give or receive, there's a place for you here."
      formEyebrow="Getting Started"
      formTitle="Personal Details"
      formDescription="Fill in your information to set up your community profile."
      footer={(
        <p className="m-0">
          Already a member?
          {' '}
          <Link className="ml-1 font-bold text-[#8b4cf6] hover:underline" to="/login">
            Sign in here
          </Link>
        </p>
      )}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]" htmlFor="signup-name">
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
            className="min-h-11 w-full rounded-xl border border-[#f1e2b8] bg-[#fffdfa] px-4 text-sm text-[#1f1f1f] shadow-sm outline-none transition-all focus:border-[#8b4cf6] focus:ring-4 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]" htmlFor="signup-email">
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
            className="min-h-11 w-full rounded-xl border border-[#f1e2b8] bg-[#fffdfa] px-4 text-sm text-[#1f1f1f] shadow-sm outline-none transition-all focus:border-[#8b4cf6] focus:ring-4 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]" htmlFor="signup-password">
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
            className="min-h-11 w-full rounded-xl border border-[#f1e2b8] bg-[#fffdfa] px-4 text-sm text-[#1f1f1f] shadow-sm outline-none transition-all focus:border-[#8b4cf6] focus:ring-4 focus:ring-[#8b4cf6]/10"
          />
        </div>

        <div className="grid gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c755f]">Account type</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {accountOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData((current) => ({ ...current, account_type: option.value }))}
                className={`relative flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                  formData.account_type === option.value
                    ? 'border-[#8b4cf6] bg-[#efe7ff] ring-4 ring-[#8b4cf6]/10'
                    : 'border-[#f1e2b8] bg-[#fffdf7] hover:border-[#d6bc73]'
                }`}
              >
                {formData.account_type === option.value && (
                  <div className="absolute right-3 top-3">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#8b4cf6] text-white">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
                <p className="text-[13px] font-bold text-[#1f3328]">{option.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#68766d]">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="relative mt-2 flex min-h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-[#8b4cf6] px-6 text-[13px] font-bold uppercase tracking-widest text-white shadow-lg shadow-[#8b4cf6]/20 transition-all hover:bg-[#7b40e6] hover:shadow-xl hover:shadow-[#8b4cf6]/30 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Creating account...' : 'Create Account'}
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
