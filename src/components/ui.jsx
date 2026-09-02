import { Link } from 'react-router-dom'

function classes(...values) {
  return values.filter(Boolean).join(' ')
}

export function Button({
  as = 'button',
  to,
  type = 'button',
  variant = 'primary',
  className = '',
  children,
  ...props
}) {
  const baseClassName = classes(
    'inline-flex min-h-9 items-center justify-center rounded-btn px-4 py-2 text-[13px] font-bold normal-case tracking-wide md:uppercase md:tracking-widest transition-all duration-200 active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-he-purple/20',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variant === 'primary' && 'bg-he-purple text-white shadow-sm hover:bg-he-purple-hover hover:shadow-md transition-shadow',
    variant === 'secondary' && 'border border-he-border bg-he-surface text-he-ink hover:bg-he-surface-soft dark:hover:border-he-border',
    variant === 'ghost' && 'text-[#7a639d] hover:bg-he-surface-soft hover:text-he-ink dark:text-[#c4b5fd] dark:hover:bg-he-elevated dark:hover:text-he-ink',
    variant === 'danger' && 'bg-he-danger text-white hover:bg-[#dc2626]',
    className,
  )

  if (as === 'link') {
    return (
      <Link className={baseClassName} to={to} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button className={baseClassName} type={type} {...props}>
      {children}
    </button>
  )
}

export function StatusBadge({ status, className = '' }) {
  const palette = {
    available: 'bg-[#fff6d9] text-[#8c6900] ring-[#ffcc22]/50 dark:bg-[#3d3520] dark:text-he-yellow dark:ring-he-yellow/40',
    reserved: 'bg-[#f8edff] text-[#8b4cf6] ring-[#8b4cf6]/20 dark:bg-[#2d2640] dark:text-[#ddd6fe] dark:ring-he-purple/40',
    completed: 'bg-[#efe7ff] text-[#7340d2] ring-[#8b4cf6]/25 dark:bg-[#2d2640] dark:text-[#ddd6fe] dark:ring-he-purple/40',
    pending: 'bg-[#fff8e8] text-[#9a7420] ring-[#ffcc22]/35 dark:bg-[#3d3520] dark:text-he-yellow dark:ring-he-yellow/40',
    approved: 'bg-[#efe7ff] text-[#7340d2] ring-[#8b4cf6]/25 dark:bg-[#2d2640] dark:text-[#ddd6fe] dark:ring-he-purple/40',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-200/50 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800/60',
    exchange_reserved: 'bg-[#f8edff] text-[#8b4cf6] ring-[#8b4cf6]/20 dark:bg-[#2d2640] dark:text-[#ddd6fe] dark:ring-he-purple/40',
    countered: 'bg-[#fff8e8] text-[#9a7420] ring-[#ffcc22]/35 dark:bg-[#3d3520] dark:text-he-yellow dark:ring-he-yellow/40',
    under_review: 'bg-stone-100 text-stone-700 ring-stone-200/50 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700',
    shipping: 'bg-sky-50 text-sky-700 ring-sky-200/50 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/60',
    shipped: 'bg-indigo-50 text-indigo-700 ring-indigo-200/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800/60',
    delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60',
    collecting_shipping: 'bg-sky-50 text-sky-700 ring-sky-200/50 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/60',
    awaiting_payment: 'bg-[#fff8e8] text-[#9a7420] ring-[#ffcc22]/35 dark:bg-[#3d3520] dark:text-he-yellow dark:ring-he-yellow/40',
    awaiting_details: 'bg-[#fff8e8] text-[#9a7420] ring-[#ffcc22]/35 dark:bg-[#3d3520] dark:text-he-yellow dark:ring-he-yellow/40',
    ready_to_ship: 'bg-sky-50 text-sky-700 ring-sky-200/50 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/60',
    in_transit: 'bg-indigo-50 text-indigo-700 ring-indigo-200/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800/60',
    out_for_delivery: 'bg-amber-50 text-amber-800 ring-amber-200/50 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60',
    paid: 'bg-[#efe7ff] text-[#7340d2] ring-[#8b4cf6]/25 dark:bg-[#2d2640] dark:text-[#ddd6fe] dark:ring-he-purple/40',
    expired: 'bg-stone-100 text-stone-600 ring-stone-200/50 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700',
    cancelled: 'bg-stone-100 text-stone-600 ring-stone-200/50 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700',
    accepted: 'bg-[#efe7ff] text-[#7340d2] ring-[#8b4cf6]/25 dark:bg-[#2d2640] dark:text-[#ddd6fe] dark:ring-he-purple/40',
  }

  return (
    <span
      className={classes(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1',
        palette[status] || 'bg-stone-50 text-stone-600 ring-stone-200/50 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700',
        className,
      )}
    >
      {status === 'expired' ? 'Expired' : status === 'active' ? 'Active' : status === 'exchange_reserved' ? 'Exchange Reserved' : status.replace(/_/g, ' ')}
    </span>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = 'between',
}) {
  return (
    <div className={classes('flex flex-col gap-3 sm:flex-row sm:items-end', align === 'between' && 'sm:justify-between')}>
      <div className="max-w-xl">
        {eyebrow ? (
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a07d22] dark:text-he-yellow">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-he-ink sm:text-xl">
          {title}
        </h2>
        {description ? <p className="mt-1 text-xs leading-relaxed text-he-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

const EMPTY_STATE_ICONS = {
  default: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  items: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  search: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  messages: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
  requests: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  reviews: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.499z" />
    </svg>
  ),
  needs: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
}

export function EmptyState({ title, description, action, icon = 'default', className = '' }) {
  const iconNode = EMPTY_STATE_ICONS[icon] || EMPTY_STATE_ICONS.default

  return (
    <div className={`flex flex-col items-center justify-center rounded-[20px] border border-he-border bg-he-surface p-6 text-center shadow-sm md:mx-auto md:max-w-md md:p-8 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] ${className}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#efe7ff]/50 text-he-purple shadow-sm dark:bg-[#2d2640]">
        {iconNode}
      </div>
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-he-ink">
        {title}
      </h3>
      <p className="mx-auto mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-he-muted">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = "We couldn't load this",
  message,
  onRetry,
  retryLabel = 'Try again',
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-[20px] border border-he-danger/25 bg-he-surface p-6 text-center md:mx-auto md:max-w-md md:p-8 ${className}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-he-danger/10 text-he-danger">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-he-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-he-muted">
        {message || 'Something went wrong while fetching data. Please check your connection and try again.'}
      </p>
      {onRetry ? (
        <div className="mt-5">
          <Button type="button" onClick={onRetry}>{retryLabel}</Button>
        </div>
      ) : null}
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return (
    <div
      className={classes('animate-pulse rounded-lg bg-he-border/70 dark:bg-he-elevated', className)}
      aria-hidden="true"
    />
  )
}

export function ItemCardSkeleton() {
  return (
    <article className="he-card flex overflow-hidden">
      <Skeleton className="aspect-square w-20 shrink-0 rounded-none sm:w-24" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </article>
  )
}

export function ItemCardSkeletonGrid({ count = 4, className = '' }) {
  return (
    <div className={classes('grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-6', className)}>
      {Array.from({ length: count }, (_, index) => (
        <ItemCardSkeleton key={`item-skeleton-${index}`} />
      ))}
    </div>
  )
}

export function RequestCardSkeleton() {
  return (
    <div className="he-card rounded-card p-3.5">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <Skeleton className="mt-4 h-7 w-full" />
    </div>
  )
}

export function RequestCardSkeletonList({ count = 3, className = '' }) {
  return (
    <div className={classes('grid grid-cols-1 gap-3 md:gap-5 sm:grid-cols-2', className)}>
      {Array.from({ length: count }, (_, index) => (
        <RequestCardSkeleton key={`request-skeleton-${index}`} />
      ))}
    </div>
  )
}

export function NeedCardSkeleton() {
  return (
    <div className="he-card rounded-card p-4">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-5/6" />
      <Skeleton className="mt-4 h-8 w-28" />
    </div>
  )
}

export function NeedCardSkeletonList({ count = 3, className = '' }) {
  return (
    <div className={classes('grid gap-3', className)}>
      {Array.from({ length: count }, (_, index) => (
        <NeedCardSkeleton key={`need-skeleton-${index}`} />
      ))}
    </div>
  )
}

export function ConversationSkeletonList({ count = 5, className = '' }) {
  return (
    <div className={classes('divide-y divide-he-border', className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={`conv-skeleton-${index}`} className="flex items-center gap-3 p-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MessageSkeletonList({ count = 5, className = '' }) {
  return (
    <div className={classes('space-y-3 p-4', className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={`msg-skeleton-${index}`} className={`flex ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <Skeleton className={`h-10 rounded-2xl ${index % 2 === 0 ? 'w-2/3 max-w-xs' : 'w-1/2 max-w-[200px]'}`} />
        </div>
      ))}
    </div>
  )
}

export function InlineLoadingNotice({ label = 'Loading…', className = '' }) {
  return (
    <div className={classes('flex items-center gap-2 text-[11px] font-medium text-he-muted', className)}>
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-he-purple border-t-transparent" />
      {label}
    </div>
  )
}

export function Surface({ className = '', children, ...props }) {
  return (
    <section className={classes(
      'he-card',
      className,
    )}
      {...props}
    >
      {children}
    </section>
  )
}

export function TextField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  ...props
}) {
  return (
    <label className="grid gap-1.5" htmlFor={id}>
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-he-yellow">{label}</span>}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        {...props}
        className="min-h-10 rounded-input border border-he-border bg-he-input px-3 text-sm text-he-ink outline-none transition placeholder:text-he-soft/60 focus:border-he-purple focus:ring-2 focus:ring-he-purple/10"
      />
    </label>
  )
}

export function TextAreaField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  required = false,
}) {
  return (
    <label className="grid gap-1.5" htmlFor={id}>
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-he-yellow">{label}</span>}
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="rounded-input border border-he-border bg-he-input px-3 py-2.5 text-sm text-he-ink outline-none transition placeholder:text-he-soft/60 focus:border-he-purple focus:ring-2 focus:ring-he-purple/10"
      />
    </label>
  )
}

export function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  options = [],
  required = false,
  placeholder,
  disabled = false,
  children,
}) {
  return (
    <label className="grid gap-1.5" htmlFor={id}>
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-he-yellow">{label}</span>}
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className="h-10 w-full appearance-none rounded-input border border-he-border bg-he-input px-3 pr-10 text-sm text-he-ink outline-none transition focus:border-he-purple focus:ring-2 focus:ring-he-purple/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => {
            const optionValue = typeof opt === 'string' ? opt : opt.value
            const optionLabel = typeof opt === 'string' ? opt : opt.label
            return (
              <option key={optionValue} value={optionValue}>{optionLabel}</option>
            )
          })}
          {children}
        </select>
        <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-he-soft/50">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </label>
  )
}
