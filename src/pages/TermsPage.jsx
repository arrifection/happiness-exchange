import LegalPageLayout from '../components/LegalPageLayout.jsx'

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Use"
      subtitle="Rules for using Happiness Exchange safely and respectfully."
    >
      <p>
        By creating an account or using Happiness Exchange, you agree to these Terms. If you do not agree, please do not use the platform.
      </p>

      <h2>Community purpose</h2>
      <p>
        Happiness Exchange connects people who want to give usable items to others who need them. Items listed are expected to be free gifts,
        offered in good faith, and described honestly.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Provide accurate listing details, including item condition, category, and general location.</li>
        <li>Only list items you are legally allowed to give away.</li>
        <li>Respond respectfully to requests and messages.</li>
        <li>Meet pickup or delivery arrangements you commit to, or update the other party promptly if plans change.</li>
        <li>Do not use the platform for scams, harassment, hate speech, illegal goods, or spam.</li>
      </ul>

      <h2>Food &amp; safety items</h2>
      <p>
        Food listings must follow applicable safety guidance. Share only sealed, safe, non-expired food when permitted by local rules.
        Users are responsible for checking suitability before accepting any item, especially food, electronics, or children&apos;s products.
      </p>

      <h2>Trust, reviews &amp; moderation</h2>
      <p>
        We may use trust scores, reviews, reports, and admin moderation to keep the community safe. We may remove listings, restrict accounts,
        or suspend access when we believe these Terms or community safety standards have been violated.
      </p>

      <h2>No warranties</h2>
      <p>
        Happiness Exchange is provided &quot;as is&quot;. We do not guarantee item quality, availability, or successful exchanges between users.
        Users interact and exchange items at their own discretion and risk.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Happiness Exchange is not liable for indirect, incidental, or consequential damages arising from
        use of the platform or offline exchanges between users.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms as the product evolves. Continued use after updates means you accept the revised Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:hello@happinessexchange.pk" className="font-medium text-he-purple hover:underline">hello@happinessexchange.pk</a>
      </p>
    </LegalPageLayout>
  )
}
