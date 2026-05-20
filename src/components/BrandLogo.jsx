import { useEffect, useRef } from 'react'

function classes(...values) {
  return values.filter(Boolean).join(' ')
}

// Sizes in px for the canvas icon
const SIZE_PX = { sm: 36, md: 44, lg: 108 }
const RADIUS  = { sm: 10, md: 14, lg: 26 }

function LiquidCanvas({ sizePx, animated }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = sizePx, H = sizePx
    let raf

    function easeInOutCubic(t) {
      return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2
    }

    function drawLiquid(progress) {
      ctx.clearRect(0, 0, W, H)
      const fillH = progress * H
      const fillY = H - fillH
      const waveAmp = progress < 0.95 ? (sizePx / 18) * Math.sin(progress * Math.PI) : 0

      ctx.beginPath()
      ctx.moveTo(0, fillY + waveAmp * Math.sin(0))
      for (let x = 0; x <= W; x += 1) {
        const y = fillY + waveAmp * Math.sin((x / W) * Math.PI * 4 + progress * 12)
        ctx.lineTo(x, y)
      }
      ctx.lineTo(W, H)
      ctx.lineTo(0, H)
      ctx.closePath()
      ctx.fillStyle = '#FFC430'
      ctx.fill()
    }

    if (!animated) {
      // For navbar/static use — just show solid gold instantly
      drawLiquid(1)
      return
    }

    // Animated fill
    let startTime = null
    const duration = 1700

    function animate(ts) {
      if (!startTime) startTime = ts
      const raw = Math.min((ts - startTime) / duration, 1)
      drawLiquid(easeInOutCubic(raw))
      if (raw < 1) raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [sizePx, animated])

  return (
    <canvas
      ref={canvasRef}
      width={sizePx}
      height={sizePx}
      style={{ display: 'block', width: sizePx, height: sizePx }}
    />
  )
}

export default function BrandLogo({
  showText = true,
  size = 'md',
  className = '',
  textClassName = '',
  animated = false,
}) {
  const sizePx = SIZE_PX[size] ?? 44
  const radius  = RADIUS[size]  ?? 14

  const textSizes = {
    sm: 'text-[13px]',
    md: 'text-[15px]',
    lg: 'text-[28px]',
  }

  // Dot / smile scale relative to icon size
  const faceScale = sizePx / 108

  // Delays — only apply when animated
  const dotLDelay  = animated ? '1.9s'  : '0s'
  const dotRDelay  = animated ? '2.05s' : '0s'
  const smileDelay = animated ? '2.2s'  : '0s'

  return (
    <div className={classes('flex items-center gap-3 min-w-0', className)}>

      {/* Icon */}
      <div style={{ position: 'relative', width: sizePx, height: sizePx, flexShrink: 0 }}>

        {/* Gold liquid canvas */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: sizePx, height: sizePx,
          borderRadius: radius,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(255,196,48,0.25)',
        }}>
          <LiquidCanvas sizePx={sizePx} animated={animated} />
        </div>

        {/* Pulse ring — only when animated */}
        {animated && (
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: sizePx, height: sizePx,
            borderRadius: radius,
            border: '2px solid #FFC430',
            pointerEvents: 'none',
            animation: 'he-pulseOut 0.9s ease-out 2.5s forwards',
            opacity: 0,
          }} />
        )}

        {/* Face SVG */}
        <svg
          viewBox="0 0 108 108"
          fill="none"
          style={{
            position: 'absolute', top: 0, left: 0,
            width: sizePx, height: sizePx,
            overflow: 'visible',
          }}
        >
          <circle
            cx="34" cy="34" r="7" fill="#7C5CBF"
            style={{
              opacity: animated ? 0 : 1,
              transformOrigin: '34px 34px',
              animation: animated
                ? `he-dotIn 0.3s cubic-bezier(0.34,1.56,0.64,1) ${dotLDelay} forwards`
                : 'none',
            }}
          />
          <circle
            cx="74" cy="34" r="7" fill="#7C5CBF"
            style={{
              opacity: animated ? 0 : 1,
              transformOrigin: '74px 34px',
              animation: animated
                ? `he-dotIn 0.3s cubic-bezier(0.34,1.56,0.64,1) ${dotRDelay} forwards`
                : 'none',
            }}
          />
          <path
            d="M24 64 Q54 90 84 64"
            stroke="#7C5CBF" strokeWidth="8" strokeLinecap="round" fill="none"
            style={{
              strokeDasharray: 100,
              strokeDashoffset: animated ? 100 : 0,
              animation: animated
                ? `he-drawSmile 0.65s ease ${smileDelay} forwards`
                : 'none',
            }}
          />
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <div className="hidden sm:flex flex-col">
          <span
            className={classes(
              "font-['Plus_Jakarta_Sans',sans-serif] font-bold tracking-tight text-[#7C5CBF]",
              textSizes[size],
              textClassName,
            )}
            style={{
              opacity: animated ? 0 : 1,
              transform: animated ? 'translateX(24px)' : 'none',
              animation: animated
                ? 'he-slideIn 0.55s cubic-bezier(0.22,1,0.36,1) 2.75s forwards'
                : 'none',
            }}
          >
            Happiness
          </span>
          <span
            className={classes(
              "font-['Plus_Jakarta_Sans',sans-serif] font-bold tracking-tight text-[#7C5CBF]",
              textSizes[size],
              textClassName,
            )}
            style={{
              opacity: animated ? 0 : 1,
              transform: animated ? 'translateX(24px)' : 'none',
              animation: animated
                ? 'he-slideIn 0.55s cubic-bezier(0.22,1,0.36,1) 2.95s forwards'
                : 'none',
            }}
          >
            Exchange
          </span>
        </div>
      )}
    </div>
  )
}
