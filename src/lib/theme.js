export const THEME_KEY = 'happiness_exchange_theme'

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function setStoredTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light'
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    /* private browsing */
  }
  applyTheme(next)
  return next
}
