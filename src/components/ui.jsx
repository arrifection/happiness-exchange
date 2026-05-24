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
    'inline-flex min-h-9 items-center justify-center rounded-btn px-4 py-2 text-[13px] font-bold uppercase tracking-widest transition-all duration-200 active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-he-purple/20',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variant === 'primary' && 'bg-he-purple text-white shadow-sm hover:bg-[#7b40e6] hover:shadow-md transition-shadow',
    variant === 'secondary' && 'border border-he-border bg-he-surface text-he-ink hover:bg-he-page',
    variant === 'ghost' && 'text-[#7a639d] hover:bg-[#fff3cc] hover:text-he-ink dark:text-[#c4b5fd] dark:hover:bg-he-surface-soft dark:hover:text-he-ink',
    variant === 'danger' && 'bg-[#c65d4a] text-white hover:bg-[#ae4e3d]',
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
    available: 'bg-[#fff6d9] text-[#8c6900] ring-[#ffcc22]/50 dark:bg-[#3d3520] dark:text-[#ffcc22] dark:ring-[#ffcc22]/30',
    reserved: 'bg-[#f8edff] text-[#8b4cf6] ring-[#8b4cf6]/20 dark:bg-[#2d2640] dark:text-[#c4b5fd] dark:ring-[#8b4cf6]/30',
    completed: 'bg-[#efe7ff] text-[#7340d2] ring-[#8b4cf6]/25 dark:bg-[#2d2640] dark:text-[#c4b5fd] dark:ring-[#8b4cf6]/30',
    pending: 'bg-[#fff8e8] text-[#9a7420] ring-[#ffcc22]/35 dark:bg-[#3d3520] dark:text-[#ffcc22] dark:ring-[#ffcc22]/30',
    approved: 'bg-[#efe7ff] text-[#7340d2] ring-[#8b4cf6]/25 dark:bg-[#2d2640] dark:text-[#c4b5fd] dark:ring-[#8b4cf6]/30',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-200/50 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/50',
  }

  return (
    <span
      className={classes(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1',
        palette[status] || 'bg-stone-50 text-stone-600 ring-stone-200/50 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700',
        className,
      )}
    >
      {status}
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
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a07d22] dark:text-[#d4a017]">
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

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] border border-he-border/60 bg-gradient-to-b from-he-surface-soft/50 to-transparent p-6 md:p-8 text-center md:max-w-md md:mx-auto">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#efe7ff]/50 text-he-purple shadow-sm dark:bg-[#2d2640]">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-he-ink">
        {title}
      </h3>
      <p className="mx-auto mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-he-muted">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function Surface({ className = '', children, ...props }) {
  return (
    <section className={classes(
      'rounded-card border border-he-border bg-he-surface shadow-[0_2px_8px_-2px_rgba(31,51,40,0.04)] transition-shadow duration-300 hover:shadow-[0_4px_12px_-2px_rgba(31,51,40,0.06)] dark:shadow-none dark:hover:shadow-none',
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
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-[#d4a017]">{label}</span>}
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
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-[#d4a017]">{label}</span>}
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
}) {
  return (
    <label className="grid gap-1.5" htmlFor={id}>
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-[#d4a017]">{label}</span>}
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="h-10 w-full appearance-none rounded-input border border-he-border bg-he-input px-3 pr-10 text-sm text-he-ink outline-none transition focus:border-he-purple focus:ring-2 focus:ring-he-purple/10"
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
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
