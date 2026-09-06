import { useState, useEffect } from 'react'
import { Search, CreditCard, Eye, Printer, X } from 'lucide-react'
import api, { formatMoney, formatDate } from '../lib/api'
import { useSettings } from '../context/Settings'
import { Modal, Spinner, useToast } from '../components/ui'
import { buildReceiptHtml } from '../lib/receiptTemplate'
import { useRef } from 'react'

export default function CaisseCommandes({ settings, devise, onTransaction }) {
  const toast = useToast()
  const [commandes, setCommandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modePaiement, setModePaiement] = useState('especes')
  const [receipt, setReceipt] = useState(null)
  const iframeRef = useRef(null)

  const load = () => {
    setLoading(true)
    api.get('/commandes/livrees-impayees').then(({ data }) => setCommandes(data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = commandes.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.numero?.toLowerCase().includes(q) || c.client_nom?.toLowerCase().includes(q)
  })

  const encaisser = async () => {
    if (!selected) return
    try {
      const { data } = await api.post(`/caisse/encaisser-commande/${selected.id}`, { mode_paiement: modePaiement })
      toast.success(`Commande ${data.numero} encaissée (${formatMoney(data.montant, devise)})`)
      setSelected(null)
      setModePaiement('especes')
      load()
      onTransaction?.()

      // Generate receipt separately so a receipt error doesn't rollback the success
      try {
        const tr = {
          id: data.id,
          date_transaction: new Date().toISOString(),
          montant: data.montant,
          mode_paiement: modePaiement,
          type: 'encaissement',
          notes: `Encaissement commande ${data.numero}`,
        }
        setReceipt({ html: buildReceiptHtml({ transaction: tr, settings, devise }), transaction: tr })
      } catch (receiptErr) {
        console.error('[CaisseCommandes] receipt error:', receiptErr)
        toast.error('Reçu: ' + receiptErr.message)
      }
    } catch (err) {
      console.error('[CaisseCommandes] encaisser error:', err)
      const msg = err.response?.data?.error || err.message || 'Erreur lors de l\'encaissement'
      toast.error(msg)
    }
  }

  const doPrint = () => {
    const win = iframeRef.current?.contentWindow
    if (win) { win.focus(); win.print() }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="input pl-10"
            placeholder="Rechercher par numéro de commande ou client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-400">Aucune commande livrée impayée</p>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 font-bold text-slate-800">
            <CreditCard size={17} /> Commandes livrées impayées ({filtered.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">N° Commande</th>
                  <th className="table-th">Client</th>
                  <th className="table-th">Date</th>
                  <th className="table-th text-right">Articles</th>
                  <th className="table-th text-right">Montant</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="table-row-hover">
                    <td className="table-td font-semibold text-slate-800">{c.numero}</td>
                    <td className="table-td text-slate-600">{c.client_nom || '—'}</td>
                    <td className="table-td text-slate-500">{formatDate(c.date_commande)}</td>
                    <td className="table-td text-right text-slate-500">{c.nb_articles || 0}</td>
                    <td className="table-td text-right font-bold text-brand-600">{formatMoney(c.montant_ht, devise)}</td>
                    <td className="table-td">
                      <button
                        onClick={() => setSelected(c)}
                        className="btn-primary py-1.5 text-xs"
                      >
                        <CreditCard size={14} /> Encaisser
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal d'encaissement */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Encaisser une commande" icon={CreditCard} size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Commande</span>
                <span className="font-semibold text-slate-800">{selected.numero}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Client</span>
                <span className="font-semibold text-slate-800">{selected.client_nom || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Articles</span>
                <span className="font-semibold text-slate-800">{selected.nb_articles || 0}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-700">Montant à encaisser</span>
                <span className="text-lg font-bold text-brand-600">{formatMoney(selected.montant_ht, devise)}</span>
              </div>
            </div>

            <div>
              <label className="label">Mode de paiement</label>
              <select className="input" value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
                <option value="especes">Espèces</option>
                <option value="carte">Carte</option>
                <option value="mobile">Mobile Money</option>
                <option value="cheque">Chèque</option>
                <option value="virement">Virement</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setSelected(null)} className="btn-secondary flex-1">Annuler</button>
              <button type="button" onClick={encaisser} className="btn-primary flex-1">
                <Printer size={16} /> Encaisser & Imprimer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Receipt preview */}
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
