import { Navigate } from 'react-router-dom'

import AppBootSkeleton from './AppBootSkeleton.jsx'

export default function RequireAuth({ token, currentUser, loadingUser, children }) {
  const isResolving = loadingUser || (Boolean(token) && !currentUser)

  if (isResolving) {
    return <AppBootSkeleton />
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  return children
}
