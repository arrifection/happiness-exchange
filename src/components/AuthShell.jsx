import BrandLogo from './BrandLogo.jsx'

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
    <div className="flex min-h-screen w-full items-center justify-center bg-[#fffdfa] p-4">
      {/* Background blobs for depth */}
      <div className="fixed -left-20 -top-20 h-72 w-72 rounded-full bg-[#ffcc22]/10 blur-[80px]" />
      <div className="fixed -right-20 -bottom-20 h-72 w-72 rounded-full bg-[#8b4cf6]/8 blur-[80px]" />

      <div className="relative z-10 w-full max-w-[400px] space-y-5">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center text-center space-y-1">
          <BrandLogo size="md" showText={true} />
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#8b4cf6] mt-3">
            {eyebrow}
          </p>
        </div>

        {/* Card Form */}
        <section className="rounded-card border border-[#efe8da] bg-white p-5.5 shadow-xs">
          <header className="mb-4 text-center">
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold tracking-tight text-[#1f1f1f]">
              {formTitle}
            </h2>
            <p className="mt-1 text-[10px] leading-relaxed text-[#68766d]">
              {formDescription}
            </p>
          </header>

          <div className="flex-1">{children}</div>

          <footer className="mt-4.5 border-t border-[#fcfbf9] pt-4 text-center text-xs text-[#68766d]">
            {footer}
          </footer>
        </section>
      </div>
    </div>
  )
}
