import { COUNTRIES } from '../lib/locations.js'

export default function CountrySelect({
  id = 'country',
  value = '',
  onChange,
  disabled = false,
  label = 'Your country',
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#a07d22] dark:text-he-yellow">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {COUNTRIES.map((country) => {
          const selected = value === country
          return (
            <button
              key={country}
              id={selected ? id : undefined}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(country)}
              className={[
                'min-h-9 rounded-xl border px-3 text-[12px] font-bold transition',
                selected
                  ? 'border-[#8b4cf6] bg-[#8b4cf6] text-white'
                  : 'border-he-border bg-he-surface text-he-ink hover:border-[#8b4cf6]/40',
                disabled ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              {country}
            </button>
          )
        })}
      </div>
    </div>
  )
}
