export const EXCHANGE_NO_LONGER_AVAILABLE_MESSAGE =
  'This exchange is no longer available. Please try again later.'

export const EXCHANGE_OFFER_EXPIRED_MESSAGE = 'This exchange offer has expired.'

export function exchangeActionErrorMessage(status, detail, fallback = 'Action failed.') {
  if (Number(status) === 409) {
    return EXCHANGE_NO_LONGER_AVAILABLE_MESSAGE
  }
  if (typeof detail === 'string' && detail.trim()) {
    const text = detail.trim()
    if (/expired/i.test(text) && /offer/i.test(text)) {
      return EXCHANGE_OFFER_EXPIRED_MESSAGE
    }
    return text
  }
  return fallback
}
