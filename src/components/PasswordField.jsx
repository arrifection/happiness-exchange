import { useState } from 'react'

/**
 * Password input with an accessible Show/Hide control.
 *
 * Visibility lives only in this component so the form still owns the actual
 * password value. Hidden by default; toggling never changes the entered text.
 */
export default function PasswordField({
  id,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
  className = '',
  disabled = false,
}) {
  const [visible, setVisible] = useState(false)
  const toggleLabel = visible ? 'Hide password' : 'Show password'

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        className={`${className} pr-12`.trim()}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={toggleLabel}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8c755f] hover:text-[#8b4cf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4cf6]/20"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
