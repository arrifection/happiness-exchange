import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Admin panel] Uncaught render error:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full text-center shadow-card">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-surface-800 mb-2">Something went wrong</h1>
            <p className="text-sm text-surface-500 mb-4">
              The admin panel hit an unexpected error. You can reload the page to try again.
            </p>
            <pre className="text-left text-xs bg-surface-100 border border-surface-300 rounded-lg p-3 mb-5 overflow-x-auto text-red-700 whitespace-pre-wrap break-words">
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button type="button" className="btn-primary w-full justify-center" onClick={this.handleReload}>
              <RefreshCw className="w-4 h-4" />
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
