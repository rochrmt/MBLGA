import { useState, useEffect, useMemo } from 'react'
import { Search, ShoppingCart, Trash2, Plus, Minus, Printer, X, Package, Eye } from 'lucide-react'
import api, { formatMoney } from '../lib/api'
import { useSettings } from '../context/Settings'
import { useToast } from '../components/ui'
import { buildReceiptHtml } from '../lib/receiptTemplate'
import { useRef } from 'react'

export default function CaissePOS({ settings, devise, onTransaction }) {
  const toast = useToast()
  const [produits, setProduits] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [modePaiement, setModePaiement] = useState('especes')
  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState(null)
  const iframeRef = useRef(null)

  useEffect(() => {
    api.get('/produits').then(({ data }) => {
      setProduits(data.filter((p) => p.actif !== 0 && p.stock > 0))
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return produits.slice(0, 12)
    const q = search.toLowerCase()
    return produits.filter((p) => p.nom.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, 24)
  }, [produits, search])

  const cartTotal = cart.reduce((s, item) => s + item.prix * item.quantite, 0)

  const addToCart = (p) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produit_id === p.id)
      if (existing) {
        return prev.map((item) =>
          item.produit_id === p.id ? { ...item, quantite: item.quantite + 1 } : item,
        )
      }
      return [...prev, { produit_id: p.id, nom: p.nom, prix: p.prix_ht, quantite: 1, stock: p.stock }]
    })
  }

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.produit_id === id ? { ...item, quantite: Math.max(0, item.quantite + delta) } : item,
        )
        .filter((item) => item.quantite > 0),
    )
  }

  const removeFromCart = (id) => setCart((prev) => prev.filter((item) => item.produit_id !== id))

  const checkout = async () => {
    if (cart.length === 0) return
    try {
      const produitsPayload = cart.map((item) => ({
        nom: item.nom,
        quantite: item.quantite,
        prix: item.prix,
      }))
      const { data } = await api.post('/caisse/transaction', {
        montant: cartTotal,
        mode_paiement: modePaiement,
        type: 'encaissement',
        produits: produitsPayload,
        notes: 'Vente au comptoir',
      })
      toast.success('Vente encaissée avec succès')
      setCart([])
      onTransaction?.()

      try {
        const newTr = {
          id: data.id,
          date_transaction: new Date().toISOString(),
          montant: cartTotal,
          mode_paiement: modePaiement,
          type: 'encaissement',
          notes: 'Vente au comptoir',
          produits: produitsPayload,
        }
        printReceipt(newTr)
      } catch (receiptErr) {
        console.error('[CaissePOS] receipt error:', receiptErr)
        toast.error('Reçu: ' + receiptErr.message)
      }
    } catch (err) {
      console.error('[CaissePOS] checkout error:', err)
      toast.error(err.response?.data?.error || err.message || 'Erreur lors de l\'encaissement')
    }
  }

  const printReceipt = (tr) => {
    const html = buildReceiptHtml({ transaction: tr, settings, devise })
    setReceipt({ html, transaction: tr })
  }

  const doPrint = () => {
    const win = iframeRef.current?.contentWindow
    if (win) { win.focus(); win.print() }
  }

  if (loading) return <div className="card p-8 text-center text-sm text-slate-400">Chargement des produits...</div>

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Product search and grid */}
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input pl-10"
              placeholder="Rechercher un produit par nom ou code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.length === 0 ? (
            <div className="col-span-full card p-8 text-center text-sm text-slate-400">
              {search ? 'Aucun produit trouvé' : 'Aucun produit en stock'}
            </div>
          ) : filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="card flex flex-col items-start gap-1 p-3 text-left transition hover:border-brand-400 hover:shadow-md"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><Package size={18} /></span>
              <span className="line-clamp-2 text-sm font-semibold text-slate-800">{p.nom}</span>
              <span className="text-xs text-slate-400">Stock: {p.stock}</span>
              <span className="text-sm font-bold text-brand-600">{formatMoney(p.prix_ht, devise)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="space-y-4">
        <div className="card flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-bold text-slate-800">
            <ShoppingCart size={18} /> Panier
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="ml-auto text-xs font-semibold text-red-500 hover:text-red-700">
                Vider
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="grid place-items-center py-12 text-center text-sm text-slate-400">
                <ShoppingCart size={32} className="mb-2 text-slate-300" />
                Panier vide
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.produit_id} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.nom}</p>
                      <p className="text-xs text-slate-400">{formatMoney(item.prix, devise)} / unité</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.produit_id, -1)} className="grid h-6 w-6 place-items-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200"><Minus size={14} /></button>
                      <span className="w-8 text-center text-sm font-bold">{item.quantite}</span>
                      <button onClick={() => updateQty(item.produit_id, 1)} className="grid h-6 w-6 place-items-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200"><Plus size={14} /></button>
                    </div>
                    <span className="w-20 text-right text-sm font-bold text-slate-800">{formatMoney(item.prix * item.quantite, devise)}</span>
                    <button onClick={() => removeFromCart(item.produit_id)} className="text-slate-300 hover:text-red-500"><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t border-slate-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Total</span>
                <span className="text-xl font-bold text-brand-600">{formatMoney(cartTotal, devise)}</span>
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

              <button onClick={checkout} className="btn-primary w-full">
                <Printer size={18} /> Encaisser & Imprimer
              </button>
            </div>
          )}
        </div>
      </div>

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
