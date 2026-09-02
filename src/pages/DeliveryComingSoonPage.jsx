import { Button, Surface } from '../components/ui.jsx'

export default function DeliveryComingSoonPage() {
  return (
    <div className="app-shell mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-he-purple">Delivery</p>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-he-ink">Coming Soon</h1>
      </div>

      <Surface className="p-6 text-center">
        <p className="text-sm leading-relaxed text-he-muted">
          Delivery coordination is coming soon. We&apos;re getting everything ready.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button as="link" to="/browse">Browse items</Button>
          <Button as="link" to="/requests" variant="secondary">View your activity</Button>
        </div>
      </Surface>
    </div>
  )
}
