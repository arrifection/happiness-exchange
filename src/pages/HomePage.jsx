import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import './HomePage.css'

const phoneItems = [
  {
    name: 'Kids winter jacket - age 6',
    location: 'Gulshan, Karachi · 1.2 km',
    icon: '👔',
    tint: '#FFF3CD',
  },
  {
    name: 'Class 7 textbook set',
    location: 'Johar Town, Lahore · 2.8 km',
    icon: '📚',
    tint: '#E8F4FD',
  },
  {
    name: 'Samsung Galaxy A32',
    location: 'F-10, Islamabad · 3.5 km',
    icon: '📱',
    tint: '#F0FDF4',
  },
]

const giveSteps = [
  'Photograph your item - clothes, books, electronics, kitchenware, toys. Takes under 2 minutes.',
  'Set your pickup zone - area-level only. Your home address is never shared with anyone.',
  'Accept a request - when someone nearby requests your item, confirm in the app. A courier collects from you.',
  'Earn Happiness Points - climb the city leaderboard. The recipient never knows who gave it.',
]

const getSteps = [
  'Browse your city - filter by category, distance, and item type. Every item is completely free.',
  'Request the item - pay only the delivery fee (PKR 150-300) via JazzCash or EasyPaisa.',
  'Set your drop zone - a nearby public area, not your home. Full privacy guaranteed throughout.',
  'Receive your item - the donor never learns your name. Dignity is built into every single delivery.',
]

const anonymousPills = [
  'Zone-level pickup - no home address ever shared',
  'All packages sealed and QR-coded only',
  'CNIC-verified accounts for trust and safety',
  'OTP confirmation at pickup and delivery',
]

const deliveryCards = [
  {
    className: 'courier',
    icon: '📦',
    title: 'Professional Courier',
    body: 'TCS, Leopards, and M&P collect from the donor and deliver to the recipient. Fast, reliable, tracked, nationwide - 200+ cities covered.',
    features: [
      'PKR 150-300 flat delivery fee',
      'JazzCash & EasyPaisa accepted',
      'Real-time in-app tracking',
      '200+ cities covered nationwide',
    ],
  },
  {
    className: 'carrier',
    icon: '🚗',
    title: 'Happy Carriers',
    body: 'Verified community volunteers already travelling your direction carry the item along their route - at zero delivery cost to the recipient.',
    features: [
      'Completely free for the recipient',
      'AI-matched by route and timing',
      'Public handoff points only',
      'Carriers earn 2x Happiness Points',
    ],
  },
]

const impactStats = [
  ['30,000+', 'Items saved from landfill in Year 1'],
  ['8,000+', 'Families directly benefited'],
  ['500+', 'Active Happy Carriers across Pakistan'],
  ['PKR 45M+', 'Value of goods redistributed to those in need'],
]

const cityPills = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', '+ coming everywhere']

function SmileGlyph({ className = '', stroke = '#8C57F5', dot = '#8C57F5', square = '#F9C826', endDot = dot }) {
  return (
    <svg className={className} viewBox="0 0 74 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="16.5" r="6.2" fill={dot} />
      <rect x="24" y="5" width="35" height="43" rx="11" fill={square} />
      <circle cx="38" cy="16.5" r="5.3" fill={dot} />
      <circle cx="46.5" cy="34.5" r="5.2" fill={endDot} />
      <path
        d="M6 27.5C6 41 15.5 50 29.5 50C40.5 50 48 44.5 48 35"
        stroke={stroke}
        strokeWidth="5.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BrandMark() {
  return <SmileGlyph className="he-nav-logo-img" />
}

function AppMark() {
  return <SmileGlyph className="he-app-mark" />
}

function OrbMark() {
  return <SmileGlyph className="he-orb-mark" stroke="#FFFFFF" dot="#FFFFFF" endDot="#FFFFFF" />
}

function FooterMark() {
  return <SmileGlyph className="he-footer-mark" />
}

function SearchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="3.5" stroke="#9CA3AF" strokeWidth="1.2" />
      <path d="M8 8l2 2" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function StepText({ text }) {
  const [strongText, rest] = text.split(' - ')
  return (
    <span className="he-step-text">
      <strong>{strongText}</strong>
      {' - '}
      {rest}
    </span>
  )
}

export default function HomePage({ currentUser }) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navCtaTo = currentUser ? '/browse' : '/login'
  const navCtaLabel = currentUser ? 'Open App' : 'Login'
  const giveRoute = currentUser ? '/give' : '/signup'
  const getRoute = currentUser ? '/browse' : '/login'

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!location.hash) {
      return
    }

    const id = location.hash.slice(1)
    const target = document.getElementById(id)

    if (target) {
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [location.hash])

  return (
    <div className="he-home">
      <nav className="he-nav">
        <Link to="/" className="he-nav-logo" onClick={() => setMobileMenuOpen(false)}>
          <BrandMark />
          <span className="he-nav-brand">Happiness Exchange</span>
        </Link>

        <div className="he-nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#give">Give Happiness</a>
          <a href="#get">Get Happiness</a>
          <a href="#impact">Impact</a>
        </div>

        <Link to={navCtaTo} className="he-nav-cta">
          {navCtaLabel}
        </Link>

        <button
          type="button"
          className={`he-nav-mobile-toggle ${mobileMenuOpen ? 'active' : ''}`}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className={`he-nav-mobile-menu ${mobileMenuOpen ? 'active' : ''}`}>
        <a href="#how-it-works">How it works</a>
        <a href="#give">Give Happiness</a>
        <a href="#get">Get Happiness</a>
        <a href="#impact">Impact</a>
        <Link to={navCtaTo} className="he-nav-mobile-cta">
          {navCtaLabel}
        </Link>
      </div>

      <section className="he-hero">
        <div className="he-hero-left">
          <span className="he-hero-eyebrow">
            <span className="he-eyebrow-dot" />
            NOW LIVE IN PAKISTAN
          </span>
          <h1>
            Give your <span className="yellow">extra.</span>
            <br />
            Someone gets
            <br />
            their <span className="purple">happy.</span>
          </h1>
          <p className="he-hero-desc">
            Have something you no longer use? List it. Someone nearby needs it. We connect you - anonymously,
            effortlessly, with happiness on both sides.
          </p>

          <div className="he-action-cards">
            <Link to={giveRoute} className="he-action-card give">
              <div className="he-ac-icon">🎁</div>
              <div className="he-ac-label">GIVE HAPPINESS</div>
              <div className="he-ac-title">
                List an
                <br />
                extra item
              </div>
              <div className="he-ac-desc">
                That jacket, book or gadget you&apos;re not using - list it in 2 minutes and make someone&apos;s day.
              </div>
              <span className="he-ac-btn">List an item →</span>
            </Link>

            <Link to={getRoute} className="he-action-card get">
              <div className="he-ac-icon">🌟</div>
              <div className="he-ac-label">GET HAPPINESS</div>
              <div className="he-ac-title">
                Request a
                <br />
                listed item
              </div>
              <div className="he-ac-desc">
                Browse what people are giving away near you. Request it - delivered anonymously to your zone.
              </div>
              <span className="he-ac-btn">Browse items →</span>
            </Link>
          </div>

        </div>

        <div className="he-hero-right">
          <div className="he-phone">
            <div className="he-phone-notch" />
            <div className="he-phone-screen">
              <div className="he-app-header">
                <div className="he-app-logo-row">
                  <AppMark />
                  <span>Happiness Exchange</span>
                </div>
                <div className="he-app-pts">⭐ 142 pts</div>
              </div>

              <div className="he-app-toggle">
                <div className="he-app-toggle-btn active">Give Happiness</div>
                <div className="he-app-toggle-btn inactive">Get Happiness</div>
              </div>

              <div className="he-app-search">
                <SearchIcon />
                Browse items near you...
              </div>

              {phoneItems.map((item) => (
                <div key={item.name} className="he-item-card">
                  <div className="he-item-thumb" style={{ background: item.tint }}>
                    {item.icon}
                  </div>
                  <div className="he-item-info">
                    <div className="he-item-name">{item.name}</div>
                    <div className="he-item-loc">{item.location}</div>
                  </div>
                  <div className="he-item-tag">FREE</div>
                </div>
              ))}

              <div className="he-app-list-btn">
                <span>+ List your item - takes only 2 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="he-concept" id="how-it-works">
        <div className="he-section-header">
          <div className="he-sec-label">The Concept</div>
          <h2>Two sides of the same smile</h2>
          <p>Whether you give or receive - everyone leaves with happiness. That&apos;s the exchange.</p>
        </div>

        <div className="he-concept-wrap">
          <div className="he-concept-col give-col" id="give">
            <div className="he-col-icon-big">🎁</div>
            <h3>Give Happiness</h3>
            <p className="he-col-sub">
              List an item you no longer need. Someone who needs it will request it. You give - anonymously,
              effortlessly, and with a clean conscience.
            </p>
            <div className="he-steps">
              {giveSteps.map((step, index) => (
                <div key={step} className="he-step-row">
                  <div className="he-step-num">{index + 1}</div>
                  <StepText text={step} />
                </div>
              ))}
            </div>
            <Link to={giveRoute} className="he-col-cta">
              List your first item →
            </Link>
          </div>

          <div className="he-concept-divider">
            <div className="he-div-line" />
            <div className="he-div-orb">
              <OrbMark />
            </div>
            <div className="he-div-line" />
          </div>

          <div className="he-concept-col get-col" id="get">
            <div className="he-col-icon-big">🌟</div>
            <h3>Get Happiness</h3>
            <p className="he-col-sub">
              Browse items listed near you. Request what you need. It reaches you through a courier - and the giver
              never knows who you are.
            </p>
            <div className="he-steps">
              {getSteps.map((step, index) => (
                <div key={step} className="he-step-row">
                  <div className="he-step-num">{index + 1}</div>
                  <StepText text={step} />
                </div>
              ))}
            </div>
            <Link to={getRoute} className="he-col-cta">
              Browse items near you →
            </Link>
          </div>
        </div>
      </section>

      <section className="he-anon-section">
        <div className="he-anon-left">
          <h3>
            Complete anonymity.
            <br />
            <em>Built into everything.</em>
          </h3>
          <p>
            Neither giver nor receiver ever learns the other&apos;s identity. No names. No addresses. No face-to-face.
            The courier is the invisible bridge - and that&apos;s exactly how it should be.
          </p>
        </div>

        <div className="he-anon-right">
          {anonymousPills.map((pill) => (
            <div key={pill} className="he-anon-pill">
              <div className="he-ap-dot" />
              <span>{pill}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="he-delivery-section">
        <div className="he-sec-label">How items move</div>
        <h2>Delivered two ways</h2>
        <p className="he-sub">
          Professional couriers nationwide - or community volunteers already heading your way. Either way, you and the
          other person never meet.
        </p>

        <div className="he-delivery-grid">
          {deliveryCards.map((card) => (
            <div key={card.title} className={`he-del-card ${card.className}`}>
              <div className="he-del-icon">{card.icon}</div>
              <h4>{card.title}</h4>
              <p>{card.body}</p>
              <div className="he-del-features">
                {card.features.map((feature) => (
                  <div key={feature} className="he-df">
                    <div className="he-df-dot" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="he-impact-section" id="impact">
        <div className="he-sec-label">Our impact</div>
        <h2>Real change, real numbers</h2>
        <p className="he-sub">
          Every item listed creates ripples. Here&apos;s what the Happiness Exchange community is building together.
        </p>

        <div className="he-impact-grid">
          {impactStats.map(([number, label]) => (
            <div key={number} className="he-impact-card">
              <div className="he-impact-num">{number}</div>
              <div className="he-impact-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="he-cta-section">
        <h2>
          Ready to spread
          <br />
          <em>some happiness?</em>
        </h2>
        <p>
          List an item you don&apos;t need. Or request one you do.
          <br />
          Either way - someone smiles today.
        </p>

        <div className="he-cta-buttons">
          <Link to={giveRoute} className="he-cta-give">
            🎁 Give Happiness - List an Item
          </Link>
          <Link to={getRoute} className="he-cta-get">
            🌟 Get Happiness - Browse Items
          </Link>
        </div>

        <div className="he-cta-cities">
          {cityPills.map((city) => (
            <span key={city} className="he-city-pill">
              {city}
            </span>
          ))}
        </div>
      </section>

      <footer className="he-footer">
        <div className="he-footer-logo">
          <FooterMark />
          <span>Happiness Exchange</span>
        </div>

        <div className="he-footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Use</Link>
          <Link to="/contact">Contact Us</Link>
          <a href="mailto:hello@happinessexchange.pk">hello@happinessexchange.pk</a>
        </div>

        <div className="he-footer-trust" />

        <span className="he-footer-copy">© 2025 Happiness Exchange Pakistan. All rights reserved.</span>
      </footer>
    </div>
  )
}
