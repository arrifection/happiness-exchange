import { useState } from 'react'

export default function SignupPage({ apiBase, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Signup</h2>

      <label htmlFor="signup-name">
        Name
        <input
          id="signup-name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Jane Doe"
          required
        />
      </label>

      <label htmlFor="signup-email">
        Email
        <input
          id="signup-email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="jane@example.com"
          required
        />
      </label>

      <label htmlFor="signup-password">
        Password
        <input
          id="signup-password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="At least 8 characters"
          required
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating account...' : 'Create account'}
      </button>

      {message && <p className="message">{message}</p>}
      {error && <p className="message error">{error}</p>}
    </form>
  )
}
