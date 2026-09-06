import { useState, useEffect, useMemo } from 'react'
import {
  Users, Calendar, Wallet, UserPlus, Search, CheckCircle2, Clock, Save,
  ChevronLeft, ChevronRight, RefreshCw, Printer, Check, X, Trash2,
} from 'lucide-react'
import api, { formatMoney, formatDate } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { StatCard, Badge, Modal, Spinner, EmptyState, useToast } from '../components/ui'

const TABS = [
  { key: 'employes', label: 'Employés', icon: Users },
  { key: 'conges', label: 'Congés & Absences', icon: Calendar },
  { key: 'paie', label: 'Paie', icon: Wallet },
]

export default function Personnel() {
  const [tab, setTab] = useState('employes')
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition
              ${tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'employes' && <Employes />}
      {tab === 'conges' && <Conges />}
      {tab === 'paie' && <Paie />}
    </div>
  )
}

/* ── Employés ───────────────────────────────────────────────────────────── */
const EMPTY_EMP = { nom: '', prenom: '', poste: '', departement: '', telephone: '', email: '', date_embauche: '', salaire: '' }
function Employes() {
  const { devise } = useSettings()
  const { canDelete } = useAuth()
  const toast = useToast()
  const [employes, setEmployes] = useState([])
  const [departements, setDepartements] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [dep, setDep] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_EMP)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [e, d] = await Promise.all([api.get('/employes'), api.get('/departements')])
      setEmployes(e.data); setDepartements(d.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return employes.filter((e) => {
      const okQ = !s || [e.nom, e.prenom, e.poste, e.departement].some((v) => (v || '').toLowerCase().includes(s))
      const okD = !dep || e.departement === dep
      return okQ && okD
    })
  }, [employes, q, dep])

  const stats = useMemo(() => ({
    total: employes.length,
    actifs: employes.filter((e) => e.actif).length,
    masse: employes.filter((e) => e.actif).reduce((s, e) => s + (e.salaire || 0), 0),
  }), [employes])

  const openNew = () => { setForm(EMPTY_EMP); setEditing(null); setModal(true) }
  const openEdit = (e) => {
    setForm({ nom: e.nom, prenom: e.prenom || '', poste: e.poste || '', departement: e.departement || '',
      telephone: e.telephone || '', email: e.email || '', date_embauche: e.date_embauche?.slice(0, 10) || '', salaire: e.salaire })
    setEditing(e); setModal(true)
  }
  const submit = async (ev) => {
    ev.preventDefault()
    try {
      if (editing) { await api.put(`/employes/${editing.id}`, { ...form, actif: editing.actif }); toast.success('Employé modifié') }
      else { await api.post('/employes', form); toast.success('Employé créé') }
      setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const remove = async (e) => {
    if (!confirm(`Supprimer ${e.nom} ${e.prenom || ''} ?`)) return
    try {
      const { data } = await api.delete(`/employes/${e.id}`)
      toast.success(data.desactive ? 'Employé désactivé (données liées conservées)' : 'Employé supprimé')
      load()
    } catch { toast.error('Erreur') }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Nom, poste, département..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={dep} onChange={(e) => setDep(e.target.value)}>
          <option value="">Tous</option>
          {departements.map((d) => <option key={d.id} value={d.nom}>{d.nom}</option>)}
        </select>
        <button onClick={openNew} className="btn-primary ml-auto"><UserPlus size={18} /> Nouvel employé</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total employés" value={stats.total} icon={Users} color="slate" />
        <StatCard label="Actifs" value={stats.actifs} icon={CheckCircle2} color="green" />
        <StatCard label="Congés en attente" value={0} icon={Clock} color="orange" />
        <StatCard label="Masse salariale" value={formatMoney(stats.masse, devise)} icon={Wallet} color="brand" />
      </div>

      <div className="table-wrap">
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState icon={Users} title="Aucun employé" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr><th className="table-th">Matricule</th><th className="table-th">Employé</th><th className="table-th">Poste / Département</th><th className="table-th">Contact</th><th className="table-th">Embauché le</th><th className="table-th text-right">Salaire</th><th className="table-th"></th></tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="table-row-hover">
                    <td className="table-td text-xs text-slate-400">{e.matricule}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600">{(e.nom[0] || '') + (e.prenom?.[0] || '')}</span>
                        <span className="font-semibold text-slate-800">{e.nom} {e.prenom}</span>
                      </div>
                    </td>
                    <td className="table-td"><div className="font-medium text-slate-700">{e.poste || '—'}</div><div className="text-xs text-slate-400">{e.departement || ''}</div></td>
                    <td className="table-td text-xs text-slate-500">{e.telephone || e.email || '—'}</td>
                    <td className="table-td text-slate-500">{formatDate(e.date_embauche)}</td>
                    <td className="table-td text-right font-semibold text-slate-800">{formatMoney(e.salaire, devise)}</td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(e)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Save size={15} /></button>
                        {canDelete && <button onClick={() => remove(e)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier l\'employé' : 'Nouvel employé'} icon={UserPlus}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Nom <span className="text-red-500">*</span></label><input className="input" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Dupont" /></div>
            <div><label className="label">Prénom</label><input className="input" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Jean" /></div>
            <div><label className="label">Poste</label><input className="input" value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} placeholder="Comptable" /></div>
            <div><label className="label">Département</label>
              <input className="input" list="deps" value={form.departement} onChange={(e) => setForm({ ...form, departement: e.target.value })} placeholder="Finance" />
              <datalist id="deps">{departements.map((d) => <option key={d.id} value={d.nom} />)}</datalist>
            </div>
            <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="77 000 00 00" /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean@example.com" /></div>
            <div><label className="label">Date d'embauche</label><input type="date" className="input" value={form.date_embauche} onChange={(e) => setForm({ ...form, date_embauche: e.target.value })} /></div>
            <div><label className="label">Salaire de base ({devise})</label><input type="number" className="input" value={form.salaire} onChange={(e) => setForm({ ...form, salaire: e.target.value })} placeholder="250 000" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" className="btn-primary flex-1"><Save size={17} /> {editing ? 'Enregistrer' : 'Créer l\'employé'}</button>
          </div>
        </form>
      </Modal>
    </>
  )
}

/* ── Congés & Absences ──────────────────────────────────────────────────── */
const CONGE_TABS = [['tous', 'Tous'], ['en_attente', 'En attente'], ['approuve', 'Approuvés'], ['refuse', 'Refusés']]
function Conges() {
  const { canDelete } = useAuth()
  const toast = useToast()
  const [conges, setConges] = useState([])
  const [employes, setEmployes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tous')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ employe_id: '', type: 'conge_paye', date_debut: '', date_fin: '', motif: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [c, e] = await Promise.all([api.get('/conges'), api.get('/employes')])
      setConges(c.data); setEmployes(e.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = tab === 'tous' ? conges : conges.filter((c) => c.statut === tab)
  const stats = {
    total: conges.length,
    attente: conges.filter((c) => c.statut === 'en_attente').length,
    approuve: conges.filter((c) => c.statut === 'approuve').length,
    jours: conges.filter((c) => c.statut === 'approuve').reduce((s, c) => s + (c.nb_jours || 0), 0),
  }

  const submit = async (e) => {
    e.preventDefault()
    try { await api.post('/conges', form); toast.success('Demande créée'); setModal(false); setForm({ employe_id: '', type: 'conge_paye', date_debut: '', date_fin: '', motif: '' }); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const setStatut = async (c, statut) => {
    try { await api.put(`/conges/${c.id}/statut`, { statut }); toast.success('Mis à jour'); load() } catch { toast.error('Erreur') }
  }
  const remove = async (c) => {
    if (!confirm('Supprimer cette demande de congé ?')) return
    try { await api.delete(`/conges/${c.id}`); toast.success('Supprimé'); load() } catch { toast.error('Erreur') }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total demandes" value={stats.total} icon={Calendar} color="slate" />
        <StatCard label="En attente" value={stats.attente} icon={Clock} color="orange" />
        <StatCard label="Approuvés" value={stats.approuve} icon={CheckCircle2} color="green" />
        <StatCard label="Jours approuvés" value={stats.jours} icon={Calendar} color="brand" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {CONGE_TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${tab === k ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>{l}</button>
        ))}
        <button onClick={() => setModal(true)} className="btn-primary ml-auto"><Calendar size={17} /> Nouvelle demande</button>
      </div>
      <div className="table-wrap">
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState icon={Calendar} title="Aucune demande de congé" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="table-th">Employé</th><th className="table-th">Type</th><th className="table-th">Du</th><th className="table-th">Au</th><th className="table-th text-right">Durée</th><th className="table-th">Motif</th><th className="table-th">Statut</th><th className="table-th"></th></tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="table-row-hover">
                    <td className="table-td font-medium text-slate-800">{c.employe_nom} {c.employe_prenom}</td>
                    <td className="table-td capitalize text-slate-500">{c.type.replace('_', ' ')}</td>
                    <td className="table-td text-slate-500">{formatDate(c.date_debut)}</td>
                    <td className="table-td text-slate-500">{formatDate(c.date_fin)}</td>
                    <td className="table-td text-right text-slate-600">{c.nb_jours} j</td>
                    <td className="table-td text-slate-500">{c.motif || '—'}</td>
                    <td className="table-td"><Badge status={c.statut} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        {c.statut === 'en_attente' && (
                          <>
                            <button onClick={() => setStatut(c, 'approuve')} className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Check size={16} /></button>
                            <button onClick={() => setStatut(c, 'refuse')} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button>
                          </>
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

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle demande de congé" icon={Calendar}>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Employé <span className="text-red-500">*</span></label>
            <select className="input" required value={form.employe_id} onChange={(e) => setForm({ ...form, employe_id: e.target.value })}>
              <option value="">Sélectionner...</option>
              {employes.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
            </select></div>
          <div><label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="conge_paye">Congé payé</option><option value="maladie">Maladie</option>
              <option value="sans_solde">Sans solde</option><option value="autre">Autre</option>
            </select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Du <span className="text-red-500">*</span></label><input type="date" className="input" required value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} /></div>
            <div><label className="label">Au <span className="text-red-500">*</span></label><input type="date" className="input" required value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} /></div>
          </div>
          <div><label className="label">Motif</label><textarea className="input" rows={2} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} /></div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button><button type="submit" className="btn-primary flex-1"><Save size={17} /> Créer la demande</button></div>
        </form>
      </Modal>
    </>
  )
}

/* ── Paie ───────────────────────────────────────────────────────────────── */
function Paie() {
  const { devise, appName, settings } = useSettings()
  const { canDelete } = useAuth()
  const toast = useToast()
  const [mois, setMois] = useState(new Date().toISOString().slice(0, 7))
  const [bulletins, setBulletins] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [bulletin, setBulletin] = useState(null)
  const [saving, setSaving] = useState(false)
  const [payingBulletin, setPayingBulletin] = useState(null)
  const [payMode, setPayMode] = useState('Espèces')
  const [payCustom, setPayCustom] = useState('')

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/paie', { params: { mois } }); setBulletins(data) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [mois])

  const shiftMonth = (delta) => {
    const [y, m] = mois.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMois(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const generer = async () => {
    try { const { data } = await api.post('/paie/generer', { mois }); toast.success(`${data.crees} bulletin(s) généré(s)`); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const payer = (b) => {
    setPayMode('Espèces')
    setPayCustom('')
    setPayingBulletin(b)
  }
  const confirmPayer = async () => {
    const mode = payMode === '__custom__' ? payCustom.trim() : payMode
    if (!mode) { toast.error('Veuillez saisir un mode de paiement'); return }
    try { await api.put(`/paie/${payingBulletin.id}/payer`, { mode_paiement: mode }); toast.success('Bulletin payé'); setPayingBulletin(null); load() } catch { toast.error('Erreur') }
  }
  const remove = async (b) => {
    if (!confirm(`Supprimer le bulletin de ${b.employe_nom} ${b.employe_prenom} ?`)) return
    try { await api.delete(`/paie/${b.id}`); toast.success('Bulletin supprimé'); load() } catch { toast.error('Erreur') }
  }

  const openBulletin = (b) => {
    let lignes = []
    try { lignes = JSON.parse(b.lignes_supplementaires) || [] } catch { lignes = [] }
    // Pad with 3 empty editable deduction rows by default
    const deducCount = lignes.filter(l => l.type === 'deduction').length
    for (let i = deducCount; i < 3; i++) lignes.push({ libelle: '', type: 'deduction', taux: '', montant: 0 })
    setBulletin({ ...b, lignes_supplementaires_arr: lignes, notes: b.notes || 'à conserver sans limitation de durée' })
    setEditing(b)
  }

  const saveBulletin = async () => {
    setSaving(true)
    try {
      const cleanLignes = (bulletin.lignes_supplementaires_arr || []).filter(l => l.libelle && l.libelle.trim() !== '')
      const payload = { ...bulletin, lignes_supplementaires: JSON.stringify(cleanLignes) }
      delete payload.lignes_supplementaires_arr
      await api.put(`/paie/${bulletin.id}`, payload)
      toast.success('Bulletin enregistré')
      setEditing(null)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
    finally { setSaving(false) }
  }

  const printBulletin = () => {
    window.print()
  }

  // Calculs dynamiques
  const calcPrimes = (b) =>
    (Number(b.prime_rendement) || 0) + (Number(b.prime_anciennete) || 0) + (Number(b.autres_primes) || 0) +
    (Number(b.montant_heures_sup) || 0) + (Number(b.montant_conge) || 0) +
    (b.lignes_supplementaires_arr || []).filter(l => l.type !== 'deduction').reduce((s, l) => s + (Number(l.montant) || 0), 0)
  const calcDeductions = (b) =>
    (Number(b.avances_salaire) || 0) + (Number(b.avance_salaire) || 0) + (Number(b.retenue_absence) || 0) + (Number(b.autres_deductions) || 0) +
    (b.lignes_supplementaires_arr || []).filter(l => l.type === 'deduction').reduce((s, l) => s + (Number(l.montant) || 0), 0)
  const calcBrut = (b) => (Number(b.salaire_base) || 0) + calcPrimes(b)
  const calcNet = (b) => calcBrut(b) - calcDeductions(b)

  const upd = (field, val) => setBulletin(prev => ({ ...prev, [field]: val }))
  const updHeuresSup = (field, val) => setBulletin(prev => {
    const next = { ...prev, [field]: val }
    next.montant_heures_sup = (Number(next.heures_sup) || 0) * (Number(next.taux_heure_sup) || 0)
    return next
  })
  const updLigne = (i, field, val) => setBulletin(prev => {
    const arr = [...(prev.lignes_supplementaires_arr || [])]
    arr[i] = { ...arr[i], [field]: val }
    if (field === 'taux') {
      const taux = Number(val) || 0
      const base = Number(prev.salaire_base) || 0
      arr[i].montant = Math.round(base * taux / 100)
    }
    return { ...prev, lignes_supplementaires_arr: arr }
  })
  const addLigne = (type = 'deduction') => setBulletin(prev => ({
    ...prev,
    lignes_supplementaires_arr: [...(prev.lignes_supplementaires_arr || []), { libelle: '', type, taux: '', montant: 0 }],
  }))
  const removeLigne = (i) => setBulletin(prev => ({
    ...prev,
    lignes_supplementaires_arr: (prev.lignes_supplementaires_arr || []).filter((_, idx) => idx !== i),
  }))

  const stats = {
    bulletins: bulletins.length,
    payes: bulletins.filter((b) => b.statut === 'paye').length,
    attente: bulletins.filter((b) => b.statut !== 'paye').length,
    masse: bulletins.reduce((s, b) => s + (b.net || 0), 0),
  }
  const moisLabel = new Date(mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"><ChevronLeft size={18} /></button>
          <span className="min-w-[150px] text-center font-bold capitalize text-slate-800">{moisLabel}</span>
          <button onClick={() => shiftMonth(1)} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"><ChevronRight size={18} /></button>
        </div>
        <button onClick={generer} className="btn-primary bg-violet-600 hover:bg-violet-700"><Wallet size={17} /> Générer la paie</button>
        <button onClick={load} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"><RefreshCw size={17} /></button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bulletins" value={stats.bulletins} icon={Users} color="slate" />
        <StatCard label="Payés" value={`${stats.payes} / ${stats.bulletins}`} icon={CheckCircle2} color="green" />
        <StatCard label="En attente" value={stats.attente} icon={Clock} color="orange" />
        <StatCard label="Masse nette" value={formatMoney(stats.masse, devise)} icon={Wallet} color="brand" />
      </div>

      <div className="table-wrap">
        {loading ? <Spinner /> : bulletins.length === 0 ? (
          <EmptyState icon={Wallet} title={`Aucun bulletin pour ${moisLabel}`}
            action={<button onClick={generer} className="text-sm font-semibold text-brand-600">Générer la paie</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="table-th">Employé</th><th className="table-th text-right">Salaire base</th><th className="table-th text-right">Brut</th><th className="table-th text-right">Retenues</th><th className="table-th text-right">Net</th><th className="table-th">Statut</th><th className="table-th"></th></tr></thead>
              <tbody>
                {bulletins.map((b) => (
                  <tr key={b.id} className="table-row-hover">
                    <td className="table-td"><div className="font-semibold text-slate-800">{b.employe_nom} {b.employe_prenom}</div><div className="text-xs text-slate-400">{b.employe_poste}</div></td>
                    <td className="table-td text-right text-slate-600">{formatMoney(b.salaire_base, devise)}</td>
                    <td className="table-td text-right font-medium text-emerald-600">{formatMoney(b.salaire_base + b.primes, devise)}</td>
                    <td className="table-td text-right text-slate-500">{b.deductions ? formatMoney(b.deductions, devise) : '—'}</td>
                    <td className="table-td text-right font-bold text-slate-800">{formatMoney(b.net, devise)}</td>
                    <td className="table-td"><Badge status={b.statut} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openBulletin(b)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Éditer / Imprimer"><Printer size={15} /></button>
                        {b.statut !== 'paye' && <button onClick={() => payer(b)} className="btn-primary px-3 py-1.5 text-xs"><Wallet size={14} /> Payer</button>}
                        {canDelete && <button onClick={() => remove(b)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Paiement */}
      <Modal open={!!payingBulletin} onClose={() => setPayingBulletin(null)} title="Payer le bulletin" icon={Wallet} size="sm">
        {payingBulletin && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-800">{payingBulletin.employe_nom} {payingBulletin.employe_prenom}</p>
              <p className="text-slate-500">Net à payer : <span className="font-bold text-slate-800">{formatMoney(payingBulletin.net, devise)}</span></p>
            </div>
            <div>
              <label className="label">Mode de paiement</label>
              <select className="input" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                <option value="Espèces">Espèces</option>
                <option value="Virement bancaire">Virement bancaire</option>
                <option value="Chèque">Chèque</option>
                <option value="Carte Visa">Carte Visa</option>
                <option value="Orange Money">Orange Money</option>
                <option value="MTN Money">MTN Money</option>
                <option value="Moov Money">Moov Money</option>
                <option value="Wave">Wave</option>
                <option value="__custom__">+ Autre (saisir manuellement)</option>
              </select>
            </div>
            {payMode === '__custom__' && (
              <div>
                <label className="label">Précisez le mode de paiement</label>
                <input type="text" className="input" value={payCustom} onChange={(e) => setPayCustom(e.target.value)} placeholder="Ex: Mobile Money, Airtel Money..." autoFocus />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPayingBulletin(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={confirmPayer} className="btn-primary flex-1"><Wallet size={17} /> Confirmer le paiement</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Bulletin de Paie */}
      {editing && bulletin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:bg-white print:p-0 print:static print:overflow-visible">
          <div className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl print:my-0 print:max-w-none print:shadow-none print:rounded-none">

            {/* Header du modal — caché à l'impression */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 print:hidden">
              <h2 className="text-lg font-bold text-slate-800">Bulletin de paie — {bulletin.employe_nom} {bulletin.employe_prenom}</h2>
              <div className="flex gap-2">
                <button onClick={printBulletin} className="btn-primary"><Printer size={16} /> Imprimer</button>
                <button onClick={saveBulletin} disabled={saving} className="btn-secondary"><Save size={16} /> {saving ? '...' : 'Enregistrer'}</button>
                <button onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
              </div>
            </div>

            {/* Corps du bulletin — visible à l'impression */}
            <div className="px-6 py-5 print:px-6 print:py-4" id="bulletin-print">

              {/* En-tête entreprise — logo en haut à gauche + infos */}
              <div className="mb-3 flex items-start justify-between border-b-2 border-slate-800 pb-3">
                <div className="flex items-start gap-3">
                  {settings.logo
                    ? <img src={settings.logo} alt="logo" className="h-16 w-16 rounded-lg object-cover" />
                    : <div className="grid h-16 w-16 place-items-center rounded-lg bg-brand-600 text-xl font-bold text-white">{appName.charAt(0).toUpperCase()}</div>}
                  <div>
                    <p className="text-base font-bold uppercase text-slate-800">{settings.raison_sociale || appName}</p>
                    {settings.slogan && <p className="text-[11px] italic text-slate-500">{settings.slogan}</p>}
                    <div className="mt-0.5 flex flex-col gap-0.5 text-[10px] text-slate-500">
                      {settings.adresse && <span>{settings.adresse}</span>}
                      {settings.telephone && <span>Tél : {settings.telephone}</span>}
                      {settings.email && <span>{settings.email}</span>}
                      {settings.rccm && <span>RCCM : {settings.rccm}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-800">Bulletin de paie</p>
                  <p className="text-xs text-slate-600">Période : <span className="font-semibold capitalize">{moisLabel}</span></p>
                </div>
              </div>

              {/* Bloc 1 : infos employé + salaire de base */}
              <table className="w-full border-collapse border border-slate-800 text-sm">
                <tbody>
                  {/* Infos employé */}
                  <tr>
                    <td className="border border-slate-800 px-2 py-1 text-[11px] text-slate-500">Employé</td>
                    <td colSpan={3} className="border border-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-800">{bulletin.employe_nom} {bulletin.employe_prenom}</td>
                    <td className="border border-slate-800 px-2 py-1 text-[11px] text-slate-500">Poste</td>
                    <td colSpan={3} className="border border-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-800">{bulletin.employe_poste || '—'}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-800 px-2 py-1 text-[11px] text-slate-500">Département</td>
                    <td colSpan={3} className="border border-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-800">{bulletin.employe_departement || '—'}</td>
                    <td className="border border-slate-800 px-2 py-1 text-[11px] text-slate-500">Embauche</td>
                    <td colSpan={3} className="border border-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-800">{formatDate(bulletin.employe_date_embauche)}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-800 px-2 py-1 text-[11px] text-slate-500">Date de paiement</td>
                    <td colSpan={3} className="border border-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-800">{bulletin.date_paiement ? formatDate(bulletin.date_paiement) : '—'}</td>
                    <td className="border border-slate-800 px-2 py-1 text-[11px] text-slate-500">Mode de paiement</td>
                    <td colSpan={3} className="border border-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-800">{bulletin.mode_paiement || '—'}</td>
                  </tr>

                  {/* Salaire de base (éditable, pleine largeur) */}
                  <tr>
                    <td className="border border-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-700">Salaire de base</td>
                    <td colSpan={7} className="border border-slate-800 px-2 py-1">
                      <input type="number" className="w-full border-0 bg-transparent text-right text-sm font-semibold text-slate-800 outline-none print:appearance-none" value={bulletin.salaire_base || 0} onChange={(e) => upd('salaire_base', e.target.value)} />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Bloc 2 : Gains / Retenues (détaché du bloc supérieur) */}
              <table className="mt-4 w-full border-collapse border border-slate-800 text-sm">
                <tbody>
                  {/* En-têtes GAINS / RETENUES */}
                  <tr className="bg-slate-100 print:bg-slate-200">
                    <td colSpan={4} className="border border-slate-800 px-2 py-1.5 text-center text-xs font-bold uppercase text-slate-700">Gains</td>
                    <td colSpan={4} className="border border-slate-800 px-2 py-1.5 text-center text-xs font-bold uppercase text-slate-700">Retenues</td>
                  </tr>
                  <tr className="bg-slate-50 print:bg-slate-100">
                    <th className="border border-slate-800 px-2 py-1 text-left text-[10px] font-semibold text-slate-600">Désignation</th>
                    <th className="border border-slate-800 px-1 py-1 text-right text-[10px] font-semibold text-slate-600">Base</th>
                    <th className="border border-slate-800 px-1 py-1 text-right text-[10px] font-semibold text-slate-600">Taux</th>
                    <th className="border border-slate-800 px-1 py-1 text-right text-[10px] font-semibold text-slate-600">Montant</th>
                    <th className="border border-slate-800 px-2 py-1 text-left text-[10px] font-semibold text-slate-600">Désignation</th>
                    <th className="border border-slate-800 px-1 py-1 text-right text-[10px] font-semibold text-slate-600">Base</th>
                    <th className="border border-slate-800 px-1 py-1 text-right text-[10px] font-semibold text-slate-600">Taux</th>
                    <th className="border border-slate-800 px-1 py-1 text-right text-[10px] font-semibold text-slate-600">Montant</th>
                  </tr>

                  {/* Lignes GAINS / RETENUES — données côte à côte */}
                  {(() => {
                    const gains = [
                      { label: 'Heures supplémentaires', base: bulletin.heures_sup, baseUnit: 'h', taux: bulletin.taux_heure_sup, montant: bulletin.montant_heures_sup,
                        onBase: (v) => updHeuresSup('heures_sup', v), onTaux: (v) => updHeuresSup('taux_heure_sup', v) },
                      { label: 'Congés payés', base: bulletin.jours_conge_paye, baseUnit: 'j', taux: null, montant: bulletin.montant_conge,
                        onBase: (v) => upd('jours_conge_paye', v), onMontant: (v) => upd('montant_conge', v) },
                      { label: 'Prime de rendement', base: null, taux: null, montant: bulletin.prime_rendement,
                        onMontant: (v) => upd('prime_rendement', v) },
                      { label: "Prime d'ancienneté", base: null, taux: null, montant: bulletin.prime_anciennete,
                        onMontant: (v) => upd('prime_anciennete', v) },
                      { label: bulletin.autres_primes_libelle || 'Autres primes', base: null, taux: null, montant: bulletin.autres_primes,
                        isLibelle: true, onLibelle: (v) => upd('autres_primes_libelle', v), onMontant: (v) => upd('autres_primes', v) },
                      ...(bulletin.lignes_supplementaires_arr || []).filter(l => l.type !== 'deduction').map((l) => {
                        const realIdx = (bulletin.lignes_supplementaires_arr || []).findIndex(x => x === l)
                        return { label: l.libelle, base: null, taux: l.taux != null && l.taux !== '' ? l.taux : null, montant: l.montant, isLigne: true, ligneIdx: realIdx }
                      }),
                    ]
                    const retenues = [
                      { label: 'Avances sur salaires', base: null, taux: null, montant: bulletin.avances_salaire,
                        onMontant: (v) => upd('avances_salaire', v) },
                      { label: 'Retenue pour absence', base: bulletin.nb_jours_absence, baseUnit: 'j', taux: null, montant: bulletin.retenue_absence,
                        onBase: (v) => upd('nb_jours_absence', v), onMontant: (v) => upd('retenue_absence', v) },
                      ...(bulletin.lignes_supplementaires_arr || []).filter(l => l.type === 'deduction').map((l) => {
                        const realIdx = (bulletin.lignes_supplementaires_arr || []).findIndex(x => x === l)
                        return { label: l.libelle, base: null, taux: l.taux != null && l.taux !== '' ? l.taux : null, montant: l.montant, isLigne: true, ligneIdx: realIdx }
                      }),
                    ]
                    const maxRows = Math.max(gains.length, retenues.length)
                    const rows = []
                    for (let i = 0; i < maxRows; i++) {
                      const g = gains[i]
                      const r = retenues[i]
                      rows.push(
                        <tr key={i}>
                          {/* Gain */}
                          <td className="border border-slate-800 px-2 py-1 text-[11px] text-slate-700">
                            {g ? (g.isLibelle
                              ? <input type="text" className="w-full border-0 bg-transparent text-[11px] outline-none print:appearance-none" value={g.label} onChange={(e) => g.onLibelle(e.target.value)} />
                              : g.isLigne
                                ? <input type="text" className="w-full border-0 bg-transparent text-[11px] outline-none print:appearance-none" value={g.label || ''} onChange={(e) => updLigne(g.ligneIdx, 'libelle', e.target.value)} />
                                : g.label)
                              : ''}
                          </td>
                          <td className="border border-slate-800 px-1 py-1 text-right text-[11px] text-slate-600">
                            {g && g.base != null ? (
                              <span className="inline-flex items-center gap-0.5">
                                <input type="number" className="w-12 border-0 bg-transparent text-right text-[11px] outline-none print:appearance-none" value={g.base} onChange={(e) => g.onBase(e.target.value)} />
                                {g.baseUnit && <span className="text-[9px]">{g.baseUnit}</span>}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="border border-slate-800 px-1 py-1 text-right text-[11px] text-slate-600">
                            {g && g.isLigne ? (
                              <span className="inline-flex items-center gap-0.5">
                                <input type="number" className="w-14 border-0 bg-transparent text-right text-[11px] outline-none print:appearance-none" value={g.taux || ''} onChange={(e) => updLigne(g.ligneIdx, 'taux', e.target.value)} placeholder="—" />
                                <span className="text-[9px]">%</span>
                              </span>
                            ) : g && g.taux != null ? (
                              <span className="inline-flex items-center gap-0.5">
                                <input type="number" className="w-14 border-0 bg-transparent text-right text-[11px] outline-none print:appearance-none" value={g.taux} onChange={(e) => g.onTaux(e.target.value)} />
                                <span className="text-[9px]">%</span>
                              </span>
                            ) : '—'}
                          </td>
                          <td className="border border-slate-800 px-1 py-1 text-right text-[11px] font-medium text-slate-800">
                            {g ? (
                              g.isLigne
                                ? (g.label && g.label.trim() ? <span className="text-[11px] font-medium text-slate-800">{formatMoney(g.montant || 0, devise)}</span> : <span className="text-slate-300">—</span>)
                                : g.onMontant
                                  ? <input type="number" className="w-20 border-0 bg-transparent text-right text-[11px] font-medium outline-none print:appearance-none" value={g.montant || 0} onChange={(e) => g.onMontant(e.target.value)} />
                                  : formatMoney(g.montant || 0, devise)
                            ) : ''}
                          </td>

                          {/* Retenue */}
                          <td className="border border-slate-800 px-2 py-1 text-[11px] text-slate-700">
                            {r ? (r.isLibelle
                              ? <input type="text" className="w-full border-0 bg-transparent text-[11px] outline-none print:appearance-none" value={r.label} onChange={(e) => r.onLibelle(e.target.value)} />
                              : r.isLigne
                                ? <input type="text" className="w-full border-0 bg-transparent text-[11px] outline-none print:appearance-none" value={r.label || ''} onChange={(e) => updLigne(r.ligneIdx, 'libelle', e.target.value)} />
                                : r.label)
                              : ''}
                          </td>
                          <td className="border border-slate-800 px-1 py-1 text-right text-[11px] text-slate-600">
                            {r && r.base != null ? (
                              <span className="inline-flex items-center gap-0.5">
                                <input type="number" className="w-12 border-0 bg-transparent text-right text-[11px] outline-none print:appearance-none" value={r.base} onChange={(e) => r.onBase(e.target.value)} />
                                {r.baseUnit && <span className="text-[9px]">{r.baseUnit}</span>}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="border border-slate-800 px-1 py-1 text-right text-[11px] text-slate-600">
                            {r && r.isLigne ? (
                              <span className="inline-flex items-center gap-0.5">
                                <input type="number" className="w-14 border-0 bg-transparent text-right text-[11px] outline-none print:appearance-none" value={r.taux || ''} onChange={(e) => updLigne(r.ligneIdx, 'taux', e.target.value)} placeholder="—" />
                                <span className="text-[9px]">%</span>
                              </span>
                            ) : r && r.taux != null ? (
                              <span className="inline-flex items-center gap-0.5">
                                <input type="number" className="w-14 border-0 bg-transparent text-right text-[11px] outline-none print:appearance-none" value={r.taux} onChange={(e) => r.onTaux(e.target.value)} />
                                <span className="text-[9px]">%</span>
                              </span>
                            ) : '—'}
                          </td>
                          <td className="border border-slate-800 px-1 py-1 text-right text-[11px] font-medium text-slate-800">
                            {r ? (
                              r.isLigne
                                ? (r.label && r.label.trim() ? <span className="text-[11px] font-medium text-slate-800">{formatMoney(r.montant || 0, devise)}</span> : <span className="text-slate-300">—</span>)
                                : r.onMontant
                                  ? <input type="number" className="w-20 border-0 bg-transparent text-right text-[11px] font-medium outline-none print:appearance-none" value={r.montant || 0} onChange={(e) => r.onMontant(e.target.value)} />
                                  : formatMoney(r.montant || 0, devise)
                            ) : ''}
                          </td>
                        </tr>
                      )
                    }
                    return rows
                  })()}

                  {/* Bouton ajouter ligne — caché à l'impression */}
                  <tr className="print:hidden">
                    <td colSpan={4} className="border border-slate-300 px-2 py-1.5">
                      <button onClick={() => addLigne('gain')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">+ Ajouter une ligne de gain</button>
                    </td>
                    <td colSpan={4} className="border border-slate-300 px-2 py-1.5">
                      <button onClick={() => addLigne('deduction')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">+ Ajouter une retenue</button>
                    </td>
                  </tr>

                  {/* Totaux brut / retenues */}
                  <tr className="bg-slate-100 print:bg-slate-200">
                    <td colSpan={3} className="border border-slate-800 px-2 py-1.5 text-right text-xs font-bold text-slate-700">Total brut</td>
                    <td className="border border-slate-800 px-1 py-1.5 text-right text-xs font-bold text-slate-800">{formatMoney(calcBrut(bulletin), devise)}</td>
                    <td colSpan={3} className="border border-slate-800 px-2 py-1.5 text-right text-xs font-bold text-slate-700">Total retenues</td>
                    <td className="border border-slate-800 px-1 py-1.5 text-right text-xs font-bold text-red-600">{formatMoney(calcDeductions(bulletin), devise)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Bloc détaché : Salaire net + signatures */}
              <div className="mt-8">
                <table className="w-full border-collapse border border-slate-800 text-sm">
                  <tbody>
                    <tr className="bg-brand-600 print:bg-brand-600">
                      <td colSpan={7} className="border border-slate-800 px-3 py-2.5 text-right text-sm font-bold uppercase text-white">Salaire net à payer</td>
                      <td className="border border-slate-800 px-2 py-2.5 text-right text-base font-bold text-white">{formatMoney(calcNet(bulletin), devise)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Signatures */}
                <div className="mt-10 flex justify-between text-[10px] text-slate-500">
                  <div className="text-center">
                    <p className="font-semibold">L'employeur</p>
                    <div className="mt-12 border-t border-slate-400 pt-1 w-44">Signature et cachet</div>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">L'employé</p>
                    <div className="mt-12 border-t border-slate-400 pt-1 w-44">Signature</div>
                  </div>
                </div>

                {/* Note affichée sur le bulletin (visible à l'impression) */}
                <div className="mt-8 rounded-lg border-2 border-blue-500 bg-blue-50 px-4 py-2.5 text-center text-[11px] font-medium text-blue-800 print:border-blue-600 print:bg-blue-100">
                  {bulletin.notes || 'à conserver sans limitation de durée'}
                </div>
              </div>

              {/* Notes — champ de saisie, caché à l'impression */}
              <div className="mt-4 print:hidden">
                <label className="label">Note (affichée en bas du bulletin dans le cadre bleu)</label>
                <textarea className="input" rows={2} value={bulletin.notes || ''} onChange={(e) => upd('notes', e.target.value)} placeholder="à conserver sans limitation de durée" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
