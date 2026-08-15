export const THEME_KEY = 'happiness_exchange_theme'

export function getStoredTheme() {
  return 'light'
}

export function applyTheme(_theme = 'light') {
  document.documentElement.classList.remove('dark')
}

export function setStoredTheme(_theme = 'light') {
  try {
    localStorage.setItem(THEME_KEY, 'light')
  } catch {
    /* private browsing */
  }
  applyTheme('light')
  return 'light'
}
