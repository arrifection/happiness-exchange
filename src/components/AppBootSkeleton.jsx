import { ItemCardSkeletonGrid } from './ui.jsx'

export default function AppBootSkeleton({ message = 'Loading your account…' }) {
  return (
    <div className="app-shell mx-auto w-full max-w-[1280px] space-y-6 px-4 pb-20 pt-4 md:px-6 md:pb-8">
      <div className="rounded-2xl border border-he-border bg-he-surface p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-2xl bg-he-surface-soft" />
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-he-surface-soft" />
            <div className="h-3 w-56 animate-pulse rounded bg-he-surface-soft" />
          </div>
        </div>
        <p className="mt-4 text-sm text-he-muted">{message}</p>
      </div>
      <ItemCardSkeletonGrid count={2} />
    </div>
  )
}
