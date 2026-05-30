import { useState, useRef, useEffect } from 'react'
import { useNotifications } from './NotificationContext.jsx'
import { USER_NOTIFICATION_EMPTY_DESCRIPTION, USER_NOTIFICATION_EMPTY_TITLE } from '../lib/notificationFilters.js'
import { useNavigate } from 'react-router-dom'

function timeAgo(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function normalizeActionUrl(url) {
  if (!url) return null
  const queryMatch = url.match(/[?&]conversation=([^&]+)/)
  if (queryMatch) return `/messages/${queryMatch[1]}`
  return url
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
    setIsOpen(false)
    if (notification.action_url) {
      navigate(normalizeActionUrl(notification.action_url))
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent transition-all duration-200 ${isOpen ? 'bg-he-nav-active text-he-purple' : 'text-he-soft hover:bg-he-elevated hover:text-he-ink'}`}
        aria-label="Notifications"
      >
        <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-he-danger text-[9px] font-bold text-white ring-2 ring-he-surface">
            {/* no text for bell badge just dot */}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[85vh] w-80 flex-col overflow-hidden rounded-2xl border border-he-border bg-he-surface shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)] md:w-96">
          <div className="flex items-center justify-between border-b border-he-border bg-he-surface-soft px-4 py-3">
            <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-he-ink">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={() => markAllAsRead()}
                className="text-xs font-medium text-he-purple hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-[100px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-he-surface-soft">
                  <svg className="h-6 w-6 text-he-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-he-muted">{USER_NOTIFICATION_EMPTY_TITLE}</p>
                <p className="mt-1 text-xs leading-relaxed text-he-soft">
                  {USER_NOTIFICATION_EMPTY_DESCRIPTION}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-he-border">
                {notifications.map((notif) => (
                  <li 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`group flex cursor-pointer items-start gap-3 p-4 transition-colors ${notif.read ? 'bg-he-surface hover:bg-he-elevated' : 'bg-he-nav-active hover:bg-he-elevated'}`}
                  >
                    <div className="mt-1 flex-shrink-0">
                      {!notif.read && <div className="h-2 w-2 rounded-full bg-he-purple" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notif.read ? 'font-medium text-he-ink' : 'font-bold text-he-ink'}`}>
                        {notif.title}
                      </p>
                      <p className={`mt-0.5 line-clamp-2 text-xs ${notif.read ? 'text-he-muted' : 'text-he-ink/90'}`}>
                        {notif.message}
                      </p>
                      <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-he-soft">
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
