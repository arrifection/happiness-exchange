import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'

export function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
        <p className="text-sm text-surface-500">{message}</p>
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 ring-1 ring-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <p className="text-surface-800 font-medium">Something went wrong</p>
          <p className="text-surface-500 text-sm mt-1">{message || 'Unable to load data.'}</p>
        </div>
        {onRetry && (
          <button className="btn-secondary" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ title = 'No data', description, icon: Icon }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm">
        {Icon && (
          <div className="w-12 h-12 rounded-full bg-surface-100 border border-surface-300 flex items-center justify-center">
            <Icon className="w-5 h-5 text-surface-500" />
          </div>
        )}
        <p className="text-surface-700 font-medium">{title}</p>
        {description && <p className="text-surface-500 text-sm">{description}</p>}
      </div>
    </div>
  )
}
