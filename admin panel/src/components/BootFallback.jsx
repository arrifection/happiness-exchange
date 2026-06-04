import { AlertCircle, RefreshCw } from 'lucide-react'
import { API_BASE_URL } from '../lib/env'

export function SessionLoadingScreen({ timedOut = false }) {
  if (timedOut) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-surface-800 mb-2">Could not connect to server</h1>
          <p className="text-sm text-surface-500 mb-2">
            Session verification is taking too long. Check the backend URL and try again.
          </p>
          <p className="text-xs text-surface-400 font-mono break-all mb-5">{API_BASE_URL}</p>
          <button type="button" className="btn-primary w-full justify-center" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="text-surface-500 text-sm">Starting admin panel…</p>
      </div>
    </div>
  )
}
