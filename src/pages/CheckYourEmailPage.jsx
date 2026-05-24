import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '../components/ui.jsx'
import BrandLogo from '../components/BrandLogo.jsx'

function formatApiError(errorData, fallbackMessage) {
  return typeof errorData?.detail === 'string' ? errorData.detail : fallbackMessage
}

export default function CheckYourEmailPage({ apiBase, token, currentUser }) {
  const location = useLocation()
  const email = location.state?.email || currentUser?.email || ''
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')

  if (!token && !email) {
    return <Navigate to="/signup" replace />
  }

  async function handleResend() {
    if (!token) {
      setResendError('Sign in again to resend the verification email.')
      return
    }

    setResending(true)
    setResendMessage('')
    setResendError('')

    try {
      const response = await fetch(`${apiBase}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(formatApiError(data, 'Could not send verification email.'))
      }

      setResendMessage('Verification email sent. Check your inbox and spam folder.')
    } catch (err) {
      setResendError(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <BrandLogo size="lg" className="mb-8 mx-auto" />

      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-[#efe8da] space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5efff]">
          <svg className="h-8 w-8 text-[#8b4cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-[#1f1f1f]">Check your email</h1>
          <p className="text-sm text-[#68766d]">
            We sent a verification link to{' '}
            <span className="font-semibold text-[#1f1f1f]">{email || 'your email address'}</span>.
          </p>
        </div>

        <div className="rounded-xl border border-[#efe8da] bg-[#fffdfb] p-4 text-left text-sm text-[#68766d] space-y-2">
          <p className="font-semibold text-[#1f1f1f]">What to do next</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open the email from Happiness Exchange.</li>
            <li>Click <strong>Verify Email</strong> in the message.</li>
            <li>Return here after verification to browse and give items.</li>
          </ol>
          <p className="text-xs pt-1">
            Did not see it? Check your spam or promotions folder. Links expire after 24 hours.
          </p>
        </div>

        <Button
          variant="primary"
          className="w-full"
          disabled={resending}
          onClick={handleResend}
        >
          {resending ? 'Sending…' : 'Resend verification email'}
        </Button>

        {resendMessage ? (
          <p className="text-xs font-medium text-[#8b4cf6]">{resendMessage}</p>
        ) : null}
        {resendError ? (
          <p className="text-xs font-medium text-[#c65d4a]">{resendError}</p>
        ) : null}

        <div className="pt-2 space-y-2 text-xs text-[#68766d]">
          <p>
            Wrong email?{' '}
            <Link className="font-bold text-[#8b4cf6] hover:underline" to="/login">
              Sign in with a different account
            </Link>
          </p>
          <p>
            <Link className="font-bold text-[#8b4cf6] hover:underline" to="/">
              Continue to homepage
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
