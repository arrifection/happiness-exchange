import { Link } from 'react-router-dom'

import { Surface } from './ui.jsx'

export default function LegalPageLayout({ title, subtitle, children }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-1 md:px-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Happiness Exchange</p>
          <h1 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold tracking-tight text-he-ink md:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-xs leading-relaxed text-he-muted md:text-sm">{subtitle}</p>
          ) : null}
        </div>
        <Link
          to="/"
          className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-he-purple transition hover:text-he-ink"
        >
          ← Home
        </Link>
      </div>

      <Surface className="space-y-5 p-5 md:p-8">
        <div className="space-y-4 text-sm leading-relaxed text-he-muted [&_h2]:font-['Plus_Jakarta_Sans',sans-serif] [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-he-ink [&_h2]:md:text-lg [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
        <p className="border-t border-he-border/60 pt-4 text-[11px] text-he-soft">
          Last updated: May 2026 · These pages are provided for transparency during our early launch in Pakistan and Saudi Arabia.
        </p>
      </Surface>

      <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-he-soft">
        <Link to="/privacy" className="transition hover:text-he-purple">Privacy</Link>
        <Link to="/terms" className="transition hover:text-he-purple">Terms</Link>
        <Link to="/contact" className="transition hover:text-he-purple">Contact</Link>
      </div>
    </div>
  )
}
