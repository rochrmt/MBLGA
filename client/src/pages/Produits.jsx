import { useState, useEffect, useMemo } from 'react'
import {
  Boxes, Plus, BarChart2, Tag, AlertTriangle, Search, Pencil, Trash2, Save,
} from 'lucide-react'
import api, { formatMoney } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { StatCard, Modal, Spinner, EmptyState, Badge, useToast } from '../components/ui'

const EMPTY = { nom: '', description: '', categorie_id: '', prix_ht: '', tva: '20', stock: '', stock_min: '' }

export default function Produits() {
  const { devise, settings } = useSettings()
  const { canDelete } = useAuth()
  const toast = useToast()
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([api.get('/produits'), api.get('/produits/categories')])
      setProduits(p.data); setCategories(c.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return produits.filter((p) => {
      const okQ = !s || [p.nom, p.code].some((v) => (v || '').toLowerCase().includes(s))
      const okC = !cat || String(p.categorie_id) === String(cat)
      return okQ && okC
    })
  }, [produits, q, cat])

  const stats = useMemo(() => ({
    refs: produits.length,
    stock: produits.reduce((s, p) => s + (p.stock || 0), 0),
    cats: categories.length,
    alertes: produits.filter((p) => p.stock <= p.stock_min).length,
  }), [produits, categories])

  const openNew = () => {
    setForm({ ...EMPTY, tva: settings.tva_defaut || '20', stock_min: settings.stock_min_defaut || '5' })
    setEditing(null); setModal(true)
  }
  const openEdit = (p) => {
    setForm({ nom: p.nom, description: p.description || '', categorie_id: p.categorie_id || '',
      prix_ht: p.prix_ht, tva: p.tva, stock: p.stock, stock_min: p.stock_min })
    setEditing(p); setModal(true)
  }

  const submit = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, categorie_id: form.categorie_id || null }
    try {
      if (editing) { await api.put(`/produits/${editing.id}`, { ...payload, actif: editing.actif }); toast.success('Article modifié') }
      else { await api.post('/produits', payload); toast.success('Article créé') }
      setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  const remove = async (p) => {
    if (!confirm(`Supprimer "${p.nom}" ?`)) return
    try { await api.delete(`/produits/${p.id}`); toast.success('Article supprimé'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const ttc = (p) => Number(p.prix_ht) * (1 + Number(p.tva) / 100)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Références" value={stats.refs} icon={Boxes} color="purple" />
        <StatCard label="Unités en stock" value={stats.stock} icon={BarChart2} color="brand" />
        <StatCard label="Catégories" value={stats.cats} icon={Tag} color="green" />
        <StatCard label="Alertes stock" value={stats.alertes} icon={AlertTriangle} color="orange" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Nom, référence..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <button onClick={openNew} className="btn-primary"><Plus size={18} /> Nouvel article</button>
      </div>

      <div className="table-wrap">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucun article trouvé"
            action={<button onClick={openNew} className="text-sm font-semibold text-brand-600">Ajouter le premier article</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Référence</th><th className="table-th">Désignation</th><th className="table-th">Catégorie</th>
                  <th className="table-th text-right">Prix HT</th><th className="table-th text-right">Prix TTC</th>
                  <th className="table-th text-right">Stock</th><th className="table-th text-right">Min.</th>
                  <th className="table-th">Alerte</th><th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="table-row-hover">
                    <td className="table-td text-xs text-slate-400">{p.code}</td>
                    <td className="table-td font-semibold text-slate-800">{p.nom}</td>
                    <td className="table-td text-slate-500">{p.categorie_nom || 'Sans catégorie'}</td>
                    <td className="table-td text-right text-slate-600">{formatMoney(p.prix_ht, devise)}</td>
                    <td className="table-td text-right text-slate-600">{formatMoney(ttc(p), devise)}</td>
                    <td className="table-td text-right font-semibold text-slate-800">{p.stock}</td>
                    <td className="table-td text-right text-slate-400">{p.stock_min}</td>
                    <td className="table-td">
                      {p.stock <= p.stock_min
                        ? <Badge status={p.stock === 0 ? 'annulee' : 'en_attente'}>{p.stock === 0 ? 'Rupture' : 'Bas'}</Badge>
                        : <Badge status="actif">OK</Badge>}
                    </td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                        {canDelete && <button onClick={() => remove(p)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Modifier l'article" : 'Nouvel article'} icon={Boxes}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Désignation <span className="text-red-500">*</span></label>
            <input className="input" required autoFocus value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex : Ordinateur Portable Pro" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Caractéristiques, détails techniques..." />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select className="input" value={form.categorie_id} onChange={(e) => setForm({ ...form, categorie_id: e.target.value })}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Prix HT ({devise}) <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" className="input" required value={form.prix_ht}
                onChange={(e) => setForm({ ...form, prix_ht: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label className="label">TVA (%)</label>
              <input type="number" step="0.01" className="input" value={form.tva}
                onChange={(e) => setForm({ ...form, tva: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Stock initial (unités)</label>
              <input type="number" className="input" value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label className="label">Stock minimum (seuil d'alerte)</label>
              <input type="number" className="input" value={form.stock_min}
                onChange={(e) => setForm({ ...form, stock_min: e.target.value })} placeholder="5" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1"><Save size={17} /> {editing ? 'Enregistrer' : "Créer l'article"}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
