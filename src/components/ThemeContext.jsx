import { createContext, useContext, useEffect } from 'react'

import { applyTheme } from '../lib/theme.js'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  useEffect(() => {
    applyTheme('light')
  }, [])

  const value = {
    theme: 'light',
    isDark: false,
    setTheme: () => {},
    toggleTheme: () => {},
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
