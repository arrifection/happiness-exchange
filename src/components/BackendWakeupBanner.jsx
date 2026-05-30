import { useEffect, useState } from 'react'

import {
  SERVER_STARTING_DETAIL,
  SERVER_STARTING_MESSAGE,
} from '../lib/bootstrapFetch.js'
import { dismissBackendWakeup, subscribeBackendWakeup } from '../lib/backendWakeup.js'

export default function BackendWakeupBanner() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return subscribeBackendWakeup((nextVisible) => {
      setVisible(nextVisible)
      if (nextVisible) {
        setDismissed(false)
      }
    })
  }, [])

  if (!visible || dismissed) {
    return null
  }

  return (
    <div
      className="sticky top-14 z-[55] border-b border-[#8b4cf6]/20 bg-[#f8f4ff] px-4 py-3 dark:border-he-purple/30 dark:bg-[#221c33]"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <span
          className="mt-1 inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#8b4cf6]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-he-ink dark:text-[#ede9ff]">
            {SERVER_STARTING_MESSAGE}
          </p>
          <p className="mt-0.5 text-xs text-he-muted">
            {SERVER_STARTING_DETAIL} You can keep browsing while we connect.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-semibold text-he-purple hover:underline"
          onClick={() => {
            setDismissed(true)
            dismissBackendWakeup()
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
