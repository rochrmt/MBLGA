import { useState, useEffect } from 'react'
import { History, RefreshCw, Printer, Wallet, ArrowRightLeft } from 'lucide-react'
import api, { formatMoney, formatDateTime } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useAuth } from '../context/Auth'
import { Spinner, useToast } from '../components/ui'

const MODE_LABELS = {
  especes: 'Espèces',
  carte: 'Carte bancaire',
  virement: 'Virement',
  mobile: 'Mobile Money',
  cheque: 'Chèque',
}

export default function CaisseHistorique({ devise }) {
  const { canPrint } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)

  const load = () => {
    setLoading(true)
    api.get('/caisse/historique', { params: { from, to } })
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const printHistorique = () => {
    if (!data) return
    const dateStr = new Date().toLocaleString('fr-FR')
    const cp = data.caisse_principale
    const pc = data.petite_caisse

    const cpRows = cp.transactions.map((t) => `
      <tr>
        <td>${formatDateTime(t.date_transaction)}</td>
        <td>${t.type === 'retrait' ? 'Retrait' : 'Encaissement'}</td>
        <td>${MODE_LABELS[t.mode_paiement] || t.mode_paiement || '—'}</td>
        <td>${t.notes || '—'}</td>
        <td class="right ${t.type === 'retrait' ? 'neg' : 'pos'}">${t.type === 'retrait' ? '-' : '+'}${formatMoney(t.montant, devise)}</td>
      </tr>
    `).join('')

    const pcRows = pc.transactions.map((t) => `
      <tr>
        <td>${formatDateTime(t.date_transaction)}</td>
        <td>${t.type === 'approvisionnement' ? 'Approvisionnement' : t.type === 'entree' ? 'Entrée' : 'Dépense'}</td>
        <td>${t.categorie || '—'}</td>
        <td>${t.beneficiaire || '—'}</td>
        <td>${t.notes || '—'}</td>
        <td class="right ${t.type === 'depense' ? 'neg' : 'pos'}">${t.type === 'depense' ? '-' : '+'}${formatMoney(t.montant, devise)}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Historique des transactions</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #1e293b; }
      h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
      h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
      .subtitle { text-align: center; font-size: 12px; color: #64748b; margin-bottom: 20px; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
      .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
      .card .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
      .card .value { font-size: 16px; font-weight: bold; margin-top: 4px; }
      .pos { color: #059669; font-weight: bold; }
      .neg { color: #047857; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
      th { background: #f1f5f9; padding: 6px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; }
      td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
      .right { text-align: right; }
      @media print { body { margin: 10px; } .page-break { page-break-before: always; } }
    </style></head><body>
    <h1>Historique des Transactions de Caisse</h1>
    <p class="subtitle">Période : ${data.periode.from} au ${data.periode.to} — Édité le ${dateStr}</p>

    <h2><span style="color:#be123c">Caisse Principale</span> (${cp.nb} transactions)</h2>
    <div class="summary">
      <div class="card"><div class="label">Encaissements</div><div class="value pos">${formatMoney(cp.total_encaissements, devise)}</div></div>
      <div class="card"><div class="label">Retraits</div><div class="value neg">${formatMoney(cp.total_retraits, devise)}</div></div>
      <div class="card"><div class="label">Solde</div><div class="value">${formatMoney(cp.solde, devise)}</div></div>
      <div class="card"><div class="label">Nb transactions</div><div class="value">${cp.nb}</div></div>
    </div>
    <table><thead><tr><th>Date/Heure</th><th>Type</th><th>Mode</th><th>Notes</th><th class="right">Montant</th></tr></thead><tbody>${cpRows}</tbody></table>

    <div class="page-break"></div>
    <h2><span style="color:#be123c">Petite Caisse</span> (${pc.nb} transactions)</h2>
    <div class="summary">
      <div class="card"><div class="label">Approvisionnements</div><div class="value pos">${formatMoney(pc.total_approvisionnements, devise)}</div></div>
      <div class="card"><div class="label">Entrées</div><div class="value pos">${formatMoney(pc.total_entrees, devise)}</div></div>
      <div class="card"><div class="label">Dépenses</div><div class="value neg">${formatMoney(pc.total_depenses, devise)}</div></div>
      <div class="card"><div class="label">Solde</div><div class="value">${formatMoney(pc.solde, devise)}</div></div>
    </div>
    <table><thead><tr><th>Date/Heure</th><th>Type</th><th>Catégorie</th><th>Bénéficiaire</th><th>Notes</th><th class="right">Montant</th></tr></thead><tbody>${pcRows}</tbody></table>

    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:20px">Document généré le ${dateStr}</p>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Historique des transactions</h3>
          <p className="text-sm text-slate-400">Filtrez par période et imprimez le rapport complet</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label text-xs">Du</label>
            <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Au</label>
            <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button onClick={load} className="btn-secondary"><RefreshCw size={16} /> Actualiser</button>
          {canPrint && (
            <button onClick={printHistorique} className="btn-primary"><Printer size={16} /> Imprimer</button>
          )}
        </div>
      </div>

      {!data ? (
        <div className="card p-12 text-center">
          <History size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-400">Aucune donnée</p>
        </div>
      ) : (
        <>
          {/* Caisse Principale */}
          <div className="table-wrap">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <Wallet size={18} className="text-brand-600" />
              <span className="font-bold text-slate-800">Caisse Principale</span>
              <span className="ml-auto text-sm text-slate-400">{data.caisse_principale.nb} transaction(s)</span>
            </div>
            <div className="grid gap-3 px-5 py-3 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-xs uppercase text-slate-500">Encaissements</p>
                <p className="text-lg font-bold text-emerald-600">{formatMoney(data.caisse_principale.total_encaissements, devise)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase text-slate-500">Retraits</p>
                <p className="text-lg font-bold text-red-600">{formatMoney(data.caisse_principale.total_retraits, devise)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase text-slate-500">Solde</p>
                <p className="text-lg font-bold text-slate-800">{formatMoney(data.caisse_principale.solde, devise)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase text-slate-500">Transactions</p>
                <p className="text-lg font-bold text-slate-800">{data.caisse_principale.nb}</p>
              </div>
            </div>
            <div className="max-h-80 overflow-x-auto overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr><th className="table-th">Date/Heure</th><th className="table-th">Type</th><th className="table-th">Mode</th><th className="table-th">Notes</th><th className="table-th text-right">Montant</th></tr>
                </thead>
                <tbody>
                  {data.caisse_principale.transactions.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">Aucune transaction sur cette période</td></tr>
                  ) : data.caisse_principale.transactions.map((t) => (
                    <tr key={t.id} className="table-row-hover">
                      <td className="table-td text-xs text-slate-500">{formatDateTime(t.date_transaction)}</td>
                      <td className="table-td">
                        <span className={`text-xs font-semibold ${t.type === 'retrait' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {t.type === 'retrait' ? 'Retrait' : 'Encaissement'}
                        </span>
                      </td>
                      <td className="table-td text-sm">{MODE_LABELS[t.mode_paiement] || t.mode_paiement || '—'}</td>
                      <td className="table-td text-sm text-slate-500">{t.notes || '—'}</td>
                      <td className={`table-td text-right font-semibold ${t.type === 'retrait' ? 'text-red-600' : 'text-slate-800'}`}>
                        {t.type === 'retrait' ? '-' : '+'}{formatMoney(t.montant, devise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Petite Caisse */}
          <div className="table-wrap">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <ArrowRightLeft size={18} className="text-brand-600" />
              <span className="font-bold text-slate-800">Petite Caisse</span>
              <span className="ml-auto text-sm text-slate-400">{data.petite_caisse.nb} transaction(s)</span>
            </div>
            <div className="grid gap-3 px-5 py-3 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-xs uppercase text-slate-500">Approvisionnements</p>
                <p className="text-lg font-bold text-emerald-600">{formatMoney(data.petite_caisse.total_approvisionnements, devise)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase text-slate-500">Entrées</p>
                <p className="text-lg font-bold text-emerald-600">{formatMoney(data.petite_caisse.total_entrees, devise)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase text-slate-500">Dépenses</p>
                <p className="text-lg font-bold text-red-600">{formatMoney(data.petite_caisse.total_depenses, devise)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase text-slate-500">Solde</p>
                <p className="text-lg font-bold text-slate-800">{formatMoney(data.petite_caisse.solde, devise)}</p>
              </div>
            </div>
            <div className="max-h-80 overflow-x-auto overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr><th className="table-th">Date/Heure</th><th className="table-th">Type</th><th className="table-th">Catégorie</th><th className="table-th">Bénéficiaire</th><th className="table-th">Notes</th><th className="table-th text-right">Montant</th></tr>
                </thead>
                <tbody>
                  {data.petite_caisse.transactions.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">Aucune transaction sur cette période</td></tr>
                  ) : data.petite_caisse.transactions.map((t) => (
                    <tr key={t.id} className="table-row-hover">
                      <td className="table-td text-xs text-slate-500">{formatDateTime(t.date_transaction)}</td>
                      <td className="table-td">
                        <span className={`badge ${t.type === 'approvisionnement' ? 'bg-brand-100 text-brand-600' : t.type === 'entree' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {t.type === 'approvisionnement' ? 'Appro.' : t.type === 'entree' ? 'Entrée' : 'Dépense'}
                        </span>
                      </td>
                      <td className="table-td text-sm">{t.categorie || '—'}</td>
                      <td className="table-td text-sm">{t.beneficiaire || '—'}</td>
                      <td className="table-td text-sm text-slate-500">{t.notes || '—'}</td>
                      <td className={`table-td text-right font-semibold ${t.type === 'depense' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {t.type === 'depense' ? '-' : '+'}{formatMoney(t.montant, devise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
