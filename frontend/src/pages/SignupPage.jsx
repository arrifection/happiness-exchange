import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthShell } from '../components/AuthShell.jsx'

const accountOptions = [
  {
    value: 'giver',
    title: 'I want to give items',
    description: 'List items you no longer need and help someone nearby.',
    background: 'linear-gradient(180deg, rgba(228, 244, 235, 0.92), rgba(255, 255, 255, 0.96))',
  },
  {
    value: 'receiver',
    title: 'I want to receive items',
    description: 'Browse free items and request what you need.',
    background: 'linear-gradient(180deg, rgba(229, 241, 248, 0.96), rgba(255, 251, 247, 0.96))',
  },
]

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
  accountFieldset: {
    margin: 0,
    padding: 0,
    border: 0,
    display: 'grid',
    gap: '12px',
  },
  accountLegend: {
    marginBottom: '4px',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#274038',
  },
  accountGrid: {
    display: 'grid',
    gap: '12px',
  },
  accountButton: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '24px',
    border: '1px solid #e5dccd',
    padding: '18px',
    textAlign: 'left',
    font: 'inherit',
    cursor: 'pointer',
    transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
  },
  accountTick: {
    width: '24px',
    height: '24px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  accountTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: '#20352e',
  },
  accountDescription: {
    margin: '8px 0 0',
    fontSize: '0.94rem',
    lineHeight: 1.8,
    color: '#60706a',
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
  message: {
    margin: 0,
    fontSize: '0.94rem',
    fontWeight: 600,
    color: '#1d6b57',
  },
  error: {
    margin: 0,
    fontSize: '0.94rem',
    fontWeight: 600,
    color: '#b04e43',
  },
}

function AccountTypeCard({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      style={{
        ...styles.accountButton,
        background: option.background,
        borderColor: selected ? '#1d6b57' : '#e5dccd',
        boxShadow: selected ? '0 18px 45px rgba(29, 107, 87, 0.14)' : '0 12px 28px rgba(40, 51, 46, 0.06)',
        transform: selected ? 'translateY(-1px)' : 'none',
      }}
      aria-pressed={selected}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div
          style={{
            ...styles.accountTick,
            background: selected ? '#1d6b57' : '#ffffff',
            color: selected ? '#ffffff' : 'transparent',
            border: selected ? '1px solid #1d6b57' : '1px solid #cabdac',
          }}
        >
          ✓
        </div>
        <div>
          <h3 style={styles.accountTitle}>{option.title}</h3>
          <p style={styles.accountDescription}>{option.description}</p>
        </div>
      </div>
    </button>
  )
}

export default function SignupPage({ apiBase, onSuccess, onSwitchToLogin, currentUser }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    account_type: 'giver',
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
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

  function handleAccountTypeSelect(accountType) {
    setFormData((current) => ({
      ...current,
      account_type: accountType,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
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
        throw new Error(data.detail || 'Signup failed.')
      }

      setMessage('Account created successfully.')
      onSuccess(data)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Join the exchange"
      title="Choose how you want to show up for your community."
      description="Create a generous giver account or a hopeful receiver account. This first step sets the tone while keeping the rest of the auth system intact."
      formEyebrow="Sign up"
      formTitle="Create your community account"
      formDescription="Pick the role that fits you today. We keep the signup request beginner-readable and preserve the existing token login flow."
      footer={(
        <p style={{ margin: 0 }}>
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin} style={styles.footerButton}>
            Log in
          </button>
        </p>
      )}
    >
      <form style={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="signup-name" style={styles.label}>
          <span>Name</span>
          <input
            id="signup-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Jane Doe"
            autoComplete="name"
            required
            style={styles.input}
          />
        </label>

        <label htmlFor="signup-email" style={styles.label}>
          <span>Email</span>
          <input
            id="signup-email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="jane@example.com"
            autoComplete="email"
            required
            style={styles.input}
          />
        </label>

        <label htmlFor="signup-password" style={styles.label}>
          <span>Password</span>
          <input
            id="signup-password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            style={styles.input}
          />
        </label>

        <fieldset style={styles.accountFieldset}>
          <legend style={styles.accountLegend}>Account type</legend>
          <div style={styles.accountGrid}>
            {accountOptions.map((option) => (
              <AccountTypeCard
                key={option.value}
                option={option}
                selected={formData.account_type === option.value}
                onSelect={handleAccountTypeSelect}
              />
            ))}
          </div>
        </fieldset>

        <div style={styles.note}>
          Your choice is saved as part of the account record so we can shape the right experience in the next product step.
        </div>

        <button type="submit" disabled={submitting} style={submitStyle}>
          {submitting ? 'Creating account...' : 'Create account'}
        </button>

        {message ? <p style={styles.message}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
      </form>
    </AuthShell>
  )
}
