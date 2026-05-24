import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui.jsx'
import BrandLogo from '../components/BrandLogo.jsx'
import {
  formatResendCooldown,
  getResendCooldownRemainingMs,
  parseApiErrorDetail,
  setResendCooldown,
  syncResendCooldownFromSeconds,
} from '../lib/verificationResend.js'

function LoadingState() {
  return (
    <div className="space-y-4">
      <svg className="mx-auto h-12 w-12 animate-spin text-[#8b4cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 8v4m8-8h-4M8 12H4m13.657-5.657l-2.828 2.828M9.172 14.828l-2.829 2.829m11.314 0l-2.828-2.829M9.172 9.172 6.343 6.343" />
      </svg>
      <h1 className="text-xl font-bold text-he-ink">Loading…</h1>
      <p className="text-sm text-he-muted">Checking your account status.</p>
    </div>
  )
}

function VerifiedState({ redirectIn, onGoHome }) {
  return (
    <div className="space-y-5">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f0faf4]">
        <svg className="h-8 w-8 text-[#3d8b5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-he-ink">Your email is already verified</h1>
        <p className="text-sm text-he-muted">You have full access to Happiness Exchange.</p>
        {redirectIn > 0 ? (
          <p className="text-xs text-he-soft">
            Redirecting in {redirectIn} second{redirectIn === 1 ? '' : 's'}…
          </p>
        ) : null}
      </div>
      <Button variant="primary" className="w-full" onClick={onGoHome}>
        Go to Home
      </Button>
    </div>
  )
}

function SignInRequiredState({ onGoLogin }) {
  return (
    <div className="space-y-5">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5efff]">
        <svg className="h-8 w-8 text-[#8b4cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0v.75H4.5V19.5z" />
        </svg>
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-he-ink">Sign in required</h1>
        <p className="text-sm text-he-muted">Please sign in to verify your email.</p>
      </div>
      <Button variant="primary" className="w-full" onClick={onGoLogin}>
        Go to Login
      </Button>
    </div>
  )
}

export default function CheckYourEmailPage({
  apiBase,
  token,
  currentUser,
  loadingUser,
  onRefreshUser,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const email = currentUser?.email || location.state?.email || ''
  const userId = currentUser?.id || ''

  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState(
    location.state?.resendSuccess
      ? 'New verification email sent. Please check your inbox.'
      : '',
  )
  const [resendError, setResendError] = useState('')
  const [cooldownMs, setCooldownMs] = useState(() => getResendCooldownRemainingMs(userId))
  const [redirectIn, setRedirectIn] = useState(2)
  const [showWrongEmail, setShowWrongEmail] = useState(false)

  useEffect(() => {
    if (location.state?.resendSuccess) {
      navigate(location.pathname, { replace: true, state: { email } })
    }
  }, [location.pathname, location.state?.resendSuccess, email, navigate])

  useEffect(() => {
    if (location.state?.resendSuccess && userId) {
      setResendCooldown(userId)
      setCooldownMs(getResendCooldownRemainingMs(userId))
    }
  }, [location.state?.resendSuccess, userId])

  useEffect(() => {
    if (!userId) return undefined
    setCooldownMs(getResendCooldownRemainingMs(userId))
    const timer = setInterval(() => {
      setCooldownMs(getResendCooldownRemainingMs(userId))
    }, 1000)
    return () => clearInterval(timer)
  }, [userId])

  useEffect(() => {
    if (!currentUser?.is_verified) return undefined
    setRedirectIn(2)
    const countdown = setInterval(() => {
      setRedirectIn((value) => (value > 1 ? value - 1 : value))
    }, 1000)
    const redirectTimer = setTimeout(() => navigate('/', { replace: true }), 2000)
    return () => {
      clearInterval(countdown)
      clearTimeout(redirectTimer)
    }
  }, [currentUser?.is_verified, navigate])

  function goHome() {
    navigate('/', { replace: true })
  }

  function goLogin() {
    navigate('/login', { replace: true })
  }

  async function handleResend() {
    if (!token) {
      setResendError('Please sign in again to resend the verification email.')
      return
    }

    const remaining = getResendCooldownRemainingMs(userId)
    if (remaining > 0) {
      setResendError(`You can request another email in ${formatResendCooldown(remaining)}.`)
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

      if (response.ok && data.status === 'already_verified') {
        if (onRefreshUser) await onRefreshUser()
        return
      }

      if (!response.ok) {
        const { message, retryAfterSeconds } = parseApiErrorDetail(
          data,
          'Could not send verification email.',
        )
        if (response.status === 429 && userId) {
          syncResendCooldownFromSeconds(userId, retryAfterSeconds || 600)
          setCooldownMs(getResendCooldownRemainingMs(userId))
        }
        throw new Error(message)
      }

      if (userId) {
        setResendCooldown(userId)
        setCooldownMs(getResendCooldownRemainingMs(userId))
      }
      setResendMessage('New verification email sent. Please check your inbox.')
    } catch (err) {
      setResendError(err.message)
    } finally {
      setResending(false)
    }
  }

  const resendDisabled = resending || cooldownMs > 0

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <BrandLogo size="lg" className="mb-8 mx-auto" />

      <div className="w-full max-w-md rounded-2xl border border-he-border bg-he-surface p-8 shadow-sm dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]">
        {loadingUser ? (
          <LoadingState />
        ) : !token ? (
          <SignInRequiredState onGoLogin={goLogin} />
        ) : currentUser?.is_verified ? (
          <VerifiedState redirectIn={redirectIn} onGoHome={goHome} />
        ) : !currentUser ? (
          <SignInRequiredState onGoLogin={goLogin} />
        ) : (
          <div className="space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5efff]">
              <svg className="h-8 w-8 text-[#8b4cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-he-ink">Check your email</h1>
              <p className="text-sm text-he-muted">
                We sent a verification link to{' '}
                <span className="font-semibold text-he-ink">{email}</span>.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-he-border bg-he-input p-4 text-left text-sm text-he-muted">
              <p className="font-semibold text-he-ink">What to do next</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open the email from Happiness Exchange.</li>
                <li>Click <strong>Verify Email</strong> in the message.</li>
                <li>Return here after verification to browse and give items.</li>
              </ol>
              <p className="text-xs pt-1 text-he-soft">
                Check your spam or promotions folder if you do not see it.
                Each link expires after 24 hours — use only the most recent email.
              </p>
            </div>

            {resendMessage ? (
              <div className="rounded-xl border border-he-purple/30 bg-[#f5efff] px-4 py-3 text-sm font-medium text-he-purple dark:bg-[#2d2640] dark:text-[#ddd6fe]">
                {resendMessage}
              </div>
            ) : null}
            {resendError ? (
              <div className="rounded-xl border border-he-danger/30 bg-[#fff3f0] px-4 py-3 text-sm font-medium text-he-danger dark:bg-rose-950/40">
                {resendError}
              </div>
            ) : null}

            <Button
              variant="primary"
              className="w-full"
              disabled={resendDisabled}
              onClick={handleResend}
            >
              {resending
                ? 'Sending…'
                : cooldownMs > 0
                  ? `You can request another email in ${formatResendCooldown(cooldownMs)}`
                  : 'Resend verification email'}
            </Button>

            {!showWrongEmail ? (
              <button
                type="button"
                className="text-xs text-he-soft hover:text-[#8b4cf6] hover:underline"
                onClick={() => setShowWrongEmail(true)}
              >
                Wrong email?
              </button>
            ) : (
              <p className="text-xs text-he-muted">
                Sign in with the correct account on the{' '}
                <button type="button" className="font-bold text-[#8b4cf6] hover:underline" onClick={goLogin}>
                  login page
                </button>
                .
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
