import { Link } from 'react-router-dom'

import { Button, Surface } from '../components/ui.jsx'

export default function MessagingDisabledPage() {
  return (
    <Surface className="mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-he-purple/10 text-he-purple">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      </div>
      <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-he-ink">
        Messaging unavailable
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-he-muted">
        Messaging is currently handled by Happiness Exchange admins via WhatsApp.
      </p>
      <p className="mt-2 text-xs text-he-soft">
        After your request is approved, an admin will contact you using the WhatsApp number in your profile.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button as="link" to="/dashboard" className="min-h-10">
          Go to Dashboard
        </Button>
        <Button as="link" to="/profile" variant="secondary" className="min-h-10">
          Update WhatsApp in Settings
        </Button>
      </div>
      <p className="mt-4 text-[11px] text-he-soft">
        Need help? <Link to="/contact" className="font-semibold text-he-purple hover:underline">Contact support</Link>
      </p>
    </Surface>
  )
}
