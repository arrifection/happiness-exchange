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
    'inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition duration-300 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d86d4f]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variant === 'primary' && 'bg-[#1d6b57] text-white shadow-[0_18px_40px_rgba(29,107,87,0.24)] hover:-translate-y-0.5 hover:bg-[#155441]',
    variant === 'secondary' && 'border border-white/70 bg-white/80 text-[#21453c] shadow-[0_12px_28px_rgba(58,59,92,0.08)] backdrop-blur hover:-translate-y-0.5 hover:bg-white',
    variant === 'ghost' && 'border border-[#d9d7d1] bg-white/55 text-[#21453c] hover:bg-white/80',
    variant === 'danger' && 'bg-[#c65d4a] text-white shadow-[0_16px_32px_rgba(198,93,74,0.24)] hover:-translate-y-0.5 hover:bg-[#b14d3d]',
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
    available: 'bg-emerald-100/90 text-emerald-800 ring-1 ring-emerald-200',
    reserved: 'bg-amber-100/95 text-amber-800 ring-1 ring-amber-200',
    completed: 'bg-sky-100/95 text-sky-800 ring-1 ring-sky-200',
    pending: 'bg-violet-100/95 text-violet-800 ring-1 ring-violet-200',
    approved: 'bg-emerald-100/90 text-emerald-800 ring-1 ring-emerald-200',
    rejected: 'bg-rose-100/95 text-rose-700 ring-1 ring-rose-200',
  }

  return (
    <span
      className={classes(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize tracking-[0.02em]',
        palette[status] || 'bg-stone-100 text-stone-700 ring-1 ring-stone-200',
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
    <div className={classes('flex flex-col gap-4 md:flex-row md:items-end', align === 'between' && 'md:justify-between')}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-3 inline-flex rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b35d3c] shadow-sm backdrop-blur">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-3xl font-semibold tracking-[-0.04em] text-[#20352e] sm:text-4xl">
          {title}
        </h2>
        {description ? <p className="mt-3 max-w-2xl text-base leading-7 text-[#5f6d68]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-[28px] border border-dashed border-[#d6cfbf] bg-white/70 p-8 text-center shadow-[0_12px_30px_rgba(36,41,48,0.06)] backdrop-blur">
      <h3 className="font-['Plus_Jakarta_Sans',ui-sans-serif,system-ui] text-xl font-semibold text-[#243b34]">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#6b7873]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function Surface({ className = '', children, ...props }) {
  return (
    <section className={classes(
      'rounded-[32px] border border-white/70 bg-white/75 shadow-[0_18px_50px_rgba(34,37,43,0.08)] backdrop-blur-xl',
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
    <label className="grid gap-2 text-sm font-medium text-[#29413b]" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        {...props}
        className="min-h-12 rounded-2xl border border-[#e4ddd1] bg-[#fffdfa] px-4 text-[#1f3730] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-[#d58663] focus:ring-4 focus:ring-[#f6d8c8]"
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
  rows = 5,
  required = false,
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#29413b]" htmlFor={id}>
      <span>{label}</span>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="rounded-2xl border border-[#e4ddd1] bg-[#fffdfa] px-4 py-3 text-[#1f3730] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-[#d58663] focus:ring-4 focus:ring-[#f6d8c8]"
      />
    </label>
  )
}
