import { useEffect, useState } from 'react'

import { subscribeFlash } from '../lib/flash.js'

export default function FlashBanner() {
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    let timer
    const unsubscribe = subscribeFlash(({ message, durationMs = 4500 }) => {
      setFlash(message)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setFlash(null), durationMs)
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [])

  if (!flash) {
    return null
  }

  return (
    <div
      className="sticky top-14 z-[60] border-b border-he-purple/20 bg-[#f5efff] px-4 py-2.5 text-center text-[12px] font-medium text-[#7340d2] dark:border-he-purple/30 dark:bg-[#2d2640] dark:text-[#ddd6fe]"
      role="status"
      aria-live="polite"
    >
      {flash}
    </div>
  )
}
