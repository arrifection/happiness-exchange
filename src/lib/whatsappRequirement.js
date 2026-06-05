export const WHATSAPP_REQUIRED_MESSAGE =
  'Please add your WhatsApp number in Settings before listing or requesting.'

export function userNeedsWhatsApp(user) {
  return Boolean(user && !String(user.whatsapp_number || '').trim())
}

/** Basic client-side check before signup/settings save (backend validates fully). */
export function validateWhatsAppInput(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return 'WhatsApp number is required.'
  }
  const normalized = trimmed.replace(/[\s\-()]/g, '')
  const digits = normalized.startsWith('+') ? normalized.slice(1) : normalized
  if (!/^\d+$/.test(digits)) {
    return 'Use digits only, with an optional leading +.'
  }
  if (digits.length < 10 || digits.length > 15) {
    return 'WhatsApp number must be 10–15 digits.'
  }
  return ''
}
