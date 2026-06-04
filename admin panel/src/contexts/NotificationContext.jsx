import React, { createContext, useContext, useEffect, useState } from 'react'
import { notificationsApi } from '../lib/api'
import { useAuth } from './AuthContext'

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  fetchNotifications: async () => {},
})

function normalizeNotifications(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.notifications)) return payload.notifications
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function fetchNotifications() {
    if (!user) return
    try {
      const res = await notificationsApi.list()
      const items = normalizeNotifications(res.data)
      setNotifications(items)
      setUnreadCount(items.filter((n) => !n.read).length)
    } catch {
      setNotifications([])
      setUnreadCount(0)
    }
  }

  async function markAsRead(id) {
    if (!user) return
    try {
      await notificationsApi.markAsRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silent
    }
  }

  async function markAllAsRead() {
    if (!user) return
    try {
      await notificationsApi.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    fetchNotifications()
    if (!user) return undefined
    const interval = setInterval(fetchNotifications, 15000)
    return () => clearInterval(interval)
  }, [user])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
