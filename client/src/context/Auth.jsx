import { createContext, useContext, useState, useCallback } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    location.href = '/login'
  }, [])

  // permissions === null  => accès complet (admin / super_admin)
  const hasModule = useCallback((key) => {
    if (!user) return false
    if (user.permissions == null) return true
    return user.permissions.includes(key)
  }, [user])

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  // Droit de suppression : admin/super_admin automatiquement, ou user avec permission 'can_delete'
  const canDelete = isAdmin || (user?.permissions?.includes('can_delete') ?? false)

  // Droit d'impression : admin/super_admin automatiquement, ou user avec permission 'can_print'
  const canPrint = isAdmin || (user?.permissions?.includes('can_print') ?? false)

  // Peut approvisionner la petite caisse : admin/super_admin ou poste='comptable'
  const canApprovisionner = isAdmin || user?.poste === 'comptable'

  return (
    <AuthContext.Provider value={{ user, login, logout, hasModule, isAdmin, canDelete, canPrint, canApprovisionner }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
