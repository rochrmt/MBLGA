import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, Boxes, ShoppingCart, TrendingUp, Wallet,
  FileText, BarChart3, Settings, UserCog, History, Search, Bell,
  LogOut, X, Menu, AlertTriangle, ChevronDown, Sun, Moon,
} from 'lucide-react'
import { useAuth } from '../context/Auth'
import { useSettings } from '../context/Settings'
import { useTheme, THEME_PRESETS } from '../context/Theme'
import api from '../lib/api'

const NAV = [
  { to: '/',            label: "Vue d'ensemble",   icon: LayoutDashboard, key: 'dashboard' },
  { to: '/clients',     label: 'Clients',          icon: Users,           key: 'clients' },
  { to: '/produits',    label: 'Articles',         icon: Boxes,           key: 'produits' },
  { to: '/commandes',   label: 'Commandes',        icon: ShoppingCart,    key: 'commandes' },
  { to: '/ventes',      label: 'Ventes',           icon: TrendingUp,      key: 'ventes' },
  { to: '/caisse',      label: 'Encaissements',    icon: Wallet,          key: 'caisse' },
  { to: '/facturation', label: 'Factures & Devis', icon: FileText,        key: 'facturation' },
  { to: '/personnel',   label: 'Gestion RH',       icon: UserCog,         key: 'personnel' },
  { to: '/rapports',    label: 'Statistiques',     icon: BarChart3,       key: 'rapports' },
  { to: '/journal',     label: 'Historique',       icon: History,         key: 'journal' },
]

const TITLES = {
  '/': "Vue d'ensemble", '/clients': 'Gestion des clients', '/produits': 'Catalogue des articles',
  '/commandes': 'Gestion des commandes', '/ventes': 'Suivi des ventes', '/caisse': 'Encaissements',
  '/facturation': 'Factures & Devis', '/personnel': 'Gestion des ressources humaines', '/rapports': 'Statistiques & Rapports',
  '/journal': 'Historique des activités', '/parametres': 'Configuration',
}

export default function Layout() {
  const { user, logout, hasModule, isAdmin } = useAuth()
  const { appName, settings } = useSettings()
  const { mode, setMode } = useTheme()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const title = TITLES[location.pathname] || Object.entries(TITLES)
    .find(([p]) => p !== '/' && location.pathname.startsWith(p))?.[1] || appName

  const visibleNav = NAV.filter((n) => hasModule(n.key))
  const initial = (user?.nom || user?.username || '?').charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'rgb(var(--bg))' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 flex-shrink-0 flex-col text-slate-300
        transition-transform lg:static lg:flex ${mobileOpen ? 'flex translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'rgb(var(--sidebar))' }}>
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-brand-600 text-base font-bold text-white">
            {settings.logo
              ? <img src={settings.logo} alt="logo" className="h-full w-full object-cover" />
              : (appName.charAt(0).toUpperCase())}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-white">{appName}</p>
            {settings.editeur && <p className="truncate text-xs" style={{ color: 'rgb(var(--text-muted))' }}>par {settings.editeur}</p>}
          </div>
        </div>

        <p className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>Menu principal</p>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`}>
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}

          {(isAdmin || hasModule('parametres')) && (
            <>
              <div className="my-2 border-t" style={{ borderColor: 'rgb(var(--sidebar-hover) / 0.6)' }} />
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>Système</p>
              <NavLink to="/parametres" onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`}>
                <Settings size={18} />
                Configuration
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3 border-t px-3 py-3.5" style={{ borderColor: 'rgb(var(--sidebar-hover) / 0.6)' }}>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.nom}</p>
            <p className="truncate text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{user?.email}</p>
          </div>
          <button onClick={logout} title="Déconnexion"
            className="rounded-lg p-2 hover:text-white" style={{ color: 'rgb(var(--text-muted))' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(var(--sidebar-hover))'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b px-5 py-3 sm:px-6" style={{ background: 'rgb(var(--surface))', borderColor: 'rgb(var(--border) / 0.8)' }}>
          <button className="lg:hidden" style={{ color: 'rgb(var(--text-secondary))' }} onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
          <h1 className="truncate text-[16px] font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            <GlobalSearch />
            <button onClick={() => {
              const idx = THEME_PRESETS.findIndex(t => t.key === mode)
              const next = THEME_PRESETS[(idx + 1) % THEME_PRESETS.length]
              setMode(next.key)
            }} className="rounded-lg p-2 transition" style={{ color: 'rgb(var(--text-secondary))' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(var(--surface-2))'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title={`Thème : ${THEME_PRESETS.find(t => t.key === mode)?.label || 'Clair'}`}>
              {mode === 'dark' || mode === 'blue-night' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Notifications />
          </div>
        </header>
        <LicenceBanner />
        <main className="flex-1 overflow-y-auto p-5 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/* ── Bannière d'alerte licence ─────────────────────────────────────────── */
function LicenceBanner() {
  const [info, setInfo] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    api.get('/licence/info').then(({ data }) => setInfo(data)).catch(() => setInfo(null))
  }, [])

  if (!info || dismissed) return null

  const daysLeft = info.jours_restants
  const isExpired = !info.valid && info.expired
  const isWarning = info.valid && daysLeft != null && daysLeft <= 30

  if (!isExpired && !isWarning) return null

  const couleur = isExpired
    ? 'bg-red-600 text-white'
    : daysLeft <= 7
      ? 'bg-red-500 text-white'
      : 'bg-amber-500 text-white'

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 sm:px-6 ${couleur}`}>
      <AlertTriangle size={18} className="shrink-0" />
      <p className="flex-1 text-sm font-medium">
        {isExpired
          ? `Licence expirée le ${info.expiration}. L'application sera bientôt bloquée.`
          : `Licence expire dans ${daysLeft} jour(s) (${info.expiration}). Pensez à la renouveler.`}
      </p>
      <Link to="/parametres" state={{ section: 'apropos' }} className="rounded-md bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30">
        Renouveler
      </Link>
      <button onClick={() => setDismissed(true)} className="rounded-md p-1 hover:bg-white/20">
        <X size={16} />
      </button>
    </div>
  )
}

/* ── Recherche globale (Ctrl+K) ─────────────────────────────────────────── */
function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  useEffect(() => {
    if (!q.trim()) { setResults(null); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/search', { params: { q } })
        setResults(data)
      } catch { setResults(null) }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const go = (path) => { setOpen(false); setQ(''); setResults(null); navigate(path) }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm sm:flex sm:w-72"
        style={{ background: 'rgb(var(--surface-2))', color: 'rgb(var(--text-muted))' }}>
        <Search size={16} />
        <span className="flex-1 text-left">Rechercher...</span>
        <kbd className="rounded px-1.5 py-0.5 text-xs font-semibold shadow-sm" style={{ background: 'rgb(var(--surface))', color: 'rgb(var(--text-secondary))' }}>Ctrl+K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="rounded-lg p-2 sm:hidden" style={{ color: 'rgb(var(--text-secondary))' }}>
        <Search size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'rgb(var(--border))' }}>
              <Search size={18} style={{ color: 'rgb(var(--text-muted))' }} />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un client, produit, commande, facture..."
                className="flex-1 text-sm outline-none" style={{ background: 'transparent', color: 'rgb(var(--text-primary))' }} />
              <button onClick={() => setOpen(false)}><X size={18} style={{ color: 'rgb(var(--text-muted))' }} /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {!results && <p className="px-3 py-6 text-center text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Tapez pour rechercher…</p>}
              {results && (
                <SearchResults results={results} go={go} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SearchResults({ results, go }) {
  const groups = [
    { key: 'clients', label: 'Clients', path: '/clients', render: (r) => r.nom },
    { key: 'produits', label: 'Produits', path: '/produits', render: (r) => r.nom },
    { key: 'commandes', label: 'Commandes', path: '/commandes', render: (r) => `${r.numero} · ${r.client_nom || ''}` },
    { key: 'factures', label: 'Factures', path: '/facturation', render: (r) => `${r.numero} · ${r.client_nom || ''}` },
  ]
  const empty = groups.every((g) => !results[g.key]?.length)
  if (empty) return <p className="px-3 py-6 text-center text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Aucun résultat</p>
  return groups.map((g) => (results[g.key]?.length ? (
    <div key={g.key} className="mb-2">
      <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgb(var(--text-muted))' }}>{g.label}</p>
      {results[g.key].map((r) => (
        <button key={r.id} onClick={() => go(g.path)}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm" style={{ color: 'rgb(var(--text-secondary))' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(var(--surface-2))'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          {g.render(r)}
        </button>
      ))}
    </div>
  ) : null))
}

/* ── Notifications ──────────────────────────────────────────────────────── */
function Notifications() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ count: 0, alertes: [] })
  const navigate = useNavigate()

  const load = async () => {
    try { const { data } = await api.get('/notifications'); setData(data) } catch { /* ignore */ }
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [])

  const niveaux = {
    danger: 'border-l-red-500 bg-red-50', warning: 'border-l-amber-500 bg-amber-50', info: 'border-l-brand-500 bg-brand-50',
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2" style={{ color: 'rgb(var(--text-secondary))' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(var(--surface-2))'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <Bell size={20} />
        {data.count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {data.count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 card overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'rgb(var(--border))' }}>
              <div className="flex items-center gap-2 font-bold" style={{ color: 'rgb(var(--text-primary))' }}><Bell size={16} /> Notifications</div>
              <button onClick={() => setOpen(false)}><X size={16} style={{ color: 'rgb(var(--text-muted))' }} /></button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data.alertes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"><Bell size={24} /></span>
                  <p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Tout va bien !</p>
                  <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Aucune alerte en cours.</p>
                </div>
              ) : data.alertes.map((a, i) => (
                <button key={i} onClick={() => { setOpen(false); navigate(a.lien) }}
                  className={`block w-full border-l-4 px-4 py-3 text-left hover:brightness-95 ${niveaux[a.niveau] || niveaux.info}`}>
                  <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{a.titre}</p>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{a.message}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
