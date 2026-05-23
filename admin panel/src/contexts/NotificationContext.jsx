import React, { createContext, useContext, useEffect, useState } from 'react'
import { notificationsApi } from '../lib/api'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function fetchNotifications() {
    if (!user) return
    try {
      const res = await notificationsApi.list()
      setNotifications(res.data)
      setUnreadCount(res.data.filter(n => !n.read).length)
    } catch {
      // silent
    }
  }

  async function markAsRead(id) {
    if (!user) return
    try {
      await notificationsApi.markAsRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // silent
    }
  }

  async function markAllAsRead() {
    if (!user) return
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    fetchNotifications()
    if (user) {
      const interval = setInterval(fetchNotifications, 15000)
      return () => clearInterval(interval)
    }
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
