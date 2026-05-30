import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RequireRole from './components/RequireRole'
import { ROLES } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
// Layouts
import AdminLayout from './layouts/AdminLayout'

// Pages
import LoginPage         from './pages/Login'
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

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Admin Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="listings"   element={<RequireRole requiredRole={ROLES.MODERATOR}><ListingsPage /></RequireRole>} />
            <Route path="users"      element={<RequireRole requiredRole={ROLES.ADMIN}><UsersPage /></RequireRole>} />
            <Route path="requests"   element={<RequireRole requiredRole={ROLES.MODERATOR}><RequestsPage /></RequireRole>} />
            <Route path="messages" element={<RequireRole requiredRole={ROLES.MODERATOR}><MessagesPage /></RequireRole>} />
            <Route path="messages/:conversationId" element={<RequireRole requiredRole={ROLES.MODERATOR}><MessagesPage /></RequireRole>} />

            {/* Moderator+ only */}
            <Route
              path="reports"
              element={<RequireRole requiredRole={ROLES.MODERATOR}><ReportsPage /></RequireRole>}
            />
            <Route path="reviews" element={<RequireRole requiredRole={ROLES.MODERATOR}><ReviewsPage /></RequireRole>} />

            {/* Admin+ only */}
            <Route
              path="team"
              element={<RequireRole requiredRole={ROLES.SUPER_ADMIN}><TeamPage /></RequireRole>}
            />

            <Route path="courier"   element={<RequireRole requiredRole={ROLES.COURIER}><CourierPage /></RequireRole>} />
            <Route path="analytics" element={<RequireRole requiredRole={ROLES.ADMIN}><AnalyticsPage /></RequireRole>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}
