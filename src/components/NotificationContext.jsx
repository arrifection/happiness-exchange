import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { filterNotificationsForUser } from '../lib/notificationFilters.js'
import { resolveApiBase } from '../lib/api.js'

const NotificationContext = createContext(null)

/** Visible-tab poll interval. Hidden tabs do not poll. */
const UNREAD_POLL_INTERVAL_MS = 30000

export function NotificationProvider({ token, children }) {
  const [rawNotifications, setRawNotifications] = useState([])

  const notifications = useMemo(() => filterNotificationsForUser(rawNotifications), [rawNotifications])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const unreadAbortRef = useRef(null)

  const API_BASE = resolveApiBase()

  async function fetchUnreadCount({ force = false } = {}) {
    if (!token) return
    if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return
    }

    unreadAbortRef.current?.abort()
    const controller = new AbortController()
    unreadAbortRef.current = controller

    try {
      const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(typeof data?.count === 'number' ? data.count : 0)
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
      // silent fail
    }
  }

  async function fetchNotifications() {
    if (!token) return
    try {
      setLoadingNotifications(true)
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        setRawNotifications(list)
        // Keep badge in sync immediately when dropdown content is loaded.
        const filtered = filterNotificationsForUser(list)
        setUnreadCount(filtered.filter((notification) => !notification.read).length)
      }
    } catch {
      // silent fail
    } finally {
      setLoadingNotifications(false)
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
        await fetchUnreadCount({ force: true })
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
        setUnreadCount(0)
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
        await fetchUnreadCount({ force: true })
        return true
      }
    } catch {
      // Keep the notification visible when the request fails.
    }
    return false
  }

  useEffect(() => {
    if (!token) {
      setRawNotifications([])
      setUnreadCount(0)
      unreadAbortRef.current?.abort()
      return
    }

    // Reset when switching accounts / log in.
    setRawNotifications([])
    setUnreadCount(0)

    let intervalId = null

    function stopPolling() {
      if (intervalId != null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    function startPolling() {
      stopPolling()
      intervalId = setInterval(() => {
        fetchUnreadCount()
      }, UNREAD_POLL_INTERVAL_MS)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount({ force: true })
        startPolling()
      } else {
        stopPolling()
        unreadAbortRef.current?.abort()
      }
    }

    fetchUnreadCount({ force: true })
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stopPolling()
      unreadAbortRef.current?.abort()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // fetchUnreadCount closes over token/API_BASE; re-run only when token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loadingNotifications,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

const EMPTY_NOTIFICATIONS = {
  notifications: [],
  unreadCount: 0,
  loadingNotifications: false,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  dismissNotification: async () => false,
  fetchNotifications: async () => {},
}

export function useNotifications() {
  return useContext(NotificationContext) ?? EMPTY_NOTIFICATIONS
}
