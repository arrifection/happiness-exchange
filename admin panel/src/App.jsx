import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ApiHealthProvider } from './contexts/ApiHealthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RequireRole from './components/RequireRole'
import { PERMISSIONS, defaultRouteForRole } from './lib/adminPermissions'
import { NotificationProvider } from './contexts/NotificationContext'
// Layouts
import AdminLayout from './layouts/AdminLayout'

// Pages
import LoginPage         from './pages/Login'
import AcceptInvitePage  from './pages/AcceptInvite'
import DashboardPage     from './pages/Dashboard'
import ListingsPage      from './pages/Listings'
import UsersPage         from './pages/Users'
import RequestsPage      from './pages/Requests'
import ReportsPage       from './pages/Reports'
import ReviewsPage       from './pages/Reviews'
import TeamPage          from './pages/Team'
import CourierPage       from './pages/Courier'
import AnalyticsPage     from './pages/Analytics'
import MessagesPage      from './pages/Messages'
import ExchangesPage     from './pages/Exchanges'
import ExchangeDetailPage from './pages/ExchangeDetail'
import ShippingPage      from './pages/Shipping'

function RootRedirect() {
  const { user, loading, isAuthenticated } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={defaultRouteForRole(user?.role)} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <ApiHealthProvider>
        <NotificationProvider>
          <BrowserRouter>
          <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />

          {/* Protected Admin Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RootRedirect />} />
            <Route path="dashboard" element={<RequireRole permission={PERMISSIONS.DASHBOARD}><DashboardPage /></RequireRole>} />
            <Route path="listings" element={<RequireRole permission={PERMISSIONS.LISTINGS}><ListingsPage /></RequireRole>} />
            <Route path="users" element={<RequireRole permission={PERMISSIONS.USERS}><UsersPage /></RequireRole>} />
            <Route path="requests" element={<RequireRole permission={PERMISSIONS.REQUESTS}><RequestsPage /></RequireRole>} />
            <Route path="messages" element={<RequireRole permission={PERMISSIONS.MESSAGES}><MessagesPage /></RequireRole>} />
            <Route path="reports" element={<RequireRole permission={PERMISSIONS.REPORTS}><ReportsPage /></RequireRole>} />
            <Route path="reviews" element={<RequireRole permission={PERMISSIONS.REVIEWS}><ReviewsPage /></RequireRole>} />
            <Route path="team" element={<RequireRole permission={PERMISSIONS.TEAM}><TeamPage /></RequireRole>} />
            <Route path="courier" element={<RequireRole permission={PERMISSIONS.DELIVERIES}><CourierPage /></RequireRole>} />
            <Route path="exchanges" element={<RequireRole permission={PERMISSIONS.DELIVERIES}><ExchangesPage /></RequireRole>} />
            <Route path="exchanges/:transactionId" element={<RequireRole permission={PERMISSIONS.DELIVERIES}><ExchangeDetailPage /></RequireRole>} />
            <Route path="shipping" element={<RequireRole permission={PERMISSIONS.DELIVERIES}><ShippingPage /></RequireRole>} />
            <Route path="analytics" element={<RequireRole permission={PERMISSIONS.ANALYTICS}><AnalyticsPage /></RequireRole>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
        </BrowserRouter>
        </NotificationProvider>
      </ApiHealthProvider>
    </AuthProvider>
  )
}
