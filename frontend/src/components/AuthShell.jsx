import { useEffect, useState } from 'react'

import BrandLogo from './BrandLogo.jsx'

const taglines = [
  "Give what you don't need.",
  'Help someone who does.',
  'Millions can benefit from small acts.',
  "Your unused item can become someone's blessing.",
]

function TaglineRotator() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % taglines.length)
    }, 3600)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="relative min-h-12 overflow-hidden rounded-2xl border border-[#f1e2b8] bg-[#fffdf7] px-4 py-3">
      {taglines.map((tagline, index) => {
        const isActive = index === activeIndex

        return (
          <p
            key={tagline}
            aria-hidden={!isActive}
            className="absolute inset-0 flex items-center px-4 text-sm text-[#68766d] transition duration-700"
            style={{
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            {tagline}
          </p>
        )
      })}
    </div>
  )
}

export function AuthShell({
  eyebrow,
  title,
  description,
  formEyebrow,
  formTitle,
  formDescription,
  footer,
  children,
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#fffaf0] p-4 sm:p-8">
      {/* Background blobs for depth */}
      <div className="fixed -left-20 -top-20 h-96 w-96 rounded-full bg-[#ffcc22]/18 blur-[100px]" />
      <div className="fixed -right-20 -bottom-20 h-96 w-96 rounded-full bg-[#8b4cf6]/12 blur-[100px]" />

      <div className="relative z-10 grid w-full max-w-[960px] gap-8 lg:grid-cols-2 lg:items-center">
        {/* Left side: Branding and Tagline */}
        <div className="flex flex-col justify-center space-y-6">
          <BrandLogo size="sm" />

          <div>
            <div className="inline-flex items-center rounded-full bg-[#fff1b8] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#8b4cf6]">
              {eyebrow}
            </div>
            <h1 className="mt-4 font-['Plus_Jakarta_Sans',sans-serif] text-4xl font-bold tracking-tight text-[#1f1f1f] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[#68766d]">
              {description}
            </p>
          </div>

          <div className="w-full max-w-sm">
            <TaglineRotator />
          </div>
        </div>

        {/* Right side: Form Card */}
        <div className="relative">
          <section className="relative flex flex-col rounded-[2.5rem] border border-[#f1e2b8] bg-white p-8 shadow-2xl shadow-[#8b4cf6]/8 sm:p-10">
            <header className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22]">
                {formEyebrow}
              </p>
              <h2 className="mt-2 font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-tight text-[#1f1f1f]">
                {formTitle}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#68766d]">
                {formDescription}
              </p>
            </header>

            <div className="flex-1">{children}</div>

            <footer className="mt-8 border-t border-[#f8edd0] pt-6 text-center text-[13px] text-[#68766d]">
              {footer}
            </footer>
          </section>
        </div>
      </div>
    </div>
  )
}
