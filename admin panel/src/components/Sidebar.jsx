import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { APP_NAME } from '../lib/env'
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Flag,
  Star,
  UsersRound,
  Truck,
  BarChart3,
  LogOut,
  ChevronRight,
  Settings,
  Shield,
} from 'lucide-react'

const navItems = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard',   to: '/dashboard',  icon: LayoutDashboard },
      { label: 'Analytics',   to: '/analytics',  icon: BarChart3 },
    ],
  },
  {
    group: 'Content',
    items: [
      { label: 'Listings',    to: '/listings',   icon: Package },
      { label: 'Requests',    to: '/requests',   icon: FileText },
      { label: 'Reviews',     to: '/reviews',    icon: Star },
    ],
  },
  {
    group: 'Moderation',
    items: [
      { label: 'Reports & Flags', to: '/reports',  icon: Flag },
      { label: 'Users',           to: '/users',    icon: Users },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Courier Coord.', to: '/courier',  icon: Truck },
      { label: 'Team Members',   to: '/team',     icon: UsersRound },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleColors = {
    super_admin: 'text-purple-400',
    admin:       'text-brand-400',
    moderator:   'text-amber-400',
    courier:     'text-emerald-400',
  }
  const roleColor = roleColors[user?.role] || 'text-surface-400'

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen z-40 flex flex-col
        bg-surface-900 border-r border-surface-800
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* ── Logo ─────────────────────────────────────── */}
      <div className={`flex items-center h-16 border-b border-surface-800 px-4 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-glow">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-surface-50 leading-none">{APP_NAME}</p>
            <p className="text-[10px] text-surface-500 mt-0.5 tracking-widest uppercase">Admin Panel</p>
          </div>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((group) => (
          <div key={group.group} className="mb-4">
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-surface-600">
                {group.group}
              </p>
            )}
            {group.items.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                  ${collapsed ? 'justify-center' : ''}
                  ${isActive
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-400' : ''}`} />
                    {!collapsed && <span className="flex-1">{label}</span>}
                    {!collapsed && isActive && (
                      <ChevronRight className="w-3.5 h-3.5 text-brand-500" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* ── User Footer ──────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-surface-800 p-3 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2.5 rounded-lg bg-surface-800/50 mb-2">
            <p className="text-sm font-medium text-surface-200 truncate">
              {user.full_name || user.username || user.email}
            </p>
            <p className={`text-xs font-mono mt-0.5 ${roleColor}`}>
              {user.role?.replace('_', ' ') || 'admin'}
            </p>
          </div>
        )}

        <button
          onClick={() => navigate('/settings')}
          title="Settings"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>

        <button
          onClick={handleLogout}
          title="Sign out"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* ── Collapse Toggle ───────────────────────────── */}
      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`
          absolute top-[4.5rem] -right-3 w-6 h-6 rounded-full
          bg-surface-800 border border-surface-700 text-surface-400
          hover:text-surface-200 hover:border-surface-600
          flex items-center justify-center transition-all duration-200
          shadow-md
        `}
      >
        <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`} />
      </button>
    </aside>
  )
}
