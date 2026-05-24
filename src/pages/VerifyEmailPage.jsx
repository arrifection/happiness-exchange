import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui.jsx'
import BrandLogo from '../components/BrandLogo.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const TOKEN_KEY = 'happiness_exchange_token'
const REDIRECT_SECONDS = 2

function isCompleteStatus(status) {
  return status === 'success' || status === 'already_verified'
}

export default function VerifyEmailPage({ onRefreshUser }) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [redirectIn, setRedirectIn] = useState(REDIRECT_SECONDS)
  const [readyToRedirect, setReadyToRedirect] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('This verification link is invalid or expired.')
      return undefined
    }

    let cancelled = false

    async function verifyToken() {
      try {
        const authToken = localStorage.getItem(TOKEN_KEY)
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {}
        const response = await fetch(
          `${API_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
          { headers },
        )
        const data = await response.json()

        if (cancelled) return

        if (!response.ok) {
          setStatus('error')
          setMessage(data.detail || 'This verification link is invalid or expired.')
          return
        }

        if (onRefreshUser) {
          await onRefreshUser()
        }

        if (cancelled) return

        if (data.status === 'already_verified') {
          setStatus('already_verified')
          setMessage(data.message || 'Your email is already verified.')
        } else {
          setStatus('success')
          setMessage(data.message || 'Email verified successfully.')
        }
        setReadyToRedirect(true)
      } catch {
        if (!cancelled) {
          setStatus('error')
          setMessage('Could not reach the server. Please try again.')
        }
      }
    }

    verifyToken()
    return () => {
      cancelled = true
    }
  }, [token, onRefreshUser])

  useEffect(() => {
    if (!readyToRedirect || !isCompleteStatus(status)) return undefined

    setRedirectIn(REDIRECT_SECONDS)
    const countdown = setInterval(() => {
      setRedirectIn((value) => (value > 1 ? value - 1 : value))
    }, 1000)

    const redirectTimer = setTimeout(() => {
      navigate('/', { replace: true })
    }, REDIRECT_SECONDS * 1000)

    return () => {
      clearInterval(countdown)
      clearTimeout(redirectTimer)
    }
  }, [readyToRedirect, status, navigate])

  function goHome() {
    navigate('/', { replace: true })
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
            <h2 className="text-xl font-bold text-[#1f1f1f]">Email verified successfully</h2>
            <p className="text-sm text-[#68766d]">{message}</p>
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

        {status === 'already_verified' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f0faf4]">
              <svg className="h-8 w-8 text-[#3d8b5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1f1f1f]">Your email is already verified</h2>
            <p className="text-sm text-[#68766d]">You are all set. No further action is needed.</p>
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
            <h2 className="text-xl font-bold text-[#1f1f1f]">Verification link unavailable</h2>
            <p className="text-sm text-[#c65d4a]">{message}</p>
            <div className="pt-4 space-y-2">
              <Button variant="primary" className="w-full" onClick={() => navigate('/check-email')}>
                Request new verification email
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
