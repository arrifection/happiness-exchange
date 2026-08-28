import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { filterNotificationsForUser } from '../lib/notificationFilters.js'
import { resolveApiBase } from '../lib/api.js'

const NotificationContext = createContext(null)

export function NotificationProvider({ token, children }) {
  const [rawNotifications, setRawNotifications] = useState([])

  const notifications = useMemo(
    () => filterNotificationsForUser(rawNotifications),
    [rawNotifications],
  )

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  )

  const API_BASE = resolveApiBase()

  async function fetchNotifications() {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setRawNotifications(Array.isArray(data) ? data : [])
      }
    } catch {
      // silent fail
    }
  }

  async function markAsRead(id) {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setRawNotifications((prev) =>
          prev.map((notification) =>
            notification.id === id ? { ...notification, read: true } : notification,
          ),
        )
      }
    } catch {
      // silent
    }
  }

  async function markAllAsRead() {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setRawNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
      }
    } catch {
      // silent
    }
  }

  async function dismissNotification(id) {
    if (!token) return false
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setRawNotifications((prev) => prev.filter((notification) => notification.id !== id))
        return true
      }
    } catch {
      // Keep the notification visible when the request fails.
    }
    return false
  }

  useEffect(() => {
    fetchNotifications()
    if (token) {
      const interval = setInterval(fetchNotifications, 15000)
      return () => clearInterval(interval)
    }
  }, [token])

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, fetchNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

const EMPTY_NOTIFICATIONS = {
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  dismissNotification: async () => false,
  fetchNotifications: async () => {},
}

export function useNotifications() {
  return useContext(NotificationContext) ?? EMPTY_NOTIFICATIONS
}
