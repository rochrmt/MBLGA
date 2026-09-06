import { useState, useEffect } from 'react'
import {
  TrendingUp, FileText, Users, CheckCircle2, Tag, Boxes, Download, AlertCircle,
  FileCheck, Eye, Clock, Upload, Trash2,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import api, { formatMoney, formatDateTime } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { Modal, Spinner, useToast } from '../components/ui'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const TABS = [
  { key: 'synthese', label: 'Synthèse annuelle', icon: TrendingUp },
  { key: 'categories', label: 'Par catégorie', icon: Tag },
  { key: 'stock', label: 'Stock & Inventaire', icon: Boxes },
  { key: 'clients', label: 'Analyse clients', icon: Users },
  { key: 'employes', label: 'Rapports Employés', icon: FileCheck },
]

export default function Rapports() {
  const { devise } = useSettings()
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('synthese')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  useEffect(() => {
    if (tab === 'employes') return
    let alive = true
    setLoading(true)
    setError(null)
    setData(null)
    const url = tab === 'stock' ? '/rapports/stock' : `/rapports/${tab}`
    api.get(url, { params: tab === 'stock' ? {} : { annee } })
      .then(({ data }) => { if (alive) setData(data) })
      .catch((err) => { if (alive) setError(err.response?.data?.error || 'Erreur lors du chargement du rapport') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tab, annee])

  const exportCSV = () => {
    let rows = []
    if (tab === 'synthese' && data?.mensuel) rows = [['Mois', 'CA'], ...data.mensuel.map((m) => [MONTHS[m.mois - 1], m.ca])]
    if (tab === 'categories' && Array.isArray(data)) rows = [['Catégorie', 'CA', 'Quantité'], ...data.map((c) => [c.categorie, c.ca, c.quantite])]
    if (tab === 'stock' && data?.produits) rows = [['Code', 'Produit', 'Stock', 'Valeur'], ...data.produits.map((p) => [p.code, p.nom, p.stock, p.valeur])]
    if (tab === 'clients' && Array.isArray(data)) rows = [['Client', 'Commandes', 'CA'], ...data.map((c) => [c.nom, c.nb_commandes, c.ca])]
    if (rows.length === 0) return
    const csv = rows.map((r) => r.map(String).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `rapport-${tab}-${annee}.csv`; a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => { setData(null); setTab(t.key) }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition
              ${tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Statistiques & Rapports</h2>
          <p className="text-sm text-slate-400">Analyse de l'activité commerciale</p>
        </div>
        {tab !== 'stock' && (
          <select className="input w-auto" value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {tab === 'employes' ? (
        <RapportsEmployes />
      ) : loading ? <Spinner /> : error ? (
        <div className="card p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm text-slate-600">{error}</p>
            <button type="button" onClick={() => setTab(tab)} className="btn-secondary py-2">Réessayer</button>
          </div>
        </div>
      ) : (
        <>
          {tab === 'synthese' && data?.mensuel && <Synthese data={data} annee={annee} devise={devise} onExport={exportCSV} />}
          {tab === 'categories' && <ListReport title={`Ventes par catégorie ${annee}`} onExport={exportCSV}
            cols={['Catégorie', 'Quantité', 'CA']} rows={(Array.isArray(data) ? data : []).map((c) => [c.categorie, c.quantite, formatMoney(c.ca, devise)])} empty="Aucune vente" />}
          {tab === 'stock' && data?.produits && <Stock data={data} devise={devise} onExport={exportCSV} />}
          {tab === 'clients' && <ListReport title={`Meilleurs clients ${annee}`} onExport={exportCSV}
            cols={['Client', 'Commandes', 'CA']} rows={(Array.isArray(data) ? data : []).map((c) => [c.nom, c.nb_commandes, formatMoney(c.ca, devise)])} empty="Aucun client" />}
        </>
      )}
    </div>
  )
}

function Synthese({ data, annee, devise, onExport }) {
  const cards = [
    { label: 'CA livré', value: formatMoney(data.ca_livre, devise), icon: TrendingUp, color: 'bg-brand-100 text-brand-600' },
    { label: 'Commandes', value: data.commandes, sub: `${data.commandes_livrees} livrée(s)`, icon: FileText, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Clients actifs', value: data.clients_actifs, icon: Users, color: 'bg-violet-100 text-violet-600' },
    { label: 'Taux livraison', value: `${data.taux_livraison}%`, sub: `${data.commandes_annulees} annulée(s)`, icon: CheckCircle2, color: 'bg-amber-100 text-amber-600' },
  ]
  const chart = Array.from({ length: 12 }, (_, i) => {
    const m = data.mensuel.find((x) => x.mois === i + 1)
    return { mois: MONTHS[i], ca: m ? m.ca : 0 }
  })
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="stat-card card-hover">
            <span className={`stat-icon ${c.color}`}><c.icon size={22} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{c.value}</p>
              {c.sub && <p className="text-xs text-slate-400">{c.sub}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Chiffre d'affaires mensuel {annee}</h3>
          <button type="button" onClick={onExport} className="btn-secondary py-2"><Download size={15} /> Exporter CSV</button>
        </div>
        <div className="h-80">
          {data.ca_livre === 0 ? (
            <div className="grid h-full place-items-center text-sm text-slate-400">Aucune donnée pour {annee}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatMoney(v, devise)} />
                <Bar dataKey="ca" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  )
}

function Stock({ data, devise, onExport }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valeur totale du stock</p><p className="mt-1 text-2xl font-bold text-slate-800">{formatMoney(data.valeur_totale, devise)}</p></div>
        <div className="card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Articles en alerte</p><p className="mt-1 text-2xl font-bold text-amber-600">{data.alertes}</p></div>
      </div>
      <ListReport title="Inventaire" onExport={onExport}
        cols={['Code', 'Produit', 'Stock', 'Seuil', 'Valeur']}
        rows={data.produits.map((p) => [p.code, p.nom, p.stock, p.stock_min, formatMoney(p.valeur, devise)])} empty="Aucun produit" />
    </>
  )
}

function ListReport({ title, cols, rows, empty, onExport }) {
  return (
    <div className="table-wrap">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        <button type="button" onClick={onExport} className="btn-secondary py-2"><Download size={15} /> Exporter CSV</button>
      </div>
      <div className="overflow-x-auto">
        {rows.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">{empty}</p> : (
          <table className="w-full">
            <thead><tr>{cols.map((c, i) => <th key={i} className={`table-th ${i >= 2 ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="table-row-hover">
                  {r.map((v, j) => <td key={j} className={`table-td ${j >= 2 ? 'text-right font-semibold text-slate-800' : ''} ${j === 0 ? 'text-xs text-slate-400' : 'text-slate-600'}`}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function RapportsEmployes() {
  const { isAdmin, user } = useAuth()
  const toast = useToast()
  const [rapports, setRapports] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titre: '', periode: '', description: '' })
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/rapports-employes')
      setRapports(data)
    } catch { /* */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const download = async (id, nom) => {
    try {
      const res = await api.get(`/rapports-employes/${id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = nom; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erreur lors du téléchargement') }
  }

  const markRead = async (id) => {
    try { await api.put(`/rapports-employes/${id}/lu`); load() } catch { /* */ }
  }

  const remove = async (id) => {
    if (!confirm('Supprimer ce rapport ?')) return
    try { await api.delete(`/rapports-employes/${id}`); toast.success('Rapport supprimé'); load() }
    catch { toast.error('Erreur') }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!file) { toast.error('Veuillez sélectionner un fichier'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('titre', form.titre)
      fd.append('periode', form.periode)
      fd.append('description', form.description)
      fd.append('fichier', file)
      await api.post('/rapports-employes/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Rapport envoyé avec succès')
      setModal(false)
      setForm({ titre: '', periode: '', description: '' })
      setFile(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || "Erreur lors de l'envoi")
    } finally {
      setUploading(false)
    }
  }

  const nonLus = rapports.filter(r => !r.lu_admin).length

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {isAdmin ? 'Rapports d\'activité des employés' : 'Mes rapports d\'activité'}
          </h2>
          <p className="text-sm text-slate-400">
            {isAdmin ? `${rapports.length} rapport(s) — ${nonLus} non lu(s)` : `${rapports.length} rapport(s) envoyé(s)`}
          </p>
        </div>
        {!isAdmin && (
          <button type="button" onClick={() => setModal(true)} className="btn-primary">
            <Upload size={18} /> Nouveau rapport
          </button>
        )}
      </div>

      {isAdmin && nonLus > 0 && (
        <div className="card flex items-center gap-3 border-l-4 border-l-amber-400 bg-amber-50 p-4">
          <Clock size={20} className="text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">{nonLus} nouveau(x) rapport(s) non lu(s)</p>
        </div>
      )}

      <div className="table-wrap">
        <div className="overflow-x-auto">
          {rapports.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400"><FileCheck size={30} /></span>
              <p className="text-sm text-slate-500">
                {isAdmin ? 'Aucun rapport d\'employé pour le moment' : 'Aucun rapport envoyé pour le moment'}
              </p>
              {!isAdmin && (
                <button type="button" onClick={() => setModal(true)} className="btn-primary mt-2">
                  <Upload size={18} /> Envoyer mon premier rapport
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  {isAdmin && <th className="table-th">Employé</th>}
                  <th className="table-th">Titre</th>
                  <th className="table-th">Période</th>
                  <th className="table-th">Fichier</th>
                  <th className="table-th">Date</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rapports.map((r) => (
                  <tr key={r.id} className={`table-row-hover ${!r.lu_admin ? 'bg-amber-50/40' : ''}`}>
                    {isAdmin && <td className="table-td font-semibold text-slate-800">{r.employe_nom}</td>}
                    <td className="table-td">
                      <p className="font-semibold text-slate-800">{r.titre}</p>
                      {r.description && <p className="text-xs text-slate-400">{r.description}</p>}
                    </td>
                    <td className="table-td text-slate-600">{r.periode || '—'}</td>
                    <td className="table-td text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><FileText size={14} /> {r.nom_original}</span>
                    </td>
                    <td className="table-td text-slate-500">{formatDateTime(r.date_upload)}</td>
                    <td className="table-td">
                      {r.lu_admin ? (
                        <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 size={13} /> Lu</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-700"><Clock size={13} /> Nouveau</span>
                      )}
                    </td>
                    <td className="table-td text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => download(r.id, r.nom_original)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Télécharger">
                          <Download size={16} />
                        </button>
                        {isAdmin && !r.lu_admin && (
                          <button type="button" onClick={() => markRead(r.id)} className="rounded-lg p-2 text-brand-600 hover:bg-brand-50" title="Marquer comme lu">
                            <Eye size={16} />
                          </button>
                        )}
                        {!isAdmin && (
                          <button type="button" onClick={() => remove(r.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Supprimer">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {!isAdmin && (
        <Modal open={modal} onClose={() => setModal(false)} title="Envoyer un rapport d'activité" icon={Upload} size="md">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Titre du rapport *</label>
              <input className="input" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} required placeholder="Ex: Rapport mensuel Juillet 2026" autoFocus />
            </div>
            <div>
              <label className="label">Période</label>
              <input className="input" value={form.periode} onChange={(e) => setForm({ ...form, periode: e.target.value })} placeholder="Ex: Juillet 2026, Semaine 30, Q3 2026..." />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Résumé de votre activité..." />
            </div>
            <div>
              <label className="label">Fichier * (PDF, Word, Excel — 20 Mo max)</label>
              <input type="file" className="input" onChange={(e) => setFile(e.target.files[0])} required />
              {file && <p className="mt-1 text-xs text-slate-500">{file.name} ({(file.size / 1024).toFixed(0)} Ko)</p>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button>
              <button type="submit" disabled={uploading} className="btn-primary flex-1">
                {uploading ? 'Envoi...' : <><Upload size={17} /> Envoyer</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
