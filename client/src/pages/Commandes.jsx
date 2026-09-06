import { useState, useEffect, useMemo } from 'react'
import {
  ShoppingCart, Plus, Wallet, Clock, AlertCircle, Search, Trash2, Save,
} from 'lucide-react'
import api, { formatMoney, formatDate } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { StatCard, Badge, Modal, Spinner, EmptyState, useToast } from '../components/ui'

const TABS = [
  { key: 'toutes', label: 'Toutes' }, { key: 'en_attente', label: 'En attente' },
  { key: 'en_cours', label: 'En cours' }, { key: 'livree', label: 'Livrées' },
  { key: 'annulee', label: 'Annulées' },
]
const NEXT = { en_attente: 'en_cours', en_cours: 'livree' }

export default function Commandes() {
  const { devise } = useSettings()
  const { canDelete } = useAuth()
  const toast = useToast()
  const [commandes, setCommandes] = useState([])
  const [clients, setClients] = useState([])
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('toutes')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [clientId, setClientId] = useState('')
  const [notes, setNotes] = useState('')
  const [lignes, setLignes] = useState([{ produit_id: '', quantite: 1, prix_unitaire: 0, remise: 0 }])

  const load = async () => {
    setLoading(true)
    try {
      const [cmd, cl, pr] = await Promise.all([
        api.get('/commandes'), api.get('/clients'), api.get('/produits'),
      ])
      setCommandes(cmd.data); setClients(cl.data); setProduits(pr.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return commandes.filter((c) => {
      const okTab = tab === 'toutes' || c.statut === tab
      const okQ = !s || [c.numero, c.client_nom].some((v) => (v || '').toLowerCase().includes(s))
      return okTab && okQ
    })
  }, [commandes, tab, q])

  const counts = useMemo(() => {
    const by = (st) => commandes.filter((c) => c.statut === st).length
    return { toutes: commandes.length, en_attente: by('en_attente'), en_cours: by('en_cours'), livree: by('livree'), annulee: by('annulee') }
  }, [commandes])

  const stats = useMemo(() => ({
    ca: commandes.filter((c) => c.statut !== 'annulee').reduce((s, c) => s + (c.montant_ht || 0), 0),
    total: commandes.length,
    attente: counts.en_attente, cours: counts.en_cours,
  }), [commandes, counts])

  const openNew = () => {
    setClientId(''); setNotes(''); setLignes([{ produit_id: '', quantite: 1, prix_unitaire: 0, remise: 0 }]); setModal(true)
  }

  const setLigne = (i, patch) => setLignes((ls) => ls.map((l, j) => j === i ? { ...l, ...patch } : l))
  const onProduit = (i, produit_id) => {
    const p = produits.find((x) => String(x.id) === String(produit_id))
    setLigne(i, { produit_id, prix_unitaire: p ? p.prix_ht : 0 })
  }
  const addLigne = () => setLignes((ls) => [...ls, { produit_id: '', quantite: 1, prix_unitaire: 0, remise: 0 }])
  const removeLigne = (i) => setLignes((ls) => ls.filter((_, j) => j !== i))

  const totals = useMemo(() => {
    let ht = 0, tva = 0
    for (const l of lignes) {
      const p = produits.find((x) => String(x.id) === String(l.produit_id))
      const lineHt = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise) || 0) / 100)
      ht += lineHt
      tva += lineHt * ((p ? Number(p.tva) : 0) / 100)
    }
    return { ht, tva, ttc: ht + tva }
  }, [lignes, produits])

  const submit = async (e) => {
    e.preventDefault()
    if (!clientId) return toast.error('Sélectionnez un client')
    const valid = lignes.filter((l) => l.produit_id)
    if (!valid.length) return toast.error('Ajoutez au moins un article')
    setSaving(true)
    try {
      await api.post('/commandes', { client_id: clientId, notes, lignes: valid })
      toast.success('Commande créée'); setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  const changeStatut = async (c, statut) => {
    try { await api.put(`/commandes/${c.id}/statut`, { statut }); toast.success('Statut mis à jour'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const remove = async (c) => {
    if (!confirm(`Supprimer la commande ${c.numero} ?`)) return
    try { await api.delete(`/commandes/${c.id}`); toast.success('Commande supprimée'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition
              ${tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {t.label} <span className="ml-1 opacity-70">{counts[t.key]}</span>
          </button>
        ))}
        <div className="relative ml-auto min-w-[220px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="N° commande, client..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={18} /> Nouvelle commande</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="CA total (HT)" value={formatMoney(stats.ca, devise)} icon={Wallet} color="brand" />
        <StatCard label="Commandes" value={stats.total} icon={ShoppingCart} color="slate" />
        <StatCard label="En attente" value={stats.attente} icon={AlertCircle} color="orange" />
        <StatCard label="En cours" value={stats.cours} icon={Clock} color="purple" />
      </div>

      <div className="table-wrap">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Aucune commande trouvée"
            action={<button onClick={openNew} className="text-sm font-semibold text-brand-600">Créer la première commande</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">N° Commande</th><th className="table-th">Client</th><th className="table-th">Date</th>
                  <th className="table-th text-right">Articles</th><th className="table-th text-right">Montant HT</th>
                  <th className="table-th">Statut</th><th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="table-row-hover">
                    <td className="table-td font-semibold text-slate-800">{c.numero}</td>
                    <td className="table-td text-slate-600">{c.client_nom || '—'}</td>
                    <td className="table-td text-slate-500">{formatDate(c.date_commande)}</td>
                    <td className="table-td text-right text-slate-600">{c.nb_articles}</td>
                    <td className="table-td text-right font-semibold text-slate-800">{formatMoney(c.montant_ht, devise)}</td>
                    <td className="table-td"><Badge status={c.statut} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1.5">
                        {NEXT[c.statut] && (
                          <button onClick={() => changeStatut(c, NEXT[c.statut])}
                            className="rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100">
                            {NEXT[c.statut] === 'en_cours' ? 'Traiter' : 'Livrer'}
                          </button>
                        )}
                        {c.statut !== 'annulee' && c.statut !== 'livree' && (
                          <button onClick={() => changeStatut(c, 'annulee')}
                            className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">Annuler</button>
                        )}
                        {canDelete && <button onClick={() => remove(c)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle commande" icon={ShoppingCart} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Client <span className="text-red-500">*</span></label>
              <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                <option value="">Sélectionner un client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Notes / Instructions</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : livraison urgente, fragile..." />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="label mb-0">Articles <span className="text-red-500">*</span></label>
            <button type="button" onClick={addLigne} className="flex items-center gap-1 text-sm font-semibold text-brand-600"><Plus size={15} /> Ajouter un article</button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Produit</th><th className="px-3 py-2">Qté</th>
                  <th className="px-3 py-2">Prix HT</th><th className="px-3 py-2">Remise</th>
                  <th className="px-3 py-2 text-right">Total HT</th><th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lignes.map((l, i) => {
                  const total = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise) || 0) / 100)
                  return (
                    <tr key={i}>
                      <td className="px-2 py-2">
                        <select className="input" value={l.produit_id} onChange={(e) => onProduit(i, e.target.value)}>
                          <option value="">Sélectionner...</option>
                          {produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 w-20"><input type="number" min="1" className="input" value={l.quantite} onChange={(e) => setLigne(i, { quantite: e.target.value })} /></td>
                      <td className="px-2 py-2 w-32"><input type="number" step="0.01" className="input" value={l.prix_unitaire} onChange={(e) => setLigne(i, { prix_unitaire: e.target.value })} /></td>
                      <td className="px-2 py-2 w-24"><div className="flex items-center gap-1"><input type="number" className="input" value={l.remise} onChange={(e) => setLigne(i, { remise: e.target.value })} /><span className="text-slate-400">%</span></div></td>
                      <td className="px-3 py-2 text-right font-semibold">{formatMoney(total, devise)}</td>
                      <td className="px-2">
                        {lignes.length > 1 && <button type="button" onClick={() => removeLigne(i)} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-500"><span>Total HT</span><span>{formatMoney(totals.ht, devise)}</span></div>
            <div className="flex justify-between text-slate-500"><span>TVA</span><span>{formatMoney(totals.tva, devise)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold"><span>Total TTC</span><span className="text-brand-600">{formatMoney(totals.ttc, devise)}</span></div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1"><Save size={17} /> Créer la commande</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
