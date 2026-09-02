export const WHATSAPP_REQUIRED_MESSAGE =
  'Please add your WhatsApp number in Settings before listing or requesting.'

export const SWAP_WHATSAPP_REQUIRED_MESSAGE =
  'To make a swap offer, please add your WhatsApp number first. This helps us coordinate the exchange.'

const SWAP_DRAFT_STORAGE_KEY = 'he_propose_swap_draft'

export function userNeedsWhatsApp(user) {
  return Boolean(user && !String(user.whatsapp_number || '').trim())
}

/** True when an API/error message is the WhatsApp requirement (not a generic failure). */
export function isWhatsAppRequiredError(detail) {
  const text = typeof detail === 'string' ? detail : String(detail?.detail || detail?.message || '')
  return /whatsapp/i.test(text)
}

function getSessionStorage() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) {
      return globalThis.sessionStorage
    }
  } catch {
    // Private mode / blocked storage.
  }
  return null
}

export function saveProposeSwapDraft(itemId, draft) {
  const storage = getSessionStorage()
  if (!itemId || !storage) return
  try {
    storage.setItem(
      SWAP_DRAFT_STORAGE_KEY,
      JSON.stringify({ itemId, ...draft, savedAt: Date.now() }),
    )
  } catch {
    // Ignore quota / private-mode failures; the user can still re-enter the form.
  }
}

export function loadProposeSwapDraft(itemId) {
  const storage = getSessionStorage()
  if (!itemId || !storage) return null
  try {
    const raw = storage.getItem(SWAP_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft || draft.itemId !== itemId) return null
    return draft
  } catch {
    return null
  }
}

export function clearProposeSwapDraft(itemId) {
  const storage = getSessionStorage()
  if (!storage) return
  try {
    const raw = storage.getItem(SWAP_DRAFT_STORAGE_KEY)
    if (!raw) return
    if (!itemId) {
      storage.removeItem(SWAP_DRAFT_STORAGE_KEY)
      return
    }
    const draft = JSON.parse(raw)
    if (draft?.itemId === itemId) {
      storage.removeItem(SWAP_DRAFT_STORAGE_KEY)
    }
  } catch {
    storage.removeItem(SWAP_DRAFT_STORAGE_KEY)
  }
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
    return 'WhatsApp number must be 10-15 digits.'
  }

  return ''
}
