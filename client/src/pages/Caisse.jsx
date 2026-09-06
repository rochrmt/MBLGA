import { useState, useEffect, useRef } from 'react'
import {
  Lock, Unlock, RefreshCw, History, Plus, ArrowDownCircle, ArrowUpCircle,
  Wallet, ArrowRightLeft, Settings2, Trash2, Printer, Eye, X,
  ShoppingCart, CreditCard, FileBarChart,
} from 'lucide-react'
import api, { formatMoney, formatDateTime } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { Modal, Spinner, useToast } from '../components/ui'
import { buildReceiptHtml } from '../lib/receiptTemplate'
import CaissePOS from './CaissePOS'
import CaisseCommandes from './CaisseCommandes'
import CaisseEtat from './CaisseEtat'
import CaisseHistorique from './CaisseHistorique'

const TABS = [
  { key: 'principale', label: 'Caisse Principale', icon: Wallet },
  { key: 'pos', label: 'Vente au comptoir', icon: ShoppingCart },
  { key: 'commandes', label: 'Commandes impayées', icon: CreditCard },
  { key: 'etat', label: 'État de caisse', icon: FileBarChart },
  { key: 'historique', label: 'Historique', icon: History },
  { key: 'petite', label: 'Petite Caisse', icon: ArrowRightLeft },
]

export default function Caisse() {
  const { devise, settings } = useSettings()
  const { canDelete, canPrint, canApprovisionner } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('principale')
  const [active, setActive] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [sessions, setSessions] = useState([])

  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [trModal, setTrModal] = useState(false)
  const [fond, setFond] = useState('')
  const [notes, setNotes] = useState('')
  const [fermeture, setFermeture] = useState('')
  const [tr, setTr] = useState({ montant: '', mode_paiement: 'especes', type: 'encaissement', notes: '' })
  const [trLignes, setTrLignes] = useState([])
  const [trProduit, setTrProduit] = useState({ nom: '', quantite: 1, prix: '' })

  // Petite caisse state
  const [pcData, setPcData] = useState(null)
  const [pcLoading, setPcLoading] = useState(false)
  const [approModal, setApproModal] = useState(false)
  const [pcTrModal, setPcTrModal] = useState(false)
  const [plafondModal, setPlafondModal] = useState(false)
  const [appro, setAppro] = useState({ montant: '', notes: '' })
  const [pcTr, setPcTr] = useState({ montant: '', type: 'depense', categorie: '', beneficiaire: '', notes: '' })
  const [newPlafond, setNewPlafond] = useState('')
  const [receipt, setReceipt] = useState(null)
  const iframeRef = useRef(null)

  const loadActive = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/caisse/session/active')
      setActive(data.session); setTransactions(data.transactions || []); setTotal(data.total || 0)
    } finally { setLoading(false) }
  }
  const loadSessions = async () => {
    try { const { data } = await api.get('/caisse/sessions', { params: { date } }); setSessions(data) } catch { /* */ }
  }
  const loadPetiteCaisse = async () => {
    setPcLoading(true)
    try { const { data } = await api.get('/caisse/petite-caisse'); setPcData(data) }
    catch { /* */ } finally { setPcLoading(false) }
  }
  useEffect(() => { loadActive() }, [])
  useEffect(() => { loadSessions() }, [date])
  useEffect(() => { if (tab === 'petite') loadPetiteCaisse() }, [tab])

  const ouvrir = async (e) => {
    e.preventDefault()
    try { await api.post('/caisse/open', { montant_ouverture: fond, notes }); toast.success('Caisse ouverte'); setOpenModal(false); setFond(''); setNotes(''); loadActive() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const fermer = async (e) => {
    e.preventDefault()
    try { await api.post('/caisse/close', { montant_fermeture: fermeture }); toast.success('Caisse fermée'); setCloseModal(false); setFermeture(''); loadActive(); loadSessions() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const addTr = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...tr, produits: trLignes.length > 0 ? trLignes : undefined }
      const { data } = await api.post('/caisse/transaction', payload)
      toast.success('Transaction enregistrée')
      setTrModal(false)
      setTr({ montant: '', mode_paiement: 'especes', type: 'encaissement', notes: '' })
      setTrLignes([])
      setTrProduit({ nom: '', quantite: 1, prix: '' })
      loadActive()
      if (tr.type === 'encaissement') {
        const newTr = { ...tr, id: data.id, date_transaction: new Date().toISOString(), produits: trLignes.length > 0 ? trLignes : null }
        printReceipt(newTr)
      }
    }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const approvisionner = async (e) => {
    e.preventDefault()
    try { await api.post('/caisse/petite-caisse/approvisionner', appro); toast.success('Petite caisse approvisionnée'); setApproModal(false); setAppro({ montant: '', notes: '' }); loadPetiteCaisse(); loadActive() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const addPcTr = async (e) => {
    e.preventDefault()
    try { await api.post('/caisse/petite-caisse/transaction', pcTr); toast.success('Transaction enregistrée'); setPcTrModal(false); setPcTr({ montant: '', type: 'depense', categorie: '', beneficiaire: '', notes: '' }); loadPetiteCaisse() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const updatePlafond = async (e) => {
    e.preventDefault()
    try { await api.put('/caisse/petite-caisse/plafond', { plafond: newPlafond }); toast.success('Plafond mis à jour'); setPlafondModal(false); setNewPlafond(''); loadPetiteCaisse() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const deleteTr = async (t) => {
    if (!confirm('Supprimer cette transaction ?')) return
    try { await api.delete(`/caisse/transaction/${t.id}`); toast.success('Transaction supprimée'); loadActive() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const deletePcTr = async (t) => {
    if (!confirm('Supprimer cette transaction ?')) return
    try { await api.delete(`/caisse/petite-caisse/transaction/${t.id}`); toast.success('Transaction supprimée'); loadPetiteCaisse() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  const printReceipt = (t) => {
    const html = buildReceiptHtml({ transaction: t, settings, devise })
    setReceipt({ html, transaction: t })
  }
  const doPrint = () => {
    const win = iframeRef.current?.contentWindow
    if (win) { win.focus(); win.print() }
  }

  if (loading && tab === 'principale') return <Spinner />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition
              ${tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'principale' ? (
        <>
      {active ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">Fond d'ouverture</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{formatMoney(active.montant_ouverture, devise)}</p>
              <p className="mt-1 text-xs text-slate-400">Ouverte le {formatDateTime(active.date_ouverture)}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">Mouvements</p>
              <p className="mt-2 text-2xl font-bold text-brand-600">{formatMoney(total, devise)}</p>
              <p className="mt-1 text-xs text-slate-400">{transactions.length} transaction(s)</p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">Solde théorique</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{formatMoney((active.montant_ouverture || 0) + total, devise)}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setTrModal(true)} className="btn-primary"><Plus size={18} /> Nouvelle transaction</button>
            <button onClick={() => setCloseModal(true)} className="btn-secondary"><Lock size={18} /> Fermer la caisse</button>
          </div>

          <div className="table-wrap">
            <div className="flex items-center gap-2 px-5 py-4 font-bold text-slate-800"><History size={17} /> Transactions de la session</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr><th className="table-th">Heure</th><th className="table-th">Type</th><th className="table-th">Mode</th><th className="table-th">Notes</th><th className="table-th text-right">Montant</th><th className="table-th"></th>{canDelete && <th className="table-th"></th>}</tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={canDelete ? 7 : 6} className="px-4 py-8 text-center text-sm text-slate-400">Aucune transaction</td></tr>
                  ) : transactions.map((t) => (
                    <tr key={t.id} className="table-row-hover">
                      <td className="table-td text-slate-500">{formatDateTime(t.date_transaction)}</td>
                      <td className="table-td">
                        <span className={`inline-flex items-center gap-1 text-sm font-medium ${t.type === 'retrait' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {t.type === 'retrait' ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
                          {t.type === 'retrait' ? 'Retrait' : 'Encaissement'}
                        </span>
                      </td>
                      <td className="table-td capitalize">{t.mode_paiement}</td>
                      <td className="table-td text-slate-500">{t.notes || '—'}</td>
                      <td className={`table-td text-right font-semibold ${t.type === 'retrait' ? 'text-red-600' : 'text-slate-800'}`}>
                        {t.type === 'retrait' ? '-' : '+'}{formatMoney(t.montant, devise)}
                      </td>
                      <td className="table-td">
                        {canPrint && <button onClick={() => printReceipt(t)} title="Imprimer le reçu" className="rounded p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"><Printer size={14} /></button>}
                      </td>
                      {canDelete && <td className="table-td"><button onClick={() => deleteTr(t)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400"><Lock size={30} /></span>
          <h2 className="text-xl font-bold text-slate-800">Caisse fermée</h2>
          <p className="max-w-sm text-slate-500">Ouvrez une session pour encaisser des factures ou enregistrer des ventes au comptoir.</p>
          <button onClick={() => setOpenModal(true)} className="btn-primary mt-2"><Unlock size={18} /> Ouvrir la caisse</button>
        </div>
      )}

      <div className="table-wrap">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex items-center gap-2 font-bold text-slate-800"><History size={17} /> Historique des sessions</span>
          <div className="ml-auto flex items-center gap-2">
            <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
            <button onClick={loadSessions} className="btn-secondary"><RefreshCw size={15} /> Actualiser</button>
            <button onClick={() => setDate(new Date().toISOString().slice(0, 10))} className="text-sm font-semibold text-brand-600">Aujourd'hui</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {sessions.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Aucune session pour cette date</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr><th className="table-th">Ouverture</th><th className="table-th">Fermeture</th><th className="table-th text-right">Fond</th><th className="table-th text-right">Mouvements</th><th className="table-th">Statut</th></tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="table-row-hover">
                    <td className="table-td text-slate-500">{formatDateTime(s.date_ouverture)}</td>
                    <td className="table-td text-slate-500">{s.date_fermeture ? formatDateTime(s.date_fermeture) : '—'}</td>
                    <td className="table-td text-right">{formatMoney(s.montant_ouverture, devise)}</td>
                    <td className="table-td text-right font-semibold text-slate-800">{formatMoney(s.total_transactions, devise)}</td>
                    <td className="table-td">
                      <span className={`badge ${s.statut === 'ouverte' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {s.statut === 'ouverte' ? 'Ouverte' : 'Fermée'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
        </>
      ) : tab === 'pos' ? (
        active ? <CaissePOS settings={settings} devise={devise} onTransaction={loadActive} /> : (
          <div className="card flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400"><Lock size={30} /></span>
            <h2 className="text-xl font-bold text-slate-800">Caisse fermée</h2>
            <p className="max-w-sm text-slate-500">Ouvrez une session de caisse pour effectuer des ventes au comptoir.</p>
            <button onClick={() => setOpenModal(true)} className="btn-primary mt-2"><Unlock size={18} /> Ouvrir la caisse</button>
          </div>
        )
      ) : tab === 'commandes' ? (
        active ? <CaisseCommandes settings={settings} devise={devise} onTransaction={loadActive} /> : (
          <div className="card flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400"><Lock size={30} /></span>
            <h2 className="text-xl font-bold text-slate-800">Caisse fermée</h2>
            <p className="max-w-sm text-slate-500">Ouvrez une session de caisse pour encaisser les commandes.</p>
            <button onClick={() => setOpenModal(true)} className="btn-primary mt-2"><Unlock size={18} /> Ouvrir la caisse</button>
          </div>
        )
      ) : tab === 'etat' ? (
        <CaisseEtat devise={devise} />
      ) : tab === 'historique' ? (
        <CaisseHistorique devise={devise} />
      ) : pcLoading ? <Spinner /> : pcData?.petite_caisse ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">Solde actuel</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{formatMoney(pcData.petite_caisse.solde, devise)}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">Plafond</p>
              <p className="mt-2 text-2xl font-bold text-brand-600">{formatMoney(pcData.petite_caisse.plafond, devise)}</p>
              <button type="button" onClick={() => { setNewPlafond(String(pcData.petite_caisse.plafond)); setPlafondModal(true) }} className="mt-1 text-xs font-semibold text-brand-600 hover:underline">Modifier</button>
            </div>
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">Total approvisionnements</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{formatMoney(pcData.total_approvisionnements, devise)}</p>
              <p className="mt-1 text-xs text-slate-400">Dépenses: {formatMoney(pcData.total_depenses, devise)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {canApprovisionner && (
              <button type="button" onClick={() => setApproModal(true)} className="btn-primary"><ArrowRightLeft size={18} /> Approvisionner depuis la caisse</button>
            )}
            <button type="button" onClick={() => setPcTrModal(true)} className="btn-secondary"><Plus size={18} /> Nouvelle transaction</button>
          </div>

          <div className="table-wrap">
            <div className="flex items-center gap-2 px-5 py-4 font-bold text-slate-800"><History size={17} /> Historique des transactions</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr><th className="table-th">Date</th><th className="table-th">Type</th><th className="table-th">Catégorie</th><th className="table-th">Bénéficiaire</th><th className="table-th">Notes</th><th className="table-th text-right">Montant</th><th className="table-th"></th>{canDelete && <th className="table-th"></th>}</tr>
                </thead>
                <tbody>
                  {pcData.transactions.length === 0 ? (
                    <tr><td colSpan={canDelete ? 8 : 7} className="px-4 py-8 text-center text-sm text-slate-400">Aucune transaction</td></tr>
                  ) : pcData.transactions.map((t) => (
                    <tr key={t.id} className="table-row-hover">
                      <td className="table-td text-slate-500">{formatDateTime(t.date_transaction)}</td>
                      <td className="table-td">
                        <span className={`badge ${t.type === 'approvisionnement' ? 'bg-brand-100 text-brand-600' : t.type === 'entree' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {t.type === 'approvisionnement' ? 'Approvisionnement' : t.type === 'entree' ? 'Entrée' : 'Dépense'}
                        </span>
                      </td>
                      <td className="table-td">{t.categorie || '—'}</td>
                      <td className="table-td">{t.beneficiaire || '—'}</td>
                      <td className="table-td text-slate-500">{t.notes || '—'}</td>
                      <td className={`table-td text-right font-semibold ${t.type === 'depense' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {t.type === 'depense' ? '-' : '+'}{formatMoney(t.montant, devise)}
                      </td>
                      <td className="table-td">
                        {canPrint && <button onClick={() => printReceipt({ ...t, mode_paiement: 'especes', type: t.type === 'depense' ? 'retrait' : 'encaissement' })} title="Imprimer le reçu" className="rounded p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"><Printer size={14} /></button>}
                      </td>
                      {canDelete && <td className="table-td"><button onClick={() => deletePcTr(t)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400"><Wallet size={30} /></span>
          <h2 className="text-xl font-bold text-slate-800">Petite caisse non configurée</h2>
          <p className="max-w-sm text-slate-500">La petite caisse sera créée automatiquement au prochain démarrage du serveur.</p>
        </div>
      )}

      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Ouvrir la caisse" icon={Unlock} size="sm">
        <form onSubmit={ouvrir} className="space-y-4">
          <div><label className="label">Fond de caisse initial ({devise})</label>
            <input type="number" className="input" value={fond} onChange={(e) => setFond(e.target.value)} placeholder="0" autoFocus /></div>
          <div><label className="label">Notes</label>
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex gap-3"><button type="button" onClick={() => setOpenModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" className="btn-primary flex-1"><Unlock size={17} /> Ouvrir</button></div>
        </form>
      </Modal>

      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Fermer la caisse" icon={Lock} size="sm">
        <form onSubmit={fermer} className="space-y-4">
          <div><label className="label">Montant compté en caisse ({devise})</label>
            <input type="number" className="input" value={fermeture} onChange={(e) => setFermeture(e.target.value)} placeholder="0" autoFocus /></div>
          <div className="flex gap-3"><button type="button" onClick={() => setCloseModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" className="btn-danger flex-1"><Lock size={17} /> Fermer</button></div>
        </form>
      </Modal>

      <Modal open={trModal} onClose={() => setTrModal(false)} title="Nouvelle transaction" icon={Plus} size="md">
        <form onSubmit={addTr} className="space-y-4">
          <div><label className="label">Type</label>
            <div className="grid grid-cols-2 gap-3">
              {[['encaissement', 'Encaissement'], ['retrait', 'Retrait']].map(([v, l]) => (
                <button type="button" key={v} onClick={() => setTr({ ...tr, type: v })}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${tr.type === v ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-600'}`}>{l}</button>
              ))}
            </div>
          </div>

          {tr.type === 'encaissement' && (
            <div>
              <label className="label">Articles (optionnel)</label>
              {trLignes.length > 0 && (
                <div className="mb-2 space-y-1">
                  {trLignes.map((l, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                      <span className="text-slate-700">{l.nom} x{l.quantite}</span>
                      <span className="font-semibold text-slate-800">{formatMoney(l.prix * l.quantite, devise)}</span>
                      <button type="button" onClick={() => setTrLignes(trLignes.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Nom de l'article" value={trProduit.nom} onChange={(e) => setTrProduit({ ...trProduit, nom: e.target.value })} />
                <input type="number" className="input w-16" placeholder="Qte" value={trProduit.quantite} onChange={(e) => setTrProduit({ ...trProduit, quantite: e.target.value })} />
                <input type="number" className="input w-24" placeholder="Prix" value={trProduit.prix} onChange={(e) => setTrProduit({ ...trProduit, prix: e.target.value })} />
                <button type="button" onClick={() => {
                  if (!trProduit.nom || !trProduit.prix) return
                  setTrLignes([...trLignes, { nom: trProduit.nom, quantite: Number(trProduit.quantite) || 1, prix: Number(trProduit.prix) || 0 }])
                  setTrProduit({ nom: '', quantite: 1, prix: '' })
                }} className="btn-secondary px-3"><Plus size={16} /></button>
              </div>
              {trLignes.length > 0 && (
                <button type="button" onClick={() => {
                  const total = trLignes.reduce((s, l) => s + l.prix * l.quantite, 0)
                  setTr({ ...tr, montant: String(total) })
                }} className="mt-1 text-xs font-semibold text-brand-600 hover:underline">Calculer le total automatiquement</button>
              )}
            </div>
          )}

          <div><label className="label">Montant ({devise})</label>
            <input type="number" className="input" value={tr.montant} onChange={(e) => setTr({ ...tr, montant: e.target.value })} required autoFocus /></div>
          <div><label className="label">Mode de paiement</label>
            <select className="input" value={tr.mode_paiement} onChange={(e) => setTr({ ...tr, mode_paiement: e.target.value })}>
              <option value="especes">Espèces</option><option value="carte">Carte</option>
              <option value="virement">Virement</option><option value="mobile">Mobile Money</option><option value="cheque">Chèque</option>
            </select></div>
          <div><label className="label">Notes</label>
            <input className="input" value={tr.notes} onChange={(e) => setTr({ ...tr, notes: e.target.value })} /></div>
          <div className="flex gap-3"><button type="button" onClick={() => setTrModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" className="btn-primary flex-1">{tr.type === 'encaissement' && canPrint ? <><Printer size={16} /> Encaisser & Imprimer</> : 'Enregistrer'}</button></div>
        </form>
      </Modal>

      <Modal open={approModal} onClose={() => setApproModal(false)} title="Approvisionner la petite caisse" icon={ArrowRightLeft} size="sm">
        <form onSubmit={approvisionner} className="space-y-4">
          <p className="text-sm text-slate-500">Un retrait sera enregistré dans la caisse principale et le montant sera ajouté à la petite caisse.</p>
          <div><label className="label">Montant à transférer ({devise})</label>
            <input type="number" className="input" value={appro.montant} onChange={(e) => setAppro({ ...appro, montant: e.target.value })} required autoFocus /></div>
          <div><label className="label">Notes</label>
            <input className="input" value={appro.notes} onChange={(e) => setAppro({ ...appro, notes: e.target.value })} /></div>
          <div className="flex gap-3"><button type="button" onClick={() => setApproModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" className="btn-primary flex-1"><ArrowRightLeft size={17} /> Approvisionner</button></div>
        </form>
      </Modal>

      <Modal open={pcTrModal} onClose={() => setPcTrModal(false)} title="Transaction petite caisse" icon={Plus} size="sm">
        <form onSubmit={addPcTr} className="space-y-4">
          <div><label className="label">Type</label>
            <div className="grid grid-cols-2 gap-3">
              {[['depense', 'Dépense'], ['entree', 'Entrée']].map(([v, l]) => (
                <button type="button" key={v} onClick={() => setPcTr({ ...pcTr, type: v })}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${pcTr.type === v ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-600'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div><label className="label">Montant ({devise})</label>
            <input type="number" className="input" value={pcTr.montant} onChange={(e) => setPcTr({ ...pcTr, montant: e.target.value })} required autoFocus /></div>
          <div><label className="label">Catégorie</label>
            <input className="input" value={pcTr.categorie} onChange={(e) => setPcTr({ ...pcTr, categorie: e.target.value })} placeholder="Ex: Transport, Fournitures, Repas..." /></div>
          <div><label className="label">Bénéficiaire</label>
            <input className="input" value={pcTr.beneficiaire} onChange={(e) => setPcTr({ ...pcTr, beneficiaire: e.target.value })} /></div>
          <div><label className="label">Notes</label>
            <input className="input" value={pcTr.notes} onChange={(e) => setPcTr({ ...pcTr, notes: e.target.value })} /></div>
          <div className="flex gap-3"><button type="button" onClick={() => setPcTrModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" className="btn-primary flex-1">Enregistrer</button></div>
        </form>
      </Modal>

      <Modal open={plafondModal} onClose={() => setPlafondModal(false)} title="Modifier le plafond" icon={Settings2} size="sm">
        <form onSubmit={updatePlafond} className="space-y-4">
          <div><label className="label">Nouveau plafond ({devise})</label>
            <input type="number" className="input" value={newPlafond} onChange={(e) => setNewPlafond(e.target.value)} required autoFocus /></div>
          <div className="flex gap-3"><button type="button" onClick={() => setPlafondModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" className="btn-primary flex-1">Enregistrer</button></div>
        </form>
      </Modal>

      {/* ── Aperçu du reçu ──────────────────────────────────────────────── */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-4 sm:p-8" onClick={() => setReceipt(null)}>
          <div className="mx-auto flex h-full w-full max-w-sm flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-800"><Eye size={18} /> Reçu de caisse</div>
              <div className="flex items-center gap-2">
                <button onClick={doPrint} className="btn-primary py-2"><Printer size={16} /> Imprimer</button>
                <button onClick={() => setReceipt(null)} className="btn-secondary py-2">Fermer</button>
              </div>
            </div>
            <iframe ref={iframeRef} title="Reçu" srcDoc={receipt.html} className="h-full w-full flex-1 bg-white" />
          </div>
        </div>
      )}
    </div>
  )
}
