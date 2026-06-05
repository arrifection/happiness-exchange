import { Link } from 'react-router-dom'

import LegalPageLayout from '../components/LegalPageLayout.jsx'

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How Happiness Exchange collects, uses, and protects your information."
    >
      <p>
        Happiness Exchange (&quot;we&quot;, &quot;us&quot;) is a community platform for giving and receiving items
        in Pakistan and Saudi Arabia. We respect your privacy and only collect information needed to operate the service safely.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account details such as name, email address, and password (stored securely).</li>
        <li>Listing content you choose to publish, including photos, descriptions, and general pickup location (city/area level).</li>
        <li>Messages and requests exchanged through the platform after verification.</li>
        <li>Delivery details when you arrange a handoff. Exact addresses are kept private and are only shared with authorized couriers when needed.</li>
        <li>Basic technical data such as device/browser type and usage logs for security and reliability.</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To create and manage your account, verify your email, and prevent abuse.</li>
        <li>To display listings, match requests, coordinate approved exchanges via WhatsApp (admin-only), and support delivery coordination.</li>
        <li>To calculate trust scores, reviews, and community reputation features.</li>
        <li>To send service emails such as verification links and important account notices.</li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your personal data to advertisers.</li>
        <li>We do not publish your home address on public item listings.</li>
        <li>We do not share private delivery addresses with other users outside the approved delivery flow.</li>
      </ul>

      <h2>Data retention &amp; security</h2>
      <p>
        We retain account and activity data while your account is active and as needed for legal, safety, and operational purposes.
        We use industry-standard hosting, encrypted connections (HTTPS), and access controls. No online service can guarantee absolute security,
        but we work to protect data responsibly.
      </p>

      <h2>Your choices</h2>
      <p>
        You may update profile information in the app, request account deletion from your profile settings, and contact us with privacy questions.
        Verified email is required for listing, requesting, and messaging features.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions: <a href="mailto:hello@happinessexchange.pk" className="font-medium text-he-purple hover:underline">hello@happinessexchange.pk</a>
        {' '}or visit our <Link to="/contact" className="font-medium text-he-purple hover:underline">Contact page</Link>.
      </p>
    </LegalPageLayout>
  )
}
