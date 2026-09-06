import { useState, useEffect, useMemo } from 'react'
import {
  FileSignature, Repeat, Plus, Pencil, Trash2, Save, Search, Wallet,
  CreditCard, CalendarClock, AlertTriangle, CheckCircle2, History,
  FileText,
} from 'lucide-react'
import api, { formatMoney, formatDate } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { StatCard, Badge, Modal, Spinner, EmptyState, useToast } from '../components/ui'

const PERIODICITES = [
  { key: 'mensuel', label: 'Mensuel' }, { key: 'trimestriel', label: 'Trimestriel' },
  { key: 'semestriel', label: 'Semestriel' }, { key: 'annuel', label: 'Annuel' },
  { key: 'unique', label: 'Paiement unique' },
]
const STATUTS = [
  { key: 'actif', label: 'Actif' }, { key: 'suspendu', label: 'Suspendu' },
  { key: 'termine', label: 'Terminé' }, { key: 'resilie', label: 'Résilié' },
]
const MODES = ['Espèce', 'Virement bancaire', 'Chèque', 'Mobile Money']

const STATUT_STYLES = {
  actif: 'bg-emerald-100 text-emerald-700', suspendu: 'bg-amber-100 text-amber-700',
  termine: 'bg-slate-100 text-slate-600', resilie: 'bg-red-100 text-red-700',
}

const emptyForm = () => ({
  client_id: '', type: 'abonnement', intitule: '', montant: '',
  periodicite: 'mensuel', date_debut: new Date().toISOString().slice(0, 10),
  date_fin: '', prochaine_echeance: '', jours_relance: '7', statut: 'actif', notes: '',
})

// Nombre de jours entre aujourd'hui et une date (positif = futur)
function joursRestants(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.round((d - now) / 86400000)
}

function EcheanceBadge({ contrat }) {
  if (contrat.statut !== 'actif' || !contrat.prochaine_echeance) {
    return <span className="text-slate-400">—</span>
  }
  const j = joursRestants(contrat.prochaine_echeance)
  const seuil = contrat.jours_relance || 7
  let cls = 'text-slate-600', Icon = CalendarClock, txt = formatDate(contrat.prochaine_echeance)
  if (j < 0) { cls = 'text-red-600 font-semibold'; Icon = AlertTriangle; txt = `Retard ${Math.abs(j)} j` }
  else if (j <= seuil) { cls = 'text-amber-600 font-semibold'; Icon = AlertTriangle; txt = j === 0 ? "Aujourd'hui" : `Dans ${j} j` }
  return (
    <span className={`inline-flex items-center gap-1 ${cls}`}>
      <Icon size={14} /> {txt}
    </span>
  )
}

export default function Contrats({ clients = [] }) {
  const { devise } = useSettings()
  const { canDelete } = useAuth()
  const toast = useToast()
  const [contrats, setContrats] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState('tous') // tous | contrat | abonnement | echus
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  // Modal paiement
  const [payModal, setPayModal] = useState(null) // contrat sélectionné
  const [payForm, setPayForm] = useState({ montant: '', date_paiement: '', mode: 'Espèce', notes: '' })
  const [detail, setDetail] = useState(null) // { ...contrat, paiements }

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/contrats'); setContrats(data) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return contrats.filter((c) => {
      const okQ = !s || [c.reference, c.intitule, c.client_nom].some((v) => (v || '').toLowerCase().includes(s))
      let okF = true
      if (filtre === 'contrat') okF = c.type === 'contrat'
      else if (filtre === 'abonnement') okF = c.type === 'abonnement'
      else if (filtre === 'echus') okF = c.statut === 'actif' && c.prochaine_echeance && joursRestants(c.prochaine_echeance) <= (c.jours_relance || 7)
      return okQ && okF
    })
  }, [contrats, q, filtre])

  const stats = useMemo(() => {
    const actifs = contrats.filter((c) => c.statut === 'actif')
    return {
      contrats: contrats.filter((c) => c.type === 'contrat').length,
      abonnements: contrats.filter((c) => c.type === 'abonnement').length,
      relances: actifs.filter((c) => c.prochaine_echeance && joursRestants(c.prochaine_echeance) <= (c.jours_relance || 7)).length,
      encaisse: contrats.reduce((s, c) => s + (c.total_paye || 0), 0),
    }
  }, [contrats])

  const openNew = () => { setForm(emptyForm()); setEditing(null); setModal(true) }
  const openEdit = (c) => {
    setForm({
      client_id: c.client_id, type: c.type, intitule: c.intitule, montant: c.montant ?? '',
      periodicite: c.periodicite || 'mensuel',
      date_debut: c.date_debut ? c.date_debut.slice(0, 10) : '',
      date_fin: c.date_fin ? c.date_fin.slice(0, 10) : '',
      prochaine_echeance: c.prochaine_echeance ? c.prochaine_echeance.slice(0, 10) : '',
      jours_relance: String(c.jours_relance ?? 7), statut: c.statut || 'actif', notes: c.notes || '',
    })
    setEditing(c); setModal(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.client_id) return toast.error('Sélectionnez un client')
    if (!form.intitule.trim()) return toast.error("L'intitulé est obligatoire")
    setSaving(true)
    try {
      if (editing) { await api.put(`/contrats/${editing.id}`, form); toast.success('Contrat modifié') }
      else { await api.post('/contrats', form); toast.success('Contrat créé') }
      setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  const remove = async (c) => {
    if (!confirm(`Supprimer « ${c.intitule} » ? Cette action supprime aussi son historique de paiements.`)) return
    try { await api.delete(`/contrats/${c.id}`); toast.success('Contrat supprimé'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const openPay = (c) => {
    setPayForm({ montant: String(c.montant || ''), date_paiement: new Date().toISOString().slice(0, 10), mode: 'Espèce', notes: '' })
    setPayModal(c)
  }
  const submitPay = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(`/contrats/${payModal.id}/paiement`, payForm)
      toast.success('Paiement enregistré')
      setPayModal(null); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  const openDetail = async (c) => {
    try { const { data } = await api.get(`/contrats/${c.id}`); setDetail(data) }
    catch { toast.error('Erreur lors du chargement') }
  }

  const genererFacture = async (c) => {
    if (!confirm(`Générer une facture pour « ${c.intitule} » (${formatMoney(c.montant, devise)}) ?`)) return
    try {
      const { data } = await api.post(`/contrats/${c.id}/facture`)
      toast.success(`Facture ${data.numero} générée — visible dans Facturation`)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Référence, intitulé, client..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={18} /> Nouveau contrat / abonnement</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contrats" value={stats.contrats} icon={FileSignature} color="slate" />
        <StatCard label="Abonnements" value={stats.abonnements} icon={Repeat} color="brand" />
        <StatCard label="Relances à prévoir" value={stats.relances} icon={AlertTriangle} color="orange" />
        <StatCard label="Total encaissé" value={formatMoney(stats.encaisse, devise)} icon={Wallet} color="green" />
      </div>

      <div className="table-wrap">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          {[
            { key: 'tous', label: 'Tous' }, { key: 'contrat', label: 'Contrats' },
            { key: 'abonnement', label: 'Abonnements' }, { key: 'echus', label: 'À relancer' },
          ].map((t) => (
            <button key={t.key} onClick={() => setFiltre(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition
                ${filtre === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>{t.label}</button>
          ))}
        </div>

        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={FileSignature} title="Aucun contrat ni abonnement"
            action={<button onClick={openNew} className="text-sm font-semibold text-brand-600">Créer le premier</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Référence</th><th className="table-th">Client</th>
                  <th className="table-th">Intitulé</th><th className="table-th">Type</th>
                  <th className="table-th text-right">Montant</th><th className="table-th text-right">Encaissé</th>
                  <th className="table-th">Prochaine échéance</th><th className="table-th">Statut</th><th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="table-row-hover">
                    <td className="table-td text-xs text-slate-400">{c.reference}</td>
                    <td className="table-td font-semibold text-slate-800">{c.client_nom}</td>
                    <td className="table-td text-slate-600">{c.intitule}</td>
                    <td className="table-td">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        {c.type === 'abonnement' ? <Repeat size={14} /> : <FileSignature size={14} />}
                        {c.type === 'abonnement' ? `Abonnement · ${c.periodicite}` : 'Contrat'}
                      </span>
                    </td>
                    <td className="table-td text-right font-semibold text-slate-800">{formatMoney(c.montant, devise)}</td>
                    <td className="table-td text-right text-emerald-600">{formatMoney(c.total_paye, devise)}</td>
                    <td className="table-td"><EcheanceBadge contrat={c} /></td>
                    <td className="table-td"><span className={`badge ${STATUT_STYLES[c.statut] || ''}`}>{STATUTS.find((s) => s.key === c.statut)?.label || c.statut}</span></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => genererFacture(c)} title="Générer une facture" className="rounded p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"><FileText size={16} /></button>
                        <button onClick={() => openPay(c)} title="Enregistrer un paiement" className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><CreditCard size={16} /></button>
                        <button onClick={() => openDetail(c)} title="Historique" className="rounded p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"><History size={16} /></button>
                        <button onClick={() => openEdit(c)} title="Modifier" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                        {canDelete && <button onClick={() => remove(c)} title="Supprimer" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulaire création/édition */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le contrat' : 'Nouveau contrat / abonnement'} icon={FileSignature} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Client <span className="text-red-500">*</span></label>
              <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                <option value="">— Sélectionner —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {['contrat', 'abonnement'].map((t) => (
                  <button type="button" key={t} onClick={() => setForm({ ...form, type: t })}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold capitalize transition
                      ${form.type === t ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {t === 'abonnement' ? 'Abonnement' : 'Contrat'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Intitulé <span className="text-red-500">*</span></label>
            <input className="input" value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })} placeholder="Ex : Maintenance annuelle, Abonnement internet..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Montant ({devise})</label>
              <input type="number" step="0.01" className="input" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </div>
            <div>
              <label className="label">Périodicité</label>
              <select className="input" value={form.periodicite} onChange={(e) => setForm({ ...form, periodicite: e.target.value })} disabled={form.type === 'contrat'}>
                {PERIODICITES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input" value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
                {STATUTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Date de début</label>
              <input type="date" className="input" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div>
              <label className="label">Date de fin (optionnel)</label>
              <input type="date" className="input" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
            <div>
              <label className="label">Prochaine échéance</label>
              <input type="date" className="input" value={form.prochaine_echeance} onChange={(e) => setForm({ ...form, prochaine_echeance: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Relance (jours avant échéance)</label>
              <input type="number" min="0" className="input" value={form.jours_relance} onChange={(e) => setForm({ ...form, jours_relance: e.target.value })} />
              <p className="mt-1 text-xs text-slate-400">Une notification apparaît {form.jours_relance || 7} jour(s) avant l'échéance.</p>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1"><Save size={17} /> {editing ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal paiement */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Enregistrer un paiement" icon={CreditCard}>
        {payModal && (
          <form onSubmit={submitPay} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-800">{payModal.intitule}</div>
              <div className="text-slate-500">{payModal.client_nom} · {payModal.reference}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Montant ({devise}) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" required className="input" value={payForm.montant} onChange={(e) => setPayForm({ ...payForm, montant: e.target.value })} />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={payForm.date_paiement} onChange={(e) => setPayForm({ ...payForm, date_paiement: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Mode de règlement</label>
              <select className="input" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
            {payModal.type === 'abonnement' && (
              <p className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-600">
                <CheckCircle2 size={14} /> La prochaine échéance sera automatiquement avancée ({payModal.periodicite}).
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setPayModal(null)} className="btn-secondary flex-1">Annuler</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1"><Save size={17} /> Enregistrer</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal historique */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Historique des paiements" icon={History} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-semibold text-slate-800">{detail.intitule}</div>
                <div className="text-slate-500">{detail.client_nom} · {detail.reference}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                <div className="text-slate-500">Total encaissé</div>
                <div className="text-lg font-bold text-emerald-700">{formatMoney(detail.total_paye, devise)}</div>
              </div>
            </div>
            {(!detail.paiements || detail.paiements.length === 0) ? (
              <p className="py-6 text-center text-sm text-slate-400">Aucun paiement enregistré.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Mode</th><th className="px-3 py-2 text-left">Notes</th><th className="px-3 py-2 text-right">Montant</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.paiements.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2">{formatDate(p.date_paiement)}</td>
                        <td className="px-3 py-2 text-slate-500">{p.mode || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{p.notes || '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatMoney(p.montant, devise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
