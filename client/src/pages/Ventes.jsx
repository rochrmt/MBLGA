import { useState, useEffect } from 'react'
import { ShoppingBag, DollarSign, Users, Award } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import api, { formatMoney } from '../lib/api'
import { useSettings } from '../context/Settings'
import { Spinner } from '../components/ui'

const PERIODES = [
  { key: 'semaine', label: 'Semaine' }, { key: 'mois', label: 'Mois' },
  { key: 'trimestre', label: 'Trimestre' }, { key: 'annee', label: 'Année' },
]

export default function Ventes() {
  const { devise } = useSettings()
  const [periode, setPeriode] = useState('mois')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.get('/ventes', { params: { periode } })
      .then(({ data }) => { if (alive) setData(data) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [periode])

  const cards = data ? [
    { label: 'Chiffre d\'affaires', value: formatMoney(data.ca, devise), icon: ShoppingBag, color: 'bg-brand-100 text-brand-600' },
    { label: 'Commandes livrées', value: data.commandes, icon: DollarSign, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Clients uniques', value: data.clients, icon: Users, color: 'bg-violet-100 text-violet-600' },
    { label: 'Panier moyen', value: formatMoney(data.panier_moyen, devise), icon: Award, color: 'bg-amber-100 text-amber-600' },
  ] : []

  const chart = (data?.evolution || []).map((e) => ({
    jour: e.jour.slice(5), ca: e.ca,
  }))

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">Ventes</h2>
        <p className="text-sm text-slate-400">vs période précédente</p>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {PERIODES.map((p) => (
            <button key={p.key} onClick={() => setPeriode(p.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition
                ${periode === p.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((c) => (
              <div key={c.label} className="card p-5 flex flex-col items-center text-center">
                <span className={`stat-icon mb-3 ${c.color}`}><c.icon size={22} /></span>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">Évolution du CA</h3>
              <p className="text-sm text-slate-400">Tendance sur la période sélectionnée</p>
            </div>
            <div className="mt-4 h-80">
              {chart.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-slate-400">Aucune donnée pour cette période</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatMoney(v, devise)} />
                    <Bar dataKey="ca" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
