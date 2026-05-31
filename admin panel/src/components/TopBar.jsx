import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import NotificationBell from './NotificationBell'
import { fetchBackendHealthStatus } from '../lib/backendHealth'

const routeLabels = {
  '/dashboard':  'Dashboard',
  '/analytics':  'Analytics',
  '/listings':   'Listings Management',
  '/requests':   'Requests Management',
  '/reviews':    'Reviews Management',
  '/reports':    'Reports & Flags',
  '/users':      'Users Management',
  '/courier':    'Courier Coordination',
  '/team':       'Team Members',
  '/settings':   'Settings',
}

export default function TopBar() {
  const { user } = useAuth()
  const location = useLocation()
  const [apiStatus, setApiStatus] = useState('checking')

  const pageTitle = routeLabels[location.pathname] || 'Admin Panel'

  useEffect(() => {
    let cancelled = false

    const checkStatus = async () => {
      const next = await fetchBackendHealthStatus()
      if (!cancelled) setApiStatus(next)
    }

    checkStatus()
    const interval = setInterval(checkStatus, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-surface-300 flex items-center justify-between px-6 sticky top-0 z-30 shadow-soft">
      <div>
        <h1 className="text-base font-semibold text-surface-800">{pageTitle}</h1>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              apiStatus === 'online'   ? 'bg-emerald-500 animate-pulse-slow' :
              apiStatus === 'offline'  ? 'bg-red-500' :
              'bg-accent-400 animate-pulse'
            }`}
          />
          <span className="text-xs text-surface-500">
            {apiStatus === 'checking' ? 'Backend connecting…' :
             apiStatus === 'online'   ? 'Backend online' :
             'Backend offline'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold uppercase shadow-soft ring-2 ring-white">
          {(user?.full_name || user?.name || user?.username || user?.email || 'A')[0]}
        </div>
      </div>
    </header>
  )
}
