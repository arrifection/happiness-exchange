import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2, Shield } from 'lucide-react'

import { authApi } from '../lib/api'
import { APP_NAME } from '../lib/env'
import { resolveApiError } from '../lib/backend'
import { ROLE_LABELS } from '../lib/teamPermissions'

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [previewError, setPreviewError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setPreviewError('This invite link is missing a token.')
      setLoadingPreview(false)
      return
    }

    let cancelled = false
    const loadPreview = async () => {
      setLoadingPreview(true)
      setPreviewError('')
      try {
        const res = await authApi.invitePreview(token)
        if (!cancelled) setPreview(res.data)
      } catch (err) {
        if (!cancelled) setPreviewError(resolveApiError(err))
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }

    loadPreview()
    return () => { cancelled = true }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const res = await authApi.acceptInvite({ token, password })
      localStorage.setItem('admin_token', res.data.access_token)
      localStorage.setItem('admin_user', JSON.stringify(res.data.user))
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(resolveApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        <div className="card border-surface-300 shadow-card">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-soft">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-surface-800">Accept admin invite</h1>
            <p className="text-sm text-surface-500 mt-1">{APP_NAME}</p>
          </div>

          {loadingPreview ? (
            <div className="flex items-center justify-center gap-2 text-sm text-surface-500 py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking invite…
            </div>
          ) : null}

          {!loadingPreview && previewError ? (
            <div className="mb-5 flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{previewError}</span>
            </div>
          ) : null}

          {!loadingPreview && preview ? (
            <>
              <div className="mb-5 rounded-xl border border-surface-300 bg-lavender-50/60 p-4 text-sm">
                <p className="text-surface-600">You&apos;re joining as</p>
                <p className="font-semibold text-surface-800 mt-1">{preview.name}</p>
                <p className="text-surface-600 break-all">{preview.email}</p>
                <p className="mt-2">
                  <span className="badge badge-purple">{ROLE_LABELS[preview.role] || preview.role}</span>
                </p>
              </div>

              {error ? (
                <div className="mb-5 flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="form-label">Create password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="form-input pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-700 transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full justify-center py-2.5 text-base mt-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Setting up account…
                    </>
                  ) : (
                    'Accept invite & sign in'
                  )}
                </button>
              </form>
            </>
          ) : null}

          <p className="text-center text-xs text-surface-500 mt-6 border-t border-surface-300 pt-4">
            Already set up? <Link to="/login" className="text-brand-700 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
