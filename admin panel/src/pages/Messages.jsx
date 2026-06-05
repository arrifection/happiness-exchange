import { MessageSquare } from 'lucide-react'

export default function MessagesPage() {
  return (
    <div className="animate-slide-in max-w-2xl">
      <div className="page-header">
        <h2 className="page-title">Messages</h2>
        <p className="page-subtitle">In-app messaging is disabled</p>
      </div>

      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-brand-200">
          <MessageSquare className="h-7 w-7 text-brand-600" />
        </div>
        <h3 className="text-lg font-semibold text-surface-800">In-app messaging is disabled</h3>
        <p className="mt-3 text-sm leading-relaxed text-surface-600">
          Use verified WhatsApp contact numbers from user profiles to coordinate approved exchanges manually.
        </p>
        <p className="mt-2 text-xs text-surface-500">
          WhatsApp numbers appear on the Users and Requests pages for staff with the appropriate permissions.
        </p>
      </div>
    </div>
  )
}
