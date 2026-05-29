import BrandLogo from './BrandLogo.jsx'

import './AuthShell.css'

export function AuthShell({
  eyebrow,
  formTitle,
  formDescription,
  footer,
  children,
}) {
  return (
    <div className="he-auth-shell">
      <div className="he-auth-shell-inner">
        <div className="he-auth-shell-brand">
          <BrandLogo size="md" showText={true} />
          <p className="he-auth-shell-eyebrow">{eyebrow}</p>
        </div>

        <section className="he-auth-shell-card">
          <header className="he-auth-shell-header">
            <h2 className="he-auth-shell-title">{formTitle}</h2>
            <p className="he-auth-shell-desc">{formDescription}</p>
          </header>

          <div>{children}</div>

          <footer className="he-auth-shell-footer">{footer}</footer>
        </section>
      </div>
    </div>
  )
}
