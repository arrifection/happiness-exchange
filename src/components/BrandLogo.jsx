import BrandMarkSvg from './BrandMarkSvg.jsx'

function classes(...values) {
  return values.filter(Boolean).join(' ')
}

const MARK_WIDTH = { sm: 36, md: 44, lg: 72 }

export default function BrandLogo({
  showText = true,
  size = 'md',
  className = '',
  textClassName = '',
  animated = false,
}) {
  const markWidth = MARK_WIDTH[size] ?? 44

  const textSizes = {
    sm: 'text-[13px]',
    md: 'text-[15px]',
    lg: 'text-[28px]',
  }

  return (
    <div className={classes('flex min-w-0 items-center gap-2.5', className)}>
      <div
        className={classes(
          'shrink-0',
          animated ? 'animate-[he-logoPop_0.8s_ease-out]' : '',
        )}
      >
        <BrandMarkSvg width={markWidth} />
      </div>

      {showText ? (
        <div className="hidden min-w-0 flex-col sm:flex">
          <span
            className={classes(
              "font-['Plus_Jakarta_Sans',sans-serif] font-bold tracking-tight text-[#8C57F5] dark:text-[#c4b5fd]",
              textSizes[size],
              textClassName,
              animated ? 'animate-[he-slideIn_0.55s_ease_0.35s_both]' : '',
            )}
          >
            Happiness
          </span>
          <span
            className={classes(
              "font-['Plus_Jakarta_Sans',sans-serif] font-bold tracking-tight text-[#8C57F5] dark:text-[#c4b5fd]",
              textSizes[size],
              textClassName,
              animated ? 'animate-[he-slideIn_0.55s_ease_0.55s_both]' : '',
            )}
          >
            Exchange
          </span>
        </div>
      ) : null}
    </div>
  )
}
