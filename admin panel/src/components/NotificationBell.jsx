import React, { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'
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
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent transition-all duration-200 ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 rounded-xl bg-white shadow-lg ring-1 ring-slate-200 z-50 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={() => markAllAsRead()}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-[100px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 text-slate-300">
                  <Bell size={24} />
                </div>
                <p className="text-sm font-medium text-slate-500">No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map((notif) => (
                  <li 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`group flex items-start gap-3 p-4 transition-colors cursor-pointer ${notif.read ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/50 hover:bg-indigo-50'}`}
                  >
                    <div className="mt-1 flex-shrink-0">
                      {!notif.read && <div className="h-2 w-2 rounded-full bg-indigo-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notif.read ? 'text-slate-800 font-medium' : 'text-slate-900 font-bold'}`}>
                        {notif.title}
                      </p>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${notif.read ? 'text-slate-500' : 'text-slate-600'}`}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-medium tracking-wide uppercase">
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
