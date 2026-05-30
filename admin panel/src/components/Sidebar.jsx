import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth, ROLES } from '../contexts/AuthContext'
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
  Shield,
  MessageSquare,
} from 'lucide-react'

const navItems = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, minRole: ROLES.COURIER },
      { label: 'Analytics', to: '/analytics', icon: BarChart3, minRole: ROLES.ADMIN },
    ],
  },
  {
    group: 'Content',
    items: [
      { label: 'Listings', to: '/listings', icon: Package, minRole: ROLES.MODERATOR },
      { label: 'Requests', to: '/requests', icon: FileText, minRole: ROLES.MODERATOR },
      { label: 'Messages', to: '/messages', icon: MessageSquare, minRole: ROLES.MODERATOR },
      { label: 'Reviews', to: '/reviews', icon: Star, minRole: ROLES.MODERATOR },
    ],
  },
  {
    group: 'Moderation',
    items: [
      { label: 'Reports & Flags', to: '/reports', icon: Flag, minRole: ROLES.MODERATOR },
      { label: 'Users', to: '/users', icon: Users, minRole: ROLES.ADMIN },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Courier Coord.', to: '/courier', icon: Truck, minRole: ROLES.COURIER },
      { label: 'Team Members', to: '/team', icon: UsersRound, minRole: ROLES.SUPER_ADMIN },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleColors = {
    super_admin: 'text-purple-700',
    admin: 'text-brand-700',
    moderator: 'text-accent-700',
    courier: 'text-emerald-700',
  }
  const roleColor = roleColors[user?.role] || 'text-surface-500'

  const visibleNavItems = navItems
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasRole(item.minRole)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen z-40 flex flex-col
        bg-surface-200 border-r border-surface-300
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      <div className={`flex items-center h-16 border-b border-surface-300 px-4 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-soft">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-surface-800 leading-none">{APP_NAME}</p>
            <p className="text-[10px] text-surface-500 mt-0.5 tracking-widest uppercase">Admin Panel</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {visibleNavItems.map((group) => (
          <div key={group.group} className="mb-4">
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-surface-500">
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
                    ? 'bg-white text-brand-700 border border-brand-200 shadow-soft'
                    : 'text-surface-600 hover:text-surface-800 hover:bg-lavender-50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-600' : 'text-surface-500 group-hover:text-surface-700'}`} />
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

      <div className="flex-shrink-0 border-t border-surface-300 p-3 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2.5 rounded-lg bg-white/70 border border-surface-300 mb-2">
            <p className="text-sm font-medium text-surface-800 truncate">
              {user.full_name || user.username || user.email}
            </p>
            <p className={`text-xs font-mono mt-0.5 capitalize ${roleColor}`}>
              {user.role?.replace('_', ' ') || 'admin'}
            </p>
          </div>
        )}

        <button
          onClick={handleLogout}
          title="Sign out"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:text-red-700 hover:bg-red-50 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`
          absolute top-[4.5rem] -right-3 w-6 h-6 rounded-full
          bg-white border border-surface-300 text-surface-500
          hover:text-surface-800 hover:border-brand-300 hover:bg-lavender-50
          flex items-center justify-center transition-all duration-200
          shadow-soft
        `}
      >
        <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`} />
      </button>
    </aside>
  )
}
