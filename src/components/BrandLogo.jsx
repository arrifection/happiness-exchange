import { useState } from 'react'

import happinessLogo from '../assets/happiness-logo.jpeg'

function classes(...values) {
  return values.filter(Boolean).join(' ')
}

export default function BrandLogo({
  showText = true,
  size = 'md',
  className = '',
  textClassName = '',
}) {
  const [imageFailed, setImageFailed] = useState(false)

  const sizeClasses = {
    sm: 'h-9 w-9 rounded-xl',
    md: 'h-11 w-11 rounded-2xl',
    lg: 'h-16 w-16 rounded-[1.5rem]',
  }

  const textSizes = {
    sm: 'text-[14px]',
    md: 'text-[16px]',
    lg: 'text-[28px]',
  }

  return (
    <div className={classes('flex items-center gap-3 min-w-0', className)}>
      {imageFailed ? (
        <div
          className={classes(
            "flex shrink-0 items-center justify-center bg-[#8b4cf6] font-['Plus_Jakarta_Sans',sans-serif] font-bold text-white shadow-[0_10px_30px_rgba(139,76,246,0.22)]",
            sizeClasses[size],
          )}
          aria-label="Happiness Exchange"
        >
          HE
        </div>
      ) : (
        <img
          src={happinessLogo}
          alt="Happiness Exchange"
          className={classes(
            'shrink-0 object-cover shadow-[0_10px_30px_rgba(139,76,246,0.12)]',
            sizeClasses[size],
          )}
          onError={() => setImageFailed(true)}
        />
      )}

      {showText ? (
        <span
          className={classes(
            "truncate font-['Plus_Jakarta_Sans',sans-serif] font-bold tracking-tight text-[#1f1f1f]",
            textSizes[size],
            textClassName,
          )}
        >
          Happiness Exchange
        </span>
      ) : null}
    </div>
  )
}
