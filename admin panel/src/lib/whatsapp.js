export function whatsappWaMeLink(number) {
  if (!number) return null
  const digits = String(number).replace(/^\+/, '')
  if (!digits) return null
  return `https://wa.me/${digits}`
}

export async function copyWhatsAppNumber(number) {
  if (!number) return false
  try {
    await navigator.clipboard.writeText(number)
    return true
  } catch {
    return false
  }
}
