import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Bell, Search, Wifi, Sparkles, LogOut } from 'lucide-react'
import { useState, useEffect } from 'react'
import { statusApi } from '../lib/api'
import NotificationBell from './NotificationBell'

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
  const { user, logout, isDemo } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [apiStatus, setApiStatus] = useState(isDemo ? 'demo' : 'checking')

  const handleExitDemo = () => {
    logout()
    navigate('/login')
  }

  const pageTitle = routeLabels[location.pathname] || 'Admin Panel'

  useEffect(() => {
    if (isDemo) return // skip API polling in demo mode
    const checkStatus = async () => {
      try {
        await statusApi.check()
        setApiStatus('online')
      } catch {
        setApiStatus('offline')
      }
    }
    checkStatus()
    const interval = setInterval(checkStatus, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {/* Demo mode banner */}
      {isDemo && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">
              Demo Mode — You&apos;re viewing the admin panel with sample data. Live data requires the backend.
            </span>
          </div>
          <button
            onClick={handleExitDemo}
            className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-300 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Exit Demo
          </button>
        </div>
      )}

      {/* Main TopBar */}
      <header className="h-16 bg-surface-900/80 backdrop-blur-sm border-b border-surface-800 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: Page title */}
      <div>
        <h1 className="text-base font-semibold text-surface-100">{pageTitle}</h1>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isDemo            ? 'bg-amber-400' :
              apiStatus === 'online'   ? 'bg-emerald-400 animate-pulse-slow' :
              apiStatus === 'offline'  ? 'bg-red-400' :
              'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-xs text-surface-500">
            {isDemo ? 'Demo mode — no backend' :
             apiStatus === 'checking' ? 'Backend connecting…' :
             `Backend ${apiStatus}`}
          </span>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
          <input
            type="search"
            placeholder="Quick search…"
            className="form-input pl-8 py-1.5 w-52 text-xs rounded-lg"
          />
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold uppercase shadow-glow">
          {(user?.full_name || user?.username || user?.email || 'A')[0]}
        </div>
      </div>
      </header>
    </>
  )
}
