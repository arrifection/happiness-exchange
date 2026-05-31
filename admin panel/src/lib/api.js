import axios from 'axios'
import { API_BASE_URL } from './env'
import { STATUS_ENDPOINT } from './backend'

const BASE_URL = API_BASE_URL

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Request interceptor: attach JWT token ─────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── Response interceptor: handle 401 globally ────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api

// ── Auth endpoints ─────────────────────────────────────────────────────────────
export const authApi = {
  // Admin panel uses its own login endpoint — rejects non-admin roles with 403
  login:   (data) => api.post('/api/admin/auth/login', data),
  me:      ()     => api.get('/api/me'),
  refresh: ()     => api.post('/api/auth/refresh'),
}

// ── Users endpoints (Admin) ───────────────────────────────────────────────────
export const usersApi = {
  list:    (params) => api.get('/api/admin/users', { params }),
  getById: (id)     => api.get(`/api/admin/users/${id}`),
  update:  (id, d) => api.put(`/api/admin/users/${id}`, d),
  delete:  (id)    => api.delete(`/api/admin/users/${id}`),
  ban:     (id)    => api.patch(`/api/admin/users/${id}/ban`),
  unban:   (id)    => api.patch(`/api/admin/users/${id}/unban`),
  changeRole: (id, role) => api.patch(`/api/admin/users/${id}/role`, { role }),
  trustPenalty: (id, data) => api.post(`/api/admin/users/${id}/trust-penalty`, data),
}

// ── Items / Listings endpoints (Admin) ────────────────────────────────────────
export const itemsApi = {
  list:    (params) => api.get('/api/admin/items', { params }),
  getById: (id)     => api.get(`/api/admin/items/${id}`),
  update:  (id, d) => api.put(`/api/admin/items/${id}`, d),
  delete:  (id)    => api.delete(`/api/admin/items/${id}`),
  approve: (id)    => api.post(`/api/admin/items/${id}/approve`),
}

// ── Requests endpoints (Admin) ────────────────────────────────────────────────
// Calls /api/admin/requests — lists ALL platform requests with enriched data.
// Moderator+ required.
export const requestsApi = {
  list:    (params) => api.get('/api/admin/requests', { params }),
  getById: (id)     => api.get(`/api/admin/requests/${id}`),
}

// ── Reviews endpoints (Admin) ─────────────────────────────────────────────────
export const reviewsApi = {
  list:    (params) => api.get('/api/admin/reviews', { params }),
  getById: (id)     => api.get(`/api/admin/reviews/${id}`),
  delete:  (id)    => api.delete(`/api/admin/reviews/${id}`),
}

// ── Reports endpoints (Admin) ─────────────────────────────────────────────────
export const reportsApi = {
  list:    (params) => api.get('/api/admin/reports', { params }),
  create:  (data)   => api.post('/api/admin/reports', data),
  resolve: (id)     => api.patch(`/api/admin/reports/${id}/resolve`),
  dismiss: (id)     => api.patch(`/api/admin/reports/${id}/dismiss`),
}

// ── Team endpoints (Admin) ────────────────────────────────────────────────────
export const teamApi = {
  list:       ()              => api.get('/api/admin/team'),
  invite:     (data)          => api.post('/api/admin/team/invite', data),
  changeRole: (id, role)      => api.patch(`/api/admin/team/${id}/role`, { role }),
  remove:     (id)             => api.delete(`/api/admin/team/${id}`),
}

// ── Analytics endpoints (Admin) ───────────────────────────────────────────────
export const analyticsApi = {
  summary:  ()       => api.get('/api/admin/analytics/summary'),
  auditLog: (params) => api.get('/api/admin/analytics/audit', { params }),
}

// ── Conversations endpoints ────────────────────────────────────────────────────
export const conversationsApi = {
  messages: (id) => api.get(`/api/conversations/${id}/messages`),
  sendMessage: (id, data) => api.post(`/api/conversations/${id}/message`, data),
}

// ── Admin mediated messaging ───────────────────────────────────────────────────
export const adminConversationsApi = {
  listExchanges: (params) => api.get('/api/admin/conversations', { params }),
  repair: (requestId) => api.post(`/api/admin/conversations/${requestId}/repair`),
}

// ── Notifications endpoints ──────────────────────────────────────────────────
export const notificationsApi = {
  list:        (params) => api.get('/api/notifications', { params }),
  unreadCount: ()       => api.get('/api/notifications/unread-count'),
  markAsRead:  (id)     => api.patch(`/api/notifications/${id}/read`),
  markAllRead: ()       => api.patch('/api/notifications/read-all'),
}

// ── Deliveries endpoints (Admin / Courier) ────────────────────────────────────
export const deliveriesApi = {
  list: () => api.get('/api/admin/deliveries'),
  updateStatus: (id, status) =>
    api.patch(`/api/admin/deliveries/${id}/status`, { status }),
  uploadProof: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.patch(`/api/admin/deliveries/${id}/proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ── Status endpoint ────────────────────────────────────────────────────────────
export const statusApi = {
  // Trailing slash avoids HF 307 redirect to http:// (breaks HTTPS admin panel).
  check: () => api.get(STATUS_ENDPOINT, { timeout: 15000 }),
}
