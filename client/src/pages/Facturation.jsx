import { useState, useEffect, useMemo, useRef } from 'react'
import {
  FileText, Plus, Trash2, Save, Search, Send, CreditCard, Printer, Eye, Truck, FileCheck, Pencil,
} from 'lucide-react'
import api, { formatMoney, formatDate } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { StatCard, Badge, Modal, Spinner, EmptyState, useToast } from '../components/ui'
import { DOC_TYPES, docTitle, buildDocHtml, computeTotals } from '../lib/docTemplate'

const TABS = [
  { key: 'toutes', label: 'Tous' }, { key: 'bon_livraison', label: 'Bons de livraison' },
  { key: 'facture_proforma', label: 'Proformas' }, { key: 'facture_definitive', label: 'Factures' },
]

const MODES_REGLEMENT = ['Espèce', 'Virement bancaire', 'Chèque', 'Mobile Money', 'À crédit']

const emptyLigne = () => ({
  reference: '', description: '', unite: '', quantite: 1, qte_commandee: 1, qte_livree: 1,
  prix_unitaire: 0, main_oeuvre: 0, remise: 0,
})

const emptyForm = () => ({
  type_document: 'facture_definitive', client_id: '', commande_id: '', date_echeance: '',
  client_nom_libre: '', client_adresse_libre: '', objet: '', signature_auto: false,
  conditions_reglement: 'À réception de commande', mode_reglement: 'Espèce',
  delai_livraison: '', duree_garantie: '', taux_tva: '0', remise_globale: '0', avance: '0',
})

export default function Facturation() {
  const { devise, settings } = useSettings()
  const { canDelete, canPrint } = useAuth()
  const toast = useToast()
  const [factures, setFactures] = useState([])
  const [clients, setClients] = useState([])
  const [commandes, setCommandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('toutes')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState(emptyForm())
  const [lignes, setLignes] = useState([emptyLigne()])

  // Aperçu / impression
  const [preview, setPreview] = useState(null) // { html }
  const iframeRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const [f, c, cmd] = await Promise.all([api.get('/facturation'), api.get('/clients'), api.get('/commandes')])
      setFactures(f.data); setClients(c.data); setCommandes(cmd.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return factures.filter((f) => {
      const okTab = tab === 'toutes' || f.type_document === tab
      const okQ = !s || [f.numero, f.client_nom, f.client_nom_libre].some((v) => (v || '').toLowerCase().includes(s))
      return okTab && okQ
    })
  }, [factures, tab, q])

  const stats = useMemo(() => ({
    total: factures.length,
    bl: factures.filter((f) => f.type_document === 'bon_livraison').length,
    proforma: factures.filter((f) => f.type_document === 'facture_proforma').length,
    encaisse: factures.reduce((s, f) => s + (f.montant_paye || 0), 0),
  }), [factures])

  const isBL = form.type_document === 'bon_livraison'

  const setLigne = (i, patch) => setLignes((ls) => ls.map((l, j) => j === i ? { ...l, ...patch } : l))
  const addLigne = () => setLignes((ls) => [...ls, emptyLigne()])
  const removeLigne = (i) => setLignes((ls) => ls.filter((_, j) => j !== i))

  const totals = useMemo(
    () => computeTotals(lignes, form.taux_tva, form.remise_globale, form.avance),
    [lignes, form.taux_tva, form.remise_globale, form.avance],
  )

  const openNew = () => {
    setForm(emptyForm())
    setLignes([emptyLigne()])
    setEditingId(null)
    setModal(true)
  }

  const openEdit = async (f) => {
    try {
      const { data } = await api.get(`/facturation/${f.id}`)
      setForm({
        type_document: data.type_document,
        client_id: data.client_id || '',
        commande_id: data.commande_id || '',
        date_echeance: data.date_echeance ? data.date_echeance.split('T')[0] : '',
        client_nom_libre: data.client_nom_libre || '',
        client_adresse_libre: data.client_adresse_libre || '',
        objet: data.objet || '',
        signature_auto: !!data.signature_auto,
        conditions_reglement: data.conditions_reglement || 'À réception de commande',
        mode_reglement: data.mode_reglement || 'Espèce',
        delai_livraison: data.delai_livraison || '',
        duree_garantie: data.duree_garantie || '',
        taux_tva: String(data.taux_tva ?? '0'),
        remise_globale: String(data.remise_globale ?? '0'),
        avance: String(data.avance ?? '0'),
      })
      setLignes(data.lignes.length ? data.lignes.map((l) => ({
        reference: l.reference || '',
        description: l.description || '',
        unite: l.unite || '',
        quantite: l.quantite ?? 1,
        qte_commandee: l.qte_commandee ?? 1,
        qte_livree: l.qte_livree ?? 1,
        prix_unitaire: l.prix_unitaire ?? 0,
        main_oeuvre: l.main_oeuvre ?? 0,
        remise: l.remise ?? 0,
      })) : [emptyLigne()])
      setEditingId(f.id)
      setModal(true)
    } catch { toast.error('Erreur lors du chargement du document') }
  }

  const onSelectClient = (client_id) => {
    const c = clients.find((x) => String(x.id) === String(client_id))
    setForm((f) => ({
      ...f, client_id,
      client_nom_libre: c?.nom || f.client_nom_libre,
      client_adresse_libre: c?.adresse || f.client_adresse_libre,
    }))
  }

  const onCommande = async (commande_id) => {
    setForm((f) => ({ ...f, commande_id }))
    if (!commande_id) return
    try {
      const { data } = await api.get(`/commandes/${commande_id}`)
      const c = clients.find((x) => String(x.id) === String(data.client_id))
      setForm((f) => ({ ...f, client_id: data.client_id, client_nom_libre: c?.nom || '', client_adresse_libre: c?.adresse || '' }))
      setLignes(data.lignes.map((l) => ({
        ...emptyLigne(),
        reference: l.produit_code || '', description: l.produit_nom,
        quantite: l.quantite, qte_commandee: l.quantite, qte_livree: l.quantite,
        prix_unitaire: l.prix_unitaire, remise: l.remise,
      })))
    } catch { /* */ }
  }

  const buildPayload = () => {
    const valid = lignes.filter((l) => (l.description || '').trim() || (l.reference || '').trim())
    return { valid, payload: {
      type_document: form.type_document,
      client_id: form.client_id || null, commande_id: form.commande_id || null,
      date_echeance: form.date_echeance || null,
      client_nom_libre: form.client_nom_libre || null,
      client_adresse_libre: form.client_adresse_libre || null,
      objet: form.objet || null, signature_auto: form.signature_auto,
      conditions_reglement: form.conditions_reglement || null, mode_reglement: form.mode_reglement || null,
      delai_livraison: form.delai_livraison || null, duree_garantie: form.duree_garantie || null,
      taux_tva: form.taux_tva, remise_globale: form.remise_globale, avance: form.avance,
      lignes: valid,
    } }
  }

  // Générer + Prévisualiser : enregistre le document puis affiche l'aperçu
  const submit = async (e) => {
    e.preventDefault()
    const { valid, payload } = buildPayload()
    if (!valid.length) return toast.error('Ajoutez au moins une ligne')
    setSaving(true)
    try {
      if (editingId) {
        const { data } = await api.put(`/facturation/${editingId}`, payload)
        toast.success(`${docTitle(form.type_document)} ${data.numero} modifié(e)`)
        const html = buildDocHtml({
          doc: { ...form, date: new Date() }, lignes: valid, settings, devise, numero: data.numero,
        })
        setModal(false)
        setPreview({ html })
        load()
      } else {
        const { data } = await api.post('/facturation', payload)
        toast.success(`${docTitle(form.type_document)} ${data.numero} généré(e)`)
        const html = buildDocHtml({
          doc: { ...form, date: new Date() }, lignes: valid, settings, devise, numero: data.numero,
        })
        setModal(false)
        setPreview({ html })
        load()
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur') } finally { setSaving(false) }
  }

  // Aperçu d'un document existant depuis la liste
  const previewExisting = async (f) => {
    try {
      const { data } = await api.get(`/facturation/${f.id}`)
      const html = buildDocHtml({
        doc: {
          ...data, date: data.date_emission,
          taux_tva: data.taux_tva, remise_globale: data.remise_globale, avance: data.avance,
          signature_auto: data.signature_auto,
        },
        lignes: data.lignes, settings, devise, numero: data.numero,
      })
      setPreview({ html })
    } catch { toast.error('Erreur lors du chargement du document') }
  }

  const printPreview = () => {
    const win = iframeRef.current?.contentWindow
    if (win) { win.focus(); win.print() }
  }

  const setStatut = async (f, statut) => {
    try { await api.put(`/facturation/${f.id}/statut`, { statut }); toast.success('Statut mis à jour'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const payer = async (f) => {
    const reste = f.total_ttc - (f.montant_paye || 0)
    const m = prompt(`Montant à encaisser (reste ${formatMoney(reste, devise)})`, String(reste))
    if (m == null) return
    try { await api.post(`/facturation/${f.id}/paiement`, { montant: Number(m) }); toast.success('Paiement enregistré'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }
  const remove = async (f) => {
    if (!confirm(`Supprimer la facture ${f.numero} ?`)) return
    try { await api.delete(`/facturation/${f.id}`); toast.success('Facture supprimée'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Erreur') }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total documents" value={stats.total} icon={FileText} color="slate" />
        <StatCard label="Bons de livraison" value={stats.bl} icon={Truck} color="orange" />
        <StatCard label="Proformas" value={stats.proforma} icon={FileCheck} color="brand" />
        <StatCard label="CA encaissé" value={formatMoney(stats.encaisse, devise)} color="green" />
      </div>

      <div className="table-wrap">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition
                ${tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>{t.label}</button>
          ))}
          <div className="relative ml-auto min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 py-2" placeholder="N° document, client..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button onClick={openNew} className="btn-primary py-1.5"><Plus size={16} /> Nouveau</button>
        </div>

        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun document"
            action={<button onClick={openNew} className="text-sm font-semibold text-brand-600">Créer le premier document</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">N°</th><th className="table-th">Type</th><th className="table-th">Client</th>
                  <th className="table-th">Émission</th>
                  <th className="table-th text-right">Total TTC</th><th className="table-th">Statut</th><th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className="table-row-hover">
                    <td className="table-td font-semibold text-slate-800">{f.numero}</td>
                    <td className="table-td text-slate-600">{docTitle(f.type_document)}</td>
                    <td className="table-td text-slate-600">{f.client_nom || f.client_nom_libre || '—'}</td>
                    <td className="table-td text-slate-500">{formatDate(f.date_emission)}</td>
                    <td className="table-td text-right font-semibold text-slate-800">{formatMoney(f.total_ttc, devise)}</td>
                    <td className="table-td"><Badge status={f.statut} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        {canPrint && <button onClick={() => previewExisting(f)} title="Aperçu / Imprimer" className="rounded p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"><Printer size={15} /></button>}
                        <button onClick={() => openEdit(f)} title="Modifier" className="rounded p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Pencil size={15} /></button>
                        {f.statut === 'brouillon' && <button onClick={() => setStatut(f, 'emise')} title="Émettre" className="rounded p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"><Send size={15} /></button>}
                        {['emise', 'partielle'].includes(f.statut) && <button onClick={() => payer(f)} title="Encaisser" className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><CreditCard size={15} /></button>}
                        {canDelete && <button onClick={() => remove(f)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Formulaire de saisie ─────────────────────────────────────────── */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={`${editingId ? 'Modifier' : 'Nouveau'} document — ${docTitle(form.type_document)}`} icon={FileText} size="xl">
        <form onSubmit={submit} className="space-y-5">
          {/* Informations du document */}
          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-2 text-xs font-bold uppercase tracking-wide text-slate-500">Informations du document</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Type de document</label>
                <select className="input" value={form.type_document} onChange={(e) => setForm({ ...form, type_document: e.target.value })}>
                  {DOC_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Date d'échéance (optionnel)</label>
                <input type="date" className="input" value={form.date_echeance} onChange={(e) => setForm({ ...form, date_echeance: e.target.value })} />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-600">
              <input type="checkbox" checked={form.signature_auto} onChange={(e) => setForm({ ...form, signature_auto: e.target.checked })} />
              Intégrer une signature automatique
            </label>
          </fieldset>

          {/* Destinataire */}
          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-2 text-xs font-bold uppercase tracking-wide text-slate-500">Destinataire (Client)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Sélectionner un client</label>
                <select className="input" value={form.client_id} onChange={(e) => onSelectClient(e.target.value)}>
                  <option value="">— Saisie libre —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Commande liée (optionnel)</label>
                <select className="input" value={form.commande_id} onChange={(e) => onCommande(e.target.value)}>
                  <option value="">— Aucune —</option>
                  {commandes.map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.client_nom}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Nom</label>
                <input className="input" value={form.client_nom_libre} onChange={(e) => setForm({ ...form, client_nom_libre: e.target.value })} placeholder="Nom du client" />
              </div>
              <div>
                <label className="label">Adresse</label>
                <textarea className="input" rows={2} value={form.client_adresse_libre} onChange={(e) => setForm({ ...form, client_adresse_libre: e.target.value })} placeholder="Adresse du client" />
              </div>
            </div>
          </fieldset>

          {/* Objet */}
          <div>
            <label className="label">Objet / Notes additionnelles</label>
            <textarea className="input" rows={2} value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} placeholder="Objet du document..." />
          </div>

          {/* Modalités de règlement (factures uniquement) */}
          {!isBL && (
            <fieldset className="rounded-lg border border-slate-200 p-4">
              <legend className="px-2 text-xs font-bold uppercase tracking-wide text-slate-500">Modalités de règlement</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Conditions</label>
                  <input className="input" value={form.conditions_reglement} onChange={(e) => setForm({ ...form, conditions_reglement: e.target.value })} placeholder="À réception de commande" />
                </div>
                <div>
                  <label className="label">Mode</label>
                  <select className="input" value={form.mode_reglement} onChange={(e) => setForm({ ...form, mode_reglement: e.target.value })}>
                    {MODES_REGLEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>
          )}

          {/* Lignes du document */}
          <div className="flex items-center justify-between">
            <label className="label mb-0">Lignes du document</label>
            <button type="button" onClick={addLigne} className="flex items-center gap-1 text-sm font-semibold text-brand-600"><Plus size={15} /> Ajouter une ligne</button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                {isBL ? (
                  <tr>
                    <th className="px-3 py-2 text-left">Réf.</th><th className="px-3 py-2 text-left">Désignation</th>
                    <th className="px-3 py-2">Qté commandée</th><th className="px-3 py-2">Qté livrée</th><th></th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-3 py-2 text-left">Réf.</th><th className="px-3 py-2 text-left">Désignation</th>
                    <th className="px-3 py-2">Unité</th><th className="px-3 py-2">Qté</th><th className="px-3 py-2">P.U. HT</th>
                    <th className="px-3 py-2">Main d'œuvre</th><th className="px-3 py-2 text-right">Total HT</th><th></th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lignes.map((l, i) => {
                  const totalLigne = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise) || 0) / 100)
                  return (
                    <tr key={i}>
                      <td className="px-2 py-2 w-28"><input className="input" value={l.reference} onChange={(e) => setLigne(i, { reference: e.target.value })} placeholder="Réf." /></td>
                      <td className="px-2 py-2"><input className="input" value={l.description} onChange={(e) => setLigne(i, { description: e.target.value })} placeholder="Désignation..." /></td>
                      {isBL ? (
                        <>
                          <td className="px-2 py-2 w-24"><input type="number" min="0" className="input" value={l.qte_commandee} onChange={(e) => setLigne(i, { qte_commandee: e.target.value })} /></td>
                          <td className="px-2 py-2 w-24"><input type="number" min="0" className="input" value={l.qte_livree} onChange={(e) => setLigne(i, { qte_livree: e.target.value })} /></td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-2 w-20"><input className="input" value={l.unite} onChange={(e) => setLigne(i, { unite: e.target.value })} placeholder="Unité" /></td>
                          <td className="px-2 py-2 w-28"><input type="number" min="0" className="input" value={l.quantite} onChange={(e) => setLigne(i, { quantite: e.target.value })} /></td>
                          <td className="px-2 py-2 w-28"><input type="number" step="0.01" className="input" value={l.prix_unitaire} onChange={(e) => setLigne(i, { prix_unitaire: e.target.value })} /></td>
                          <td className="px-2 py-2 w-28"><input type="number" step="0.01" className="input" value={l.main_oeuvre} onChange={(e) => setLigne(i, { main_oeuvre: e.target.value })} /></td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatMoney(totalLigne, devise)}</td>
                        </>
                      )}
                      <td className="px-2">{lignes.length > 1 && <button type="button" onClick={() => removeLigne(i)} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totaux */}
          {isBL ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Délais de livraison</label>
                <input className="input" value={form.delai_livraison} onChange={(e) => setForm({ ...form, delai_livraison: e.target.value })} placeholder="Ex : 1 mois" />
              </div>
              <div>
                <label className="label">Durée de garantie</label>
                <input className="input" value={form.duree_garantie} onChange={(e) => setForm({ ...form, duree_garantie: e.target.value })} placeholder="Ex : 1 an" />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Taux TVA (%)</label>
                  <input type="number" className="input" value={form.taux_tva} onChange={(e) => setForm({ ...form, taux_tva: e.target.value })} />
                </div>
                <div>
                  <label className="label">Remise</label>
                  <input type="number" className="input" value={form.remise_globale} onChange={(e) => setForm({ ...form, remise_globale: e.target.value })} />
                </div>
                <div>
                  <label className="label">Avance</label>
                  <input type="number" className="input" value={form.avance} onChange={(e) => setForm({ ...form, avance: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
                <div className="flex justify-between text-slate-500"><span>Total HT</span><span>{formatMoney(totals.ht, devise)}</span></div>
                {Number(form.taux_tva) > 0 && <div className="flex justify-between text-slate-500"><span>TVA</span><span>{formatMoney(totals.tva, devise)}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span>Total TTC</span><span>{formatMoney(totals.ttc, devise)}</span></div>
                {totals.remise > 0 && <div className="flex justify-between text-slate-500"><span>Remise</span><span>- {formatMoney(totals.remise, devise)}</span></div>}
                {totals.avance > 0 && <div className="flex justify-between text-slate-500"><span>Avance</span><span>- {formatMoney(totals.avance, devise)}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-brand-600"><span>Net à payer</span><span>{formatMoney(totals.reste, devise)}</span></div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1"><Save size={17} /> {editingId ? 'Enregistrer + Prévisualiser' : 'Générer + Prévisualiser'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Aperçu + Impression ──────────────────────────────────────────── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-4 sm:p-8" onClick={() => setPreview(null)}>
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2 font-bold text-slate-800"><Eye size={18} /> Aperçu du document</div>
              <div className="flex items-center gap-2">
                {canPrint && <button onClick={printPreview} className="btn-primary py-2"><Printer size={16} /> Imprimer</button>}
                <button onClick={() => setPreview(null)} className="btn-secondary py-2">Fermer</button>
              </div>
            </div>
            <iframe ref={iframeRef} title="Aperçu" srcDoc={preview.html} className="h-full w-full flex-1 bg-white" />
          </div>
        </div>
      )}
    </div>
  )
}
