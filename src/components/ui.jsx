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
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4cf6]/20',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variant === 'primary' && 'bg-[#8b4cf6] text-white shadow-sm hover:bg-[#7b40e6] hover:shadow-md transition-shadow',
    variant === 'secondary' && 'border border-[#efe8da] bg-white text-[#1f1f1f] hover:bg-[#fffaf0] dark:border-[#2e2e32] dark:bg-[#1c1c1f] dark:text-[#f3f0ea] dark:hover:bg-[#252528]',
    variant === 'ghost' && 'text-[#7a639d] hover:bg-[#fff3cc] hover:text-[#1f1f1f] dark:text-[#c4b5fd] dark:hover:bg-[#252528] dark:hover:text-[#f3f0ea]',
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
    available: 'bg-[#fff6d9] text-[#8c6900] ring-[#ffcc22]/50',
    reserved: 'bg-[#f8edff] text-[#8b4cf6] ring-[#8b4cf6]/20',
    completed: 'bg-[#efe7ff] text-[#7340d2] ring-[#8b4cf6]/25',
    pending: 'bg-[#fff8e8] text-[#9a7420] ring-[#ffcc22]/35',
    approved: 'bg-[#efe7ff] text-[#7340d2] ring-[#8b4cf6]/25',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-200/50',
  }

  return (
    <span
      className={classes(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1',
        palette[status] || 'bg-stone-50 text-stone-600 ring-stone-200/50',
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
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a07d22]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-[#1f1f1f] dark:text-[#f3f0ea] sm:text-xl">
          {title}
        </h2>
        {description ? <p className="mt-1 text-xs leading-relaxed text-[#68766d] dark:text-[#a8a29e]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#efe8da]/60 bg-gradient-to-b from-[#faf7f1]/50 to-transparent p-6 md:p-8 text-center md:max-w-md md:mx-auto dark:border-[#2e2e32] dark:from-[#1c1c1f]/50">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#efe7ff]/50 text-[#8b4cf6] shadow-sm">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#1f1f1f] dark:text-[#f3f0ea]">
        {title}
      </h3>
      <p className="mx-auto mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-[#68766d] dark:text-[#a8a29e]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function Surface({ className = '', children, ...props }) {
  return (
    <section className={classes(
      'rounded-card border border-[#efe8da] bg-white shadow-[0_2px_8px_-2px_rgba(31,51,40,0.04)] transition-shadow duration-300 hover:shadow-[0_4px_12px_-2px_rgba(31,51,40,0.06)] dark:border-[#2e2e32] dark:bg-[#1c1c1f] dark:shadow-none dark:hover:shadow-none',
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
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22]">{label}</span>}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        {...props}
        className="min-h-10 rounded-input border border-[#efe8da] bg-[#fffdfb] px-3 text-sm text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10 dark:border-[#2e2e32] dark:bg-[#141416] dark:text-[#f3f0ea] dark:focus:border-[#8b4cf6]"
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
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22]">{label}</span>}
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="rounded-input border border-[#efe8da] bg-[#fffdfb] px-3 py-2.5 text-sm text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10 dark:border-[#2e2e32] dark:bg-[#141416] dark:text-[#f3f0ea] dark:focus:border-[#8b4cf6]"
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
      {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22]">{label}</span>}
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="h-10 w-full appearance-none rounded-input border border-[#efe8da] bg-[#fffdfb] px-3 pr-10 text-sm text-[#1f1f1f] outline-none transition focus:border-[#8b4cf6] focus:ring-2 focus:ring-[#8b4cf6]/10 dark:border-[#2e2e32] dark:bg-[#141416] dark:text-[#f3f0ea] dark:focus:border-[#8b4cf6]"
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8c755f]/50">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </label>
  )
}
