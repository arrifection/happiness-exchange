import { createContext, useContext, useEffect, useState } from 'react'

const NotificationContext = createContext(null)

import { resolveApiBase } from '../lib/api.js'

export function NotificationProvider({ token, children }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const API_BASE = resolveApiBase()

  async function fetchNotifications() {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        setNotifications(list)
        setUnreadCount(list.filter((n) => !n.read).length)
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
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
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
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    fetchNotifications()
    if (token) {
      const interval = setInterval(fetchNotifications, 15000)
      return () => clearInterval(interval)
    }
  }, [token])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  )
}

const EMPTY_NOTIFICATIONS = {
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  fetchNotifications: async () => {},
}

export function useNotifications() {
  return useContext(NotificationContext) ?? EMPTY_NOTIFICATIONS
}
