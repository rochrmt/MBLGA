import { useState, useEffect, useMemo } from 'react'
import {
  Users, UserPlus, Building2, Wallet, ShoppingBag, Search, Mail, Phone,
  Pencil, Trash2, Save, FileSignature,
} from 'lucide-react'
import api, { formatMoney } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { StatCard, Badge, Modal, Spinner, EmptyState, useToast } from '../components/ui'
import Contrats from './Contrats'

const EMPTY = { nom: '', email: '', telephone: '', adresse: '', ville: '', type: 'client' }

export default function Clients() {
  const { devise } = useSettings()
  const { canDelete } = useAuth()
  const toast = useToast()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('clients') // clients | contrats

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/clients'); setClients(data) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return clients
    return clients.filter((c) =>
      [c.nom, c.email, c.ville, c.code].some((v) => (v || '').toLowerCase().includes(s)))
  }, [clients, q])

  const stats = useMemo(() => ({
    total: clients.length,
    actifs: clients.filter((c) => c.actif).length,
    avecCmd: clients.filter((c) => c.nb_commandes > 0).length,
    ca: clients.reduce((s, c) => s + (c.ca_total || 0), 0),
  }), [clients])

  const openNew = () => { setForm(EMPTY); setEditing(null); setModal(true) }
  const openEdit = (c) => {
    setForm({ nom: c.nom, email: c.email || '', telephone: c.telephone || '', adresse: c.adresse || '',
      ville: c.ville || '', type: c.type || 'client' })
    setEditing(c); setModal(true)
  }

  const submit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) { await api.put(`/clients/${editing.id}`, { ...form, actif: editing.actif }); toast.success('Client modifié') }
      else { await api.post('/clients', form); toast.success('Client créé') }
      setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  const remove = async (c) => {
    if (!confirm(`Supprimer le client "${c.nom}" ?`)) return
    try { await api.delete(`/clients/${c.id}`); toast.success('Client supprimé'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
        {[
          { key: 'clients', label: 'Clients', icon: Users },
          { key: 'contrats', label: 'Contrats & Abonnements', icon: FileSignature },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setView(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition
                ${view === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon size={16} /> {t.label}
            </button>
          )
        })}
      </div>

      {view === 'contrats' ? <Contrats clients={clients} /> : (
      <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total clients" value={stats.total} icon={Users} color="slate" />
        <StatCard label="Actifs" value={stats.actifs} icon={Building2} color="green" />
        <StatCard label="Avec commandes" value={stats.avecCmd} icon={ShoppingBag} color="brand" />
        <StatCard label={`CA total (HT)`} value={formatMoney(stats.ca, devise)} icon={Wallet} color="purple" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Nom, email, ville, code..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={openNew} className="btn-primary"><UserPlus size={18} /> Nouveau client</button>
      </div>

      <div className="table-wrap">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Users} title="Aucun client trouvé" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Code</th><th className="table-th">Client</th><th className="table-th">Contact</th>
                  <th className="table-th">Ville</th><th className="table-th">Commandes</th>
                  <th className="table-th text-right">CA Total (HT)</th><th className="table-th">Statut</th><th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="table-row-hover">
                    <td className="table-td text-xs text-slate-400">{c.code}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600">
                          {c.nom.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-semibold text-slate-800">{c.nom}</span>
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="space-y-0.5 text-xs text-slate-500">
                        {c.email && <div className="flex items-center gap-1"><Mail size={12} />{c.email}</div>}
                        {c.telephone && <div className="flex items-center gap-1"><Phone size={12} />{c.telephone}</div>}
                        {!c.email && !c.telephone && '—'}
                      </div>
                    </td>
                    <td className="table-td text-slate-600">{c.ville || '—'}</td>
                    <td className="table-td text-slate-500">{c.nb_commandes} cmd</td>
                    <td className="table-td text-right font-semibold text-slate-800">{formatMoney(c.ca_total, devise)}</td>
                    <td className="table-td"><Badge status={c.actif ? 'actif' : 'inactif'} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                        {canDelete && <button onClick={() => remove(c)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le client' : 'Nouveau client'} icon={UserPlus}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nom / Raison sociale <span className="text-red-500">*</span></label>
            <input className="input" required autoFocus value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex : Tech Solutions SA" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@example.com" />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="77 000 00 00" />
            </div>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })} placeholder="12 rue de la Paix" />
          </div>
          <div>
            <label className="label">Ville</label>
            <input className="input" value={form.ville}
              onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Dakar" />
          </div>
          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-2 gap-3">
              {['client', 'sous-traitant'].map((t) => (
                <button type="button" key={t} onClick={() => setForm({ ...form, type: t })}
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold capitalize transition
                    ${form.type === t ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {t === 'client' ? 'Client' : 'Sous-traitant'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1"><Save size={17} /> {editing ? 'Enregistrer' : 'Créer le client'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
