import { useEffect, useState } from 'react'

const taglines = [
  "Give what you don't need.",
  'Help someone who does.',
  'Millions can benefit from small acts.',
  "Your unused item can become someone's blessing.",
]

const shellStyles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    background: 'linear-gradient(180deg, #fffdf8 0%, #f8f1e6 100%)',
  },
  frame: {
    width: 'min(1180px, 100%)',
    display: 'grid',
    gridTemplateColumns: '1.08fr 0.92fr',
    gap: '24px',
    position: 'relative',
  },
  ambientOrbOne: {
    position: 'absolute',
    top: '-28px',
    right: '-40px',
    width: '220px',
    height: '220px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(245, 195, 167, 0.45), transparent 68%)',
    filter: 'blur(10px)',
    pointerEvents: 'none',
  },
  ambientOrbTwo: {
    position: 'absolute',
    bottom: '-36px',
    left: '-44px',
    width: '260px',
    height: '260px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(176, 213, 195, 0.46), transparent 70%)',
    filter: 'blur(12px)',
    pointerEvents: 'none',
  },
  visualPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '36px',
    padding: '40px',
    minHeight: '720px',
    color: '#fffaf5',
    background: 'linear-gradient(155deg, #245845 0%, #2d765f 45%, #87b39d 100%)',
    boxShadow: '0 28px 80px rgba(29, 67, 53, 0.22)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  visualGlowTop: {
    position: 'absolute',
    top: '-60px',
    left: '-20px',
    width: '250px',
    height: '250px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(255, 244, 236, 0.22), transparent 68%)',
  },
  visualGlowBottom: {
    position: 'absolute',
    right: '-60px',
    bottom: '-60px',
    width: '260px',
    height: '260px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(147, 193, 174, 0.35), transparent 70%)',
  },
  floatingRingLarge: {
    position: 'absolute',
    top: '190px',
    right: '64px',
    width: '96px',
    height: '96px',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.06)',
    animation: 'auth-float 18s ease-in-out infinite',
  },
  floatingRingSmall: {
    position: 'absolute',
    right: '140px',
    bottom: '112px',
    width: '54px',
    height: '54px',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 223, 203, 0.12)',
    animation: 'auth-float 22s ease-in-out infinite reverse',
  },
  eyebrow: {
    display: 'inline-flex',
    width: 'fit-content',
    padding: '9px 14px',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.10)',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'rgba(255, 250, 245, 0.84)',
  },
  heroTitle: {
    margin: '24px 0 0',
    maxWidth: '10ch',
    fontFamily: '"Georgia", "Times New Roman", serif',
    fontSize: 'clamp(3.4rem, 7vw, 5.3rem)',
    lineHeight: 0.94,
    letterSpacing: '-0.05em',
  },
  heroDescription: {
    margin: '20px 0 0',
    maxWidth: '34rem',
    fontSize: '1rem',
    lineHeight: 1.95,
    color: 'rgba(255, 250, 245, 0.78)',
  },
  taglineShell: {
    position: 'relative',
    minHeight: '112px',
    overflow: 'hidden',
    borderRadius: '28px',
    padding: '0 28px',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(255, 255, 255, 0.10)',
    backdropFilter: 'blur(10px)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  tagline: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    padding: '0 28px',
    margin: 0,
    fontSize: 'clamp(1.15rem, 2vw, 1.55rem)',
    lineHeight: 1.7,
    color: 'rgba(255, 250, 245, 0.92)',
    transition: 'opacity 1.4s ease, transform 1.4s ease',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '16px',
    marginTop: '18px',
  },
  storyCard: {
    borderRadius: '28px',
    padding: '22px',
    background: 'rgba(255, 255, 255, 0.11)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 18px 48px rgba(22, 57, 45, 0.12)',
  },
  storyLabel: {
    margin: 0,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'rgba(255, 250, 245, 0.68)',
  },
  storyTitle: {
    margin: '14px 0 0',
    fontSize: '1.15rem',
    fontWeight: 700,
  },
  storyDescription: {
    margin: '10px 0 0',
    fontSize: '0.95rem',
    lineHeight: 1.8,
    color: 'rgba(255, 250, 245, 0.76)',
  },
  formPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '36px',
    padding: '40px',
    background: 'rgba(255, 252, 247, 0.96)',
    border: '1px solid rgba(228, 219, 205, 0.96)',
    boxShadow: '0 26px 70px rgba(57, 66, 60, 0.10)',
    display: 'flex',
    alignItems: 'center',
  },
  formGlow: {
    position: 'absolute',
    top: '-40px',
    right: '24px',
    width: '220px',
    height: '140px',
    background: 'radial-gradient(circle, rgba(245, 200, 174, 0.28), transparent 72%)',
    pointerEvents: 'none',
  },
  formInner: {
    position: 'relative',
    width: '100%',
    maxWidth: '470px',
    margin: '0 auto',
  },
  formEyebrow: {
    margin: 0,
    fontSize: '0.74rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    fontWeight: 700,
    color: '#b76744',
  },
  formTitle: {
    margin: '18px 0 0',
    fontSize: 'clamp(2rem, 3vw, 2.8rem)',
    lineHeight: 1.04,
    letterSpacing: '-0.05em',
    color: '#20352e',
  },
  formDescription: {
    margin: '14px 0 0',
    fontSize: '0.98rem',
    lineHeight: 1.85,
    color: '#66746d',
  },
  footer: {
    marginTop: '28px',
    fontSize: '0.95rem',
    lineHeight: 1.7,
    color: '#6a7771',
  },
}

const responsiveStyles = `
  @keyframes auth-float {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(0, -16px, 0); }
  }

  @media (max-width: 980px) {
    .auth-shell-frame {
      grid-template-columns: 1fr;
    }

    .auth-shell-visual,
    .auth-shell-form {
      min-height: auto;
    }
  }

  @media (max-width: 720px) {
    .auth-shell-page {
      padding: 18px 12px;
    }

    .auth-shell-visual,
    .auth-shell-form {
      padding: 24px;
      border-radius: 28px;
    }

    .auth-shell-card-grid {
      grid-template-columns: 1fr;
    }
  }
`

function TaglineRotator() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % taglines.length)
    }, 3800)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div style={shellStyles.taglineShell}>
      {taglines.map((tagline, index) => {
        const isActive = index === activeIndex

        return (
          <p
            key={tagline}
            aria-hidden={!isActive}
            style={{
              ...shellStyles.tagline,
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'translate3d(0, 0, 0)' : 'translate3d(0, 18px, 0)',
            }}
          >
            {tagline}
          </p>
        )
      })}
    </div>
  )
}

function StoryCard({ label, title, description }) {
  return (
    <div style={shellStyles.storyCard}>
      <p style={shellStyles.storyLabel}>{label}</p>
      <h3 style={shellStyles.storyTitle}>{title}</h3>
      <p style={shellStyles.storyDescription}>{description}</p>
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
    <div className="auth-shell-page" style={shellStyles.page}>
      <style>{responsiveStyles}</style>

      <div className="auth-shell-frame" style={shellStyles.frame}>
        <div style={shellStyles.ambientOrbOne} />
        <div style={shellStyles.ambientOrbTwo} />

        <section className="auth-shell-visual" style={shellStyles.visualPanel}>
          <div style={shellStyles.visualGlowTop} />
          <div style={shellStyles.visualGlowBottom} />
          <div style={shellStyles.floatingRingLarge} />
          <div style={shellStyles.floatingRingSmall} />

          <div style={{ position: 'relative' }}>
            <p style={shellStyles.eyebrow}>{eyebrow}</p>
            <h1 style={shellStyles.heroTitle}>{title}</h1>
            <p style={shellStyles.heroDescription}>{description}</p>
          </div>

          <div style={{ position: 'relative' }}>
            <TaglineRotator />

            <div className="auth-shell-card-grid" style={shellStyles.cardGrid}>
              <StoryCard
                label="People first"
                title="Pass useful things forward"
                description="A warm exchange for neighbors who want to give with dignity and receive with comfort."
              />
              <StoryCard
                label="Gentle impact"
                title="Small acts, lasting relief"
                description="Every extra chair, toy, blanket, or appliance can reach someone who truly needs it."
              />
            </div>
          </div>
        </section>

        <section className="auth-shell-form" style={shellStyles.formPanel}>
          <div style={shellStyles.formGlow} />
          <div style={shellStyles.formInner}>
            <p style={shellStyles.formEyebrow}>{formEyebrow}</p>
            <h2 style={shellStyles.formTitle}>{formTitle}</h2>
            <p style={shellStyles.formDescription}>{formDescription}</p>
            <div style={{ marginTop: '30px' }}>{children}</div>
            <div style={shellStyles.footer}>{footer}</div>
          </div>
        </section>
      </div>
    </div>
  )
}
