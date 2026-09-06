import { useState, useEffect } from 'react'
import { History, RefreshCw, Search } from 'lucide-react'
import api, { formatDateTime } from '../lib/api'
import { Spinner, EmptyState } from '../components/ui'

export default function Journal() {
  const [data, setData] = useState({ evenements: [], stats: {}, modules: [] })
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [module, setModule] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/journal', { params: { q: q || undefined, module: module || undefined } })
      setData(data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [module])
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [q])

  const s = data.stats || {}
  const cards = [
    { label: "Aujourd'hui", value: s.aujourdhui || 0, sub: 'actions enregistrées', color: '' },
    { label: '7 jours', value: s.auth_7j || 0, sub: 'Authentification', tag: 'bg-slate-100 text-slate-600' },
    { label: '7 jours', value: s.clients_7j || 0, sub: 'Clients', tag: 'bg-brand-100 text-brand-600' },
    { label: '7 jours', value: s.personnel_7j || 0, sub: 'Personnel', tag: 'bg-red-100 text-red-700' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-800 text-white"><History size={20} /></span>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Historique des activités</h2>
            <p className="text-sm text-slate-400">Suivi de toutes les actions effectuées dans l'application</p>
          </div>
          <button onClick={load} className="ml-auto btn-secondary"><RefreshCw size={16} /> Actualiser</button>
        </div>

        <div className="card flex flex-wrap gap-3 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher (description, utilisateur)..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto" value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="">Tous les modules</option>
            {data.modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div key={i} className="card p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-0.5 text-xl font-bold text-slate-800">{c.value}</p>
              {c.tag ? <span className={`badge mt-1 ${c.tag}`}>{c.sub}</span> : <p className="mt-0.5 text-xs text-slate-400">{c.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-bold text-slate-800">
          <History size={17} /> Événements <span className="badge bg-slate-100 text-slate-600">{data.evenements.length}</span>
        </div>
        {loading ? <Spinner /> : data.evenements.length === 0 ? <EmptyState icon={History} title="Aucun événement" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="table-th">Date / Heure</th><th className="table-th">Utilisateur</th><th className="table-th">Module</th><th className="table-th">Action</th><th className="table-th">Description</th></tr></thead>
              <tbody>
                {data.evenements.map((e) => (
                  <tr key={e.id} className="table-row-hover">
                    <td className="table-td text-slate-500">{formatDateTime(e.date_action)}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{(e.utilisateur_nom || '?')[0].toUpperCase()}</span>
                        <span className="font-medium text-slate-700">{e.utilisateur_nom || 'Système'}</span>
                      </div>
                    </td>
                    <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{e.module}</span></td>
                    <td className="table-td text-slate-600">{e.action}</td>
                    <td className="table-td text-slate-500">{e.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
