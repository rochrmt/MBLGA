import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Lock, Mail, Loader2, ArrowRight, MessageCircle } from 'lucide-react'
import { useAuth } from '../context/Auth'
import { useSettings } from '../context/Settings'

export default function Login() {
  const { login, user } = useAuth()
  const { appName, settings, reload } = useSettings()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [licenceError, setLicenceError] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (user && localStorage.getItem('token')) navigate('/') }, [user, navigate])

  // Show licence error if redirected from 402
  useEffect(() => {
    const le = sessionStorage.getItem('licence_error')
    if (le) {
      setError(le)
      setLicenceError(true)
      sessionStorage.removeItem('licence_error')
    }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email.trim(), password)
      await reload()
      navigate('/')
    } catch (err) {
      const isLicence = err.response?.status === 402
      setError(err.response?.data?.error || 'Connexion impossible')
      setLicenceError(isLicence)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel gauche — branding */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-slate-900 p-12 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-brand-600 text-lg font-bold text-white">
            {settings.logo
              ? <img src={settings.logo} alt="logo" className="h-full w-full object-cover" />
              : appName.charAt(0).toUpperCase()}
          </div>
          <span className="text-lg font-bold text-white">{appName}</span>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-bold leading-tight text-white">
            Gérez votre entreprise<br />en toute simplicité
          </h1>
          <p className="mt-4 max-w-md text-base text-slate-400">
            {settings.slogan || "Clients, commandes, factures, stocks et ressources humaines — tout au même endroit."}
          </p>
          <div className="mt-8 flex gap-6">
            <div>
              <p className="text-2xl font-bold text-white">100%</p>
              <p className="text-sm text-slate-500">Gestion intégrée</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">24/7</p>
              <p className="text-sm text-slate-500">Accès permanent</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">Sécurisé</p>
              <p className="text-sm text-slate-500">Données protégées</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} {settings.editeur || appName}. Tous droits réservés.</p>
        <div className="relative mt-3 flex items-center gap-2">
          <img src="/mbila-logo.png" alt="Mbila Service" className="h-14 w-auto opacity-80" />
          <span className="text-sm text-slate-500">by Mbila Service</span>
        </div>
      </div>

      {/* Panel droit — formulaire */}
      <div className="flex w-full items-center justify-center bg-slate-50 p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-brand-600 text-base font-bold text-white">
              {settings.logo
                ? <img src={settings.logo} alt="logo" className="h-full w-full object-cover" />
                : appName.charAt(0).toUpperCase()}
            </div>
            <span className="text-base font-bold text-slate-800">{appName}</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800">Bienvenue</h2>
          <p className="mb-8 mt-1 text-sm text-slate-500">Connectez-vous à votre espace de gestion.</p>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {licenceError && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800">Besoin d'aide ? Contactez le support client :</p>
              <div className="space-y-2">
                <a href="mailto:rochrmt55@gmail.com" className="flex items-center gap-2 text-sm text-amber-900 hover:text-amber-700">
                  <Mail size={16} /> rochrmt55@gmail.com
                </a>
                <div className="flex items-center gap-2 text-sm text-amber-900">
                  <MessageCircle size={16} /> WhatsApp : 72679175
                </div>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Email ou identifiant</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(var(--text-muted))' }} />
                <input type="text" className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin ou vous@entreprise.com" autoFocus required />
              </div>
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(var(--text-muted))' }} />
                <input type="password" className="input pl-10" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full text-[15px]">
              {loading
                ? <Loader2 className="animate-spin" size={18} />
                : <>Se connecter <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2">
            <img src="/mbila-logo.png" alt="Mbila Service" className="h-12 w-auto opacity-70" />
            <span className="text-sm text-slate-400">by Mbila Service</span>
          </div>
        </div>
      </div>
    </div>
  )
}
