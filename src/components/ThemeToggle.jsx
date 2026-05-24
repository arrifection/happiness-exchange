export default function ThemeToggle({ checked, onChange, disabled = false, label = 'Toggle theme' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4cf6]/30',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        checked ? 'bg-[#8b4cf6]' : 'bg-[#efe8da] dark:bg-[#3a3a40]',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  )
}
