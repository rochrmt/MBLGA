export function buildReceiptHtml({ transaction, settings, devise }) {
  const entreprise = settings.raison_sociale || 'Mon Entreprise'
  const slogan = settings.slogan || ''
  const telephone = settings.telephone || ''
  const adresse = settings.adresse || ''
  const email = settings.email || ''
  const numeroRecu = `REC-${String(transaction.id).padStart(6, '0')}`
  const dateStr = new Date(transaction.date_transaction || Date.now()).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  let produitsHtml = ''
  if (transaction.produits) {
    let items = []
    try { items = typeof transaction.produits === 'string' ? JSON.parse(transaction.produits) : transaction.produits } catch { items = [] }
    if (Array.isArray(items) && items.length > 0) {
      produitsHtml = `
        <table class="items">
          <thead>
            <tr><th class="left">Article</th><th class="right">Qté</th><th class="right">Prix</th><th class="right">Total</th></tr>
          </thead>
          <tbody>
            ${items.map((it) => `
              <tr>
                <td class="left">${escapeHtml(it.nom || it.libelle || 'Article')}</td>
                <td class="right">${it.quantite || 1}</td>
                <td class="right">${fmt(it.prix_unitaire || it.prix || 0)}</td>
                <td class="right">${fmt((it.prix_unitaire || it.prix || 0) * (it.quantite || 1))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    }
  }

  const modeLabel = {
    especes: 'Espèces', carte: 'Carte bancaire', virement: 'Virement',
    mobile: 'Mobile Money', cheque: 'Chèque',
  }[transaction.mode_paiement] || transaction.mode_paiement || 'Espèces'

  const montant = Number(transaction.montant) || 0
  const typeLabel = transaction.type === 'retrait' ? 'RETRAIT' : 'ENCAISSEMENT'

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reçu ${numeroRecu}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 12px;
    color: #000;
    width: 80mm;
    padding: 8px 6px;
    background: #fff;
  }
  .header { text-align: center; margin-bottom: 6px; }
  .header .company { font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .header .slogan { font-size: 10px; color: #444; margin-top: 1px; }
  .header .info { font-size: 10px; color: #444; margin-top: 2px; line-height: 1.4; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .meta { font-size: 11px; line-height: 1.6; }
  .meta .row { display: flex; justify-content: space-between; }
  .meta .label { color: #444; }
  .meta .value { font-weight: bold; }
  .type-badge {
    text-align: center; font-size: 13px; font-weight: bold;
    border: 1px solid #000; padding: 3px; margin: 6px 0;
    text-transform: uppercase; letter-spacing: 1px;
  }
  .items { width: 100%; border-collapse: collapse; font-size: 11px; margin: 4px 0; }
  .items th { border-bottom: 1px solid #000; padding: 2px 0; font-size: 10px; text-transform: uppercase; }
  .items td { padding: 2px 0; }
  .items .left { text-align: left; }
  .items .right { text-align: right; }
  .total-section { margin-top: 6px; }
  .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding: 4px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; }
  .payment-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
  .footer { text-align: center; margin-top: 8px; font-size: 10px; color: #444; }
  .footer .thanks { font-size: 12px; font-weight: bold; margin-bottom: 2px; }
  .barcode { text-align: center; font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 2px; margin-top: 4px; }
  @media print {
    body { width: 80mm; padding: 4px 4px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="company">${escapeHtml(entreprise)}</div>
    ${slogan ? `<div class="slogan">${escapeHtml(slogan)}</div>` : ''}
    ${adresse ? `<div class="info">${escapeHtml(adresse)}</div>` : ''}
    ${telephone ? `<div class="info">Tél: ${escapeHtml(telephone)}</div>` : ''}
    ${email ? `<div class="info">${escapeHtml(email)}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="meta">
    <div class="row"><span class="label">Reçu N°:</span><span class="value">${numeroRecu}</span></div>
    <div class="row"><span class="label">Date:</span><span class="value">${dateStr}</span></div>
    ${transaction.reference ? `<div class="row"><span class="label">Réf:</span><span class="value">${escapeHtml(transaction.reference)}</span></div>` : ''}
  </div>

  <div class="type-badge">${typeLabel}</div>

  ${produitsHtml}

  <div class="divider"></div>

  <div class="total-section">
    <div class="total-row">
      <span>TOTAL</span>
      <span>${fmt(montant)}</span>
    </div>
    <div class="payment-row">
      <span>Mode de paiement</span>
      <span>${modeLabel}</span>
    </div>
  </div>

  <div class="divider"></div>

  ${transaction.notes ? `<div style="font-size: 11px; margin: 4px 0;"><strong>Note:</strong> ${escapeHtml(transaction.notes)}</div><div class="divider"></div>` : ''}

  <div class="footer">
    <div class="thanks">Merci de votre confiance !</div>
    <div>${escapeHtml(entreprise)}</div>
    <div class="barcode">*${numeroRecu}*</div>
  </div>
</body>
</html>`

  function fmt(v) {
    const n = Number(v) || 0
    return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${devise || 'FCFA'}`
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
