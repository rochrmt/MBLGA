import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Injecte le token JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Déconnexion automatique si le token expire
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!location.pathname.startsWith('/login')) location.href = '/login'
    }
    // 402 = licence expirée — déconnecter et rediriger vers login avec message
    if (err.response?.status === 402 && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      sessionStorage.setItem('licence_error', err.response?.data?.error || 'Licence expirée')
      if (!location.pathname.startsWith('/login')) location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default api

// Formatage monétaire (devise configurable, FCFA par défaut)
export function formatMoney(value, devise = 'FCFA') {
  const n = Number(value) || 0
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${devise}`
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d)) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
