import { Component } from 'react'
import { Button, Surface } from './ui.jsx'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' }
  }

  componentDidCatch(error, info) {
    console.error('App render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#fffaf0] p-6">
          <Surface className="w-full max-w-md space-y-4 p-8 text-center">
            <h1 className="text-xl font-bold text-[#1f1f1f]">Something went wrong</h1>
            <p className="text-sm text-[#68766d]">
              The page could not load. Please refresh or clear your session and try again.
            </p>
            {this.state.errorMessage ? (
              <p className="rounded-lg bg-[#faf7f1] px-3 py-2 text-left text-xs text-[#8c755f] break-words">
                {this.state.errorMessage}
              </p>
            ) : null}
            <Button variant="primary" className="w-full" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                localStorage.removeItem('happiness_exchange_token')
                window.location.href = '/'
              }}
            >
              Clear session &amp; go home
            </Button>
          </Surface>
        </div>
      )
    }

    return this.props.children
  }
}
