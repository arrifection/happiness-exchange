import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ThemeProvider } from './components/ThemeContext.jsx'
import { applyTheme, getStoredTheme } from './lib/theme.js'
import './index.css'
import 'leaflet/dist/leaflet.css'

applyTheme(getStoredTheme())
document.documentElement.classList.add('he-app-ready')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
)
