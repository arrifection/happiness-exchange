import { Link } from 'react-router-dom'

import LegalPageLayout from '../components/LegalPageLayout.jsx'
import { Button } from '../components/ui.jsx'

export default function ContactPage() {
  return (
    <LegalPageLayout
      title="Contact Us"
      subtitle="Reach the Happiness Exchange team for support, safety reports, or partnership inquiries."
    >
      <p>
        We&apos;re a small team building a trusted giving community in Pakistan and Saudi Arabia.
        For the fastest response, email us with your account email and a short description of the issue.
      </p>

      <h2>General support</h2>
      <p>
        <a href="mailto:hello@happinessexchange.pk" className="font-medium text-he-purple hover:underline">
          hello@happinessexchange.pk
        </a>
      </p>
      <p>Typical response time: 1–2 business days.</p>

      <h2>What to include</h2>
      <ul>
        <li>Your registered email address</li>
        <li>Listing or conversation ID (if relevant)</li>
        <li>Screenshots only when they help explain the issue</li>
      </ul>

      <h2>Safety &amp; abuse reports</h2>
      <p>
        If you see suspicious listings, harassment, or unsafe behavior, report it in the app when possible and email us immediately.
        For urgent safety concerns, contact local authorities first.
      </p>

      <h2>Privacy &amp; legal</h2>
      <p>
        See our <Link to="/privacy" className="font-medium text-he-purple hover:underline">Privacy Policy</Link>
        {' '}and <Link to="/terms" className="font-medium text-he-purple hover:underline">Terms of Use</Link>.
      </p>

      <div className="pt-2">
        <Button as="link" to="/browse" variant="secondary" className="h-10 px-6 text-xs">
          Browse community listings
        </Button>
      </div>
    </LegalPageLayout>
  )
}
