import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { token, loading } = useAuth()

  if (loading) return null
  if (!token) return <Navigate to="/login" replace />

  return <Outlet />
}
