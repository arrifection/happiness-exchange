const INVALID_DISPLAY_VALUES = new Set(['unknown', 'unknown user', 'n/a', 'na', ''])

export function resolveDisplayName(source = {}, fallback = 'User') {
  const candidates = [
    source.full_name,
    source.display_name,
    source.name,
    source.username,
    source.counterpart_name,
    source.member_name,
    source.sender_name,
    source.list_title,
  ]

  const email = source.email
  if (email && String(email).includes('@')) {
    candidates.push(String(email).split('@')[0])
  }

  for (const candidate of candidates) {
    if (candidate == null) continue
    const cleaned = String(candidate).trim().replace(/\s+/g, ' ')
    if (!cleaned || INVALID_DISPLAY_VALUES.has(cleaned.toLowerCase())) continue
    return cleaned
  }

  return fallback
}

export function getInitials(name, fallback = 'U') {
  const resolved = resolveDisplayName({ name }, fallback)
  if (!resolved || resolved === fallback) return fallback.slice(0, 2).toUpperCase()
  return resolved.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}
