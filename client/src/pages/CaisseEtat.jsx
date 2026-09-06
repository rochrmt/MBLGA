import { useState, useEffect } from 'react'
import { FileBarChart, RefreshCw, Printer } from 'lucide-react'
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

export default function CaisseEtat({ devise }) {
  const { canPrint } = useAuth()
  const toast = useToast()
  const [etat, setEtat] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.get('/caisse/etat').then(({ data }) => setEtat(data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const printEtat = () => {
    if (!etat?.session) return
    const s = etat.session
    const dateStr = new Date().toLocaleString('fr-FR')
    const rows = etat.transactions || []

    const parModeHtml = Object.entries(etat.par_mode || {}).map(([mode, montant]) => `
      <tr><td>${MODE_LABELS[mode] || mode}</td><td class="right">${formatMoney(montant, devise)}</td></tr>
    `).join('')

    const trsHtml = rows.map((t) => `
      <tr>
        <td>${formatDateTime(t.date_transaction)}</td>
        <td>${t.type === 'retrait' ? 'Retrait' : 'Encaissement'}</td>
        <td>${MODE_LABELS[t.mode_paiement] || t.mode_paiement}</td>
        <td>${t.notes || '—'}</td>
        <td class="right ${t.type === 'retrait' ? 'neg' : 'pos'}">${t.type === 'retrait' ? '-' : '+'}${formatMoney(t.montant, devise)}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>État de caisse</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #1e293b; }
      h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
      .subtitle { text-align: center; font-size: 12px; color: #64748b; margin-bottom: 20px; }
      .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
      .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
      .card .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
      .card .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
      .card.solde .value { color: #059669; }
      .card.retraits .value { color: #047857; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
      th { background: #f1f5f9; padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; }
      td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
      .right { text-align: right; }
      .pos { color: #059669; font-weight: bold; }
      .neg { color: #047857; font-weight: bold; }
      .section-title { font-size: 14px; font-weight: bold; margin: 16px 0 8px; }
      @media print { body { margin: 10px; } }
    </style></head><body>
    <h1>État de Caisse</h1>
    <p class="subtitle">Session #${s.id} — Ouverte le ${formatDateTime(s.date_ouverture)}</p>
    <div class="summary">
      <div class="card"><div class="label">Fond d'ouverture</div><div class="value">${formatMoney(s.montant_ouverture, devise)}</div></div>
      <div class="card"><div class="label">Total encaissements</div><div class="value">${formatMoney(etat.total_encaissements, devise)}</div></div>
      <div class="card retraits"><div class="label">Total retraits</div><div class="value">${formatMoney(etat.total_retraits, devise)}</div></div>
    </div>
    <div class="card solde" style="margin-bottom:20px;border:2px solid #059669"><div class="label">Solde de caisse</div><div class="value" style="font-size:24px">${formatMoney(etat.solde, devise)}</div></div>
    <div class="section-title">Encaissements par mode de paiement</div>
    <table><thead><tr><th>Mode</th><th class="right">Montant</th></tr></thead><tbody>${parModeHtml}</tbody></table>
    <div class="section-title">Détail des transactions (${rows.length})</div>
    <table><thead><tr><th>Heure</th><th>Type</th><th>Mode</th><th>Notes</th><th class="right">Montant</th></tr></thead><tbody>${trsHtml}</tbody></table>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:20px">Édité le ${dateStr}</p>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  if (loading) return <Spinner />

  if (!etat?.session) {
    return (
      <div className="card p-12 text-center">
        <FileBarChart size={40} className="mx-auto mb-3 text-slate-300" />
        <p className="text-sm text-slate-400">Aucune session de caisse ouverte</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">État de caisse</h3>
          <p className="text-sm text-slate-400">Session #{etat.session.id} — ouverte le {formatDateTime(etat.session.date_ouverture)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary"><RefreshCw size={16} /> Actualiser</button>
          {canPrint && (
            <button onClick={printEtat} className="btn-primary"><Printer size={16} /> Imprimer l'état</button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Fond d'ouverture</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{formatMoney(etat.session.montant_ouverture, devise)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total encaissements</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{formatMoney(etat.total_encaissements, devise)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total retraits</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{formatMoney(etat.total_retraits, devise)}</p>
        </div>
        <div className="card p-5 border-2 border-emerald-200">
          <p className="text-xs font-semibold uppercase text-slate-500">Solde de caisse</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatMoney(etat.solde, devise)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 font-bold text-slate-800">Encaissements par mode de paiement</div>
          <table className="w-full">
            <thead>
              <tr><th className="table-th">Mode</th><th className="table-th text-right">Montant</th></tr>
            </thead>
            <tbody>
              {Object.keys(etat.par_mode || {}).length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-400">Aucun encaissement</td></tr>
              ) : Object.entries(etat.par_mode).map(([mode, montant]) => (
                <tr key={mode} className="table-row-hover">
                  <td className="table-td">{MODE_LABELS[mode] || mode}</td>
                  <td className="table-td text-right font-semibold text-emerald-600">{formatMoney(montant, devise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 font-bold text-slate-800">Transactions ({etat.nb_transactions})</div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0">
                <tr><th className="table-th">Heure</th><th className="table-th">Type</th><th className="table-th text-right">Montant</th></tr>
              </thead>
              <tbody>
                {(etat.transactions || []).map((t) => (
                  <tr key={t.id} className="table-row-hover">
                    <td className="table-td text-slate-500 text-xs">{formatDateTime(t.date_transaction)}</td>
                    <td className="table-td">
                      <span className={`text-xs font-semibold ${t.type === 'retrait' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {t.type === 'retrait' ? 'Retrait' : 'Encaissement'}
                      </span>
                    </td>
                    <td className={`table-td text-right font-semibold ${t.type === 'retrait' ? 'text-red-600' : 'text-slate-800'}`}>
                      {t.type === 'retrait' ? '-' : '+'}{formatMoney(t.montant, devise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
