import { useEffect } from 'react'

import { Button, Surface } from '../components/ui.jsx'
import { applyPageMeta } from '../lib/usePageMeta.js'

const NOT_FOUND_META = {
  title: 'Page Not Found — HappinessExchange',
  description: 'The page you requested could not be found on Happiness Exchange.',
  robots: 'noindex, nofollow',
}

export default function NotFoundPage() {
  useEffect(() => {
    applyPageMeta(NOT_FOUND_META)
  }, [])

  return (
    <div className="app-shell flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Surface className="w-full max-w-md space-y-4 p-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">404</p>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-he-ink">
          Page not found
        </h1>
        <p className="text-sm leading-relaxed text-he-muted">
          We couldn&apos;t find that page. It may have moved or the link may be incorrect.
        </p>
        <Button as="link" to="/" className="mx-auto min-h-11">
          Back to Home
        </Button>
      </Surface>
    </div>
  )
}
