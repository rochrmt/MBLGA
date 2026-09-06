import { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from 'lucide-react'

/* ── Modal ──────────────────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, icon: Icon, children, size = 'md' }) {
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
      <div className={`card w-full ${widths[size]} my-4`}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/15 text-brand-400">
                <Icon size={18} />
              </span>
            )}
            <h2 className="text-lg font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: 'rgb(var(--text-muted))' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgb(var(--surface-2))'; e.currentTarget.style.color = 'rgb(var(--text-secondary))' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgb(var(--text-muted))' }}>
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

/* ── Carte statistique ──────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, icon: Icon, color = 'brand' }) {
  const colors = {
    brand:  'bg-brand-500/15 text-brand-400',
    green:  'bg-emerald-500/15 text-emerald-400',
    orange: 'bg-amber-500/15 text-amber-400',
    purple: 'bg-violet-500/15 text-violet-400',
    slate:  '',
    blue:   'bg-blue-500/15 text-blue-400',
    red:    'bg-red-500/15 text-red-400',
  }
  return (
    <div className="stat-card card-hover">
      {Icon && (
        <span className={`stat-icon ${colors[color]}`}>
          <Icon size={22} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgb(var(--text-muted))' }}>{label}</p>
        <p className="mt-1 text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{value}</p>
        {sub && <div className="mt-1 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{sub}</div>}
      </div>
    </div>
  )
}

/* ── Badge de statut ────────────────────────────────────────────────────── */
const STATUS_STYLES = {
  actif: 'bg-emerald-500/15 text-emerald-400',
  inactif: '',
  en_attente: 'bg-amber-500/15 text-amber-400',
  en_cours: 'bg-brand-500/15 text-brand-400',
  livree: 'bg-emerald-500/15 text-emerald-400',
  annulee: 'bg-red-500/15 text-red-400',
  brouillon: '',
  emise: 'bg-brand-500/15 text-brand-400',
  partielle: 'bg-amber-500/15 text-amber-400',
  payee: 'bg-emerald-500/15 text-emerald-400',
  paye: 'bg-emerald-500/15 text-emerald-400',
  approuve: 'bg-emerald-500/15 text-emerald-400',
  refuse: 'bg-red-500/15 text-red-400',
}
const STATUS_LABELS = {
  en_attente: 'En attente', en_cours: 'En cours', livree: 'Livrée', annulee: 'Annulée',
  brouillon: 'Brouillon', emise: 'Émise', partielle: 'Partielle', payee: 'Payée',
  paye: 'Payé', approuve: 'Approuvé', refuse: 'Refusé', actif: 'Actif', inactif: 'Inactif',
}
export function Badge({ status, children }) {
  const cls = STATUS_STYLES[status] || ''
  return <span className={`badge ${cls}`} style={!cls ? { background: 'rgb(var(--surface-2))', color: 'rgb(var(--text-secondary))' } : undefined}>{children || STATUS_LABELS[status] || status}</span>
}

/* ── État vide ──────────────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {Icon && <Icon size={44} style={{ color: 'rgb(var(--text-muted))' }} />}
      <p style={{ color: 'rgb(var(--text-secondary))' }}>{title}</p>
      {action}
    </div>
  )
}

/* ── Spinner ────────────────────────────────────────────────────────────── */
export function Spinner({ label = 'Chargement...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16" style={{ color: 'rgb(var(--text-muted))' }}>
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm">{label}</span>
    </div>
  )
}

/* ── Toasts ─────────────────────────────────────────────────────────────── */
const ToastContext = createContext(null)
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((type, message) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  const toast = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }
  const icons = { success: CheckCircle2, error: AlertTriangle, info: Info }
  const styles = {
    success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    error: 'border-red-500/30 bg-red-500/15 text-red-400',
    info: 'border-brand-500/30 bg-brand-500/15 text-brand-400',
  }
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${styles[t.type]}`}>
              <Icon size={18} />
              {t.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
export const useToast = () => useContext(ToastContext)
