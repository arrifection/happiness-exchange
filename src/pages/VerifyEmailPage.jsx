import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui.jsx'
import BrandLogo from '../components/BrandLogo.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export default function VerifyEmailPage({ currentUser, onAuthSuccess }) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [redirectIn, setRedirectIn] = useState(3)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('No verification token provided.')
      return
    }

    async function verifyToken() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.detail || 'Verification failed.')
        }

        setStatus('success')

        if (currentUser && onAuthSuccess) {
          onAuthSuccess({
            user: { ...currentUser, is_verified: true },
          })
        }
      } catch (err) {
        setStatus('error')
        setError(err.message)
      }
    }

    verifyToken()
  }, [token, currentUser, onAuthSuccess])

  useEffect(() => {
    if (status !== 'success') return undefined

    setRedirectIn(3)
    const countdown = setInterval(() => {
      setRedirectIn((value) => (value > 1 ? value - 1 : value))
    }, 1000)

    const redirectTimer = setTimeout(() => {
      navigate(currentUser ? '/dashboard' : '/', { replace: true })
    }, 3000)

    return () => {
      clearInterval(countdown)
      clearTimeout(redirectTimer)
    }
  }, [status, navigate, currentUser])

  function goHome() {
    navigate(currentUser ? '/dashboard' : '/', { replace: true })
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <BrandLogo size="lg" className="mb-8 mx-auto" />

      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-[#efe8da]">
        {status === 'loading' && (
          <div className="space-y-4">
            <svg className="mx-auto h-12 w-12 animate-spin text-[#8b4cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 8v4m8-8h-4M8 12H4m13.657-5.657l-2.828 2.828M9.172 14.828l-2.829 2.829m11.314 0l-2.828-2.829M9.172 9.172 6.343 6.343" />
            </svg>
            <h2 className="text-xl font-bold text-[#1f1f1f]">Verifying your email…</h2>
            <p className="text-sm text-[#68766d]">Please wait while we confirm your link.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5efff]">
              <svg className="h-8 w-8 text-[#8b4cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1f1f1f]">Email verified!</h2>
            <p className="text-sm text-[#68766d]">
              Thank you for verifying your email. You now have full access to Happiness Exchange.
            </p>
            <p className="text-xs text-[#8c755f]">
              Redirecting in {redirectIn} second{redirectIn === 1 ? '' : 's'}…
            </p>
            <div className="pt-2">
              <Button variant="primary" className="w-full" onClick={goHome}>
                Go to Home
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff3f0]">
              <svg className="h-8 w-8 text-[#c65d4a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1f1f1f]">Verification failed</h2>
            <p className="text-sm text-[#c65d4a]">{error}</p>
            <div className="pt-4 space-y-2">
              <Button variant="primary" className="w-full" onClick={() => navigate('/check-email')}>
                Resend verification email
              </Button>
              <Button variant="secondary" className="w-full" onClick={goHome}>
                Go to Home
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
