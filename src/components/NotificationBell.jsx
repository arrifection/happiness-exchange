import { useState, useRef, useEffect } from 'react'
import { useNotifications } from './NotificationContext.jsx'
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
      navigate(notification.action_url)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent transition-all duration-200 ${isOpen ? 'bg-[#efe7ff] text-[#8b4cf6]' : 'text-[#8c755f] hover:bg-[#fff3cc] hover:text-[#1f1f1f]'}`}
        aria-label="Notifications"
      >
        <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#ef4444] text-[9px] font-bold text-white ring-2 ring-white">
            {/* no text for bell badge just dot */}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 rounded-2xl bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] ring-1 ring-black/5 z-50 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between border-b border-[#efe8da] bg-[#fdfcfa] px-4 py-3">
            <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1f3328]">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={() => markAllAsRead()}
                className="text-xs font-medium text-[#8b4cf6] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-[100px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-[#fdfcfa] flex items-center justify-center mb-3">
                  <svg className="h-6 w-6 text-[#d2c9b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[#68766d]">No notifications yet</p>
                <p className="text-xs text-[#8c755f] mt-1">We'll let you know when there's activity.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#efe8da]">
                {notifications.map((notif) => (
                  <li 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`group flex items-start gap-3 p-4 transition-colors cursor-pointer ${notif.read ? 'bg-white hover:bg-[#fdfcfa]' : 'bg-[#f5f0ff] hover:bg-[#efe7ff]'}`}
                  >
                    <div className="mt-1 flex-shrink-0">
                      {!notif.read && <div className="h-2 w-2 rounded-full bg-[#8b4cf6]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notif.read ? 'text-[#1f3328] font-medium' : 'text-[#1f3328] font-bold'}`}>
                        {notif.title}
                      </p>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${notif.read ? 'text-[#68766d]' : 'text-[#4b5563]'}`}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-[#8c755f] mt-1.5 font-medium tracking-wide uppercase">
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
