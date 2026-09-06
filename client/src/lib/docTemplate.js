// Génération du HTML imprimable pour les documents commerciaux
// (bon de livraison, facture proforma, facture définitive).
// Le même HTML sert à l'aperçu (iframe) et à l'impression (window.print).

export const DOC_TYPES = [
  { key: 'bon_livraison',      label: 'Bon de livraison',   title: 'Bon de livraison' },
  { key: 'facture_proforma',   label: 'Facture proforma',   title: 'Facture proforma' },
  { key: 'facture_definitive', label: 'Facture définitive', title: 'Facture' },
]

export function docTitle(type) {
  return (DOC_TYPES.find((t) => t.key === type) || DOC_TYPES[2]).title
}

function money(n, devise) {
  const v = Number(n) || 0
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${devise}`
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function fmtDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('fr-FR') } catch { return String(d) }
}

export function computeTotals(lignes, taux_tva, remise_globale, avance) {
  const marchandisesHT = lignes.reduce((s, l) => s
    + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise) || 0) / 100), 0)
  const mainOeuvre = lignes.reduce((s, l) => s + (Number(l.main_oeuvre) || 0), 0)
  const ht = marchandisesHT + mainOeuvre
  const tva = ht * ((Number(taux_tva) || 0) / 100)
  const ttc = ht + tva
  const remise = Number(remise_globale) || 0
  const av = Number(avance) || 0
  const net = ttc - remise
  const reste = net - av
  return { ht, tva, ttc, remise, avance: av, net, reste, marchandisesHT, mainOeuvre }
}

export function buildDocHtml({ doc, lignes, settings, devise, numero }) {
  const type = doc.type_document
  const isBL = type === 'bon_livraison'
  const title = docTitle(type)
  const t = computeTotals(lignes, doc.taux_tva, doc.remise_globale, doc.avance)

  const ent = {
    nom: settings.raison_sociale || 'Entreprise',
    slogan: settings.slogan || '',
    tel: settings.telephone || '',
    email: settings.email || '',
    adresse: settings.adresse || '',
    rccm: settings.rccm || '',
    logo: settings.logo || '',
    signature: settings.signature || '',
  }

  const clientNom = doc.client_nom_libre || doc.client_nom || ''
  const clientAdr = doc.client_adresse_libre || ''

  // Lignes du tableau selon le type
  const lignesRows = lignes.map((l) => {
    if (isBL) {
      return `<tr>
        <td>${esc(l.reference)}</td>
        <td>${esc(l.description)}</td>
        <td class="c">${Number(l.qte_commandee) || 0}</td>
        <td class="c">${Number(l.qte_livree) || 0}</td>
      </tr>`
    }
    const totalLigne = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise) || 0) / 100)
    return `<tr>
      <td>${esc(l.reference)}</td>
      <td>${esc(l.description)}</td>
      <td class="c">${esc(l.unite || '')}</td>
      <td class="c">${Number(l.quantite) || 0}</td>
      <td class="r">${money(l.prix_unitaire, devise)}</td>
      <td class="r">${money(totalLigne, devise)}</td>
    </tr>`
  }).join('')

  const theadCols = isBL
    ? `<th>Réf. produit</th><th>Description</th><th class="c">Qté commandée</th><th class="c">Qté livrée</th>`
    : `<th>Réf.</th><th>Désignation</th><th class="c">Unité</th><th class="c">Qté</th><th class="r">P.U. HT</th><th class="r">Total HT</th>`

  // Montant en lettres simplifié
  const montantLettres = `${money(isBL ? t.ttc : t.reste, devise)}`

  // Texte "Arrêtée" selon le type de document
  const arretText = isBL
    ? `Arrêté le présent bon de livraison à la somme de :`
    : `Arrêtée la présente ${esc(title.toLowerCase())} à la somme de :`

  // Bloc totaux
  let totauxRows = ''
  if (isBL) {
    totauxRows = `
      <div class="totaux-row"><span>HT</span><b>${money(t.ht, devise)}</b></div>
      <div class="totaux-row total"><span>TTC</span><b>${money(t.ttc, devise)}</b></div>`
  } else {
    totauxRows = `
      <div class="totaux-row"><span>Total Marchandises HT</span><b>${money(t.marchandisesHT, devise)}</b></div>
      ${t.mainOeuvre ? `<div class="totaux-row"><span>Main d'œuvre</span><b>${money(t.mainOeuvre, devise)}</b></div>` : ''}
      <div class="totaux-row"><span>Total HT</span><b>${money(t.ht, devise)}</b></div>
      ${Number(doc.taux_tva) ? `<div class="totaux-row"><span>TVA (${Number(doc.taux_tva)}%)</span><b>${money(t.tva, devise)}</b></div>` : ''}
      <div class="totaux-row total"><span>TOTAL GÉNÉRAL</span><b>${money(t.ttc, devise)}</b></div>
      ${t.remise ? `<div class="totaux-row"><span>Remise</span><b>- ${money(t.remise, devise)}</b></div>` : ''}
      ${t.avance ? `<div class="totaux-row"><span>Avance</span><b>- ${money(t.avance, devise)}</b></div>` : ''}
      <div class="totaux-row net"><span>Net à payer</span><b>${money(t.reste, devise)}</b></div>`
  }

  // Conditions selon le type
  let conditionsContent = ''
  if (isBL) {
    conditionsContent = `
      ${doc.delai_livraison ? `<div><b>Délais de livraison :</b> ${esc(doc.delai_livraison)}</div>` : ''}
      ${doc.duree_garantie ? `<div><b>Durée de garantie :</b> ${esc(doc.duree_garantie)}</div>` : ''}`
  } else {
    conditionsContent = `
      ${doc.conditions_reglement ? `<div><b>Conditions de règlement :</b> ${esc(doc.conditions_reglement)}</div>` : ''}
      ${doc.mode_reglement ? `<div><b>Mode de règlement :</b> ${esc(doc.mode_reglement)}</div>` : ''}`
  }

  const couleurPrincipale = settings.couleur_principale || '#1e293b'
  const couleurSombre = settings.couleur_sombre || '#2992f5'
  const titleClass = isBL ? 'bl' : type === 'facture_proforma' ? 'proforma' : ''
  const headerBg = couleurPrincipale

  // Prolongement du tableau : une seule ligne vide sans bordures internes
  const colCount = isBL ? 4 : 6
  const emptyRows = `<tr class="empty"><td colspan="${colCount}">&nbsp;</td></tr>`

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${esc(title)} ${esc(numero || '')}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 10px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { width: 190mm; padding: 0; }

  /* ── En-tête ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3mm; }
  .logo-block { flex: 1; }
  .logo-block img { max-height: 18mm; max-width: 45mm; object-fit: contain; }
  .logo-block .company-name { font-size: 15px; font-weight: bold; color: ${couleurPrincipale}; }
  .logo-block .slogan { font-size: 8px; color: #64748b; margin-top: 1px; max-width: 55mm; }
  .title-block { text-align: right; }
  .title-box { display: inline-block; background: ${headerBg}; color: #fff; padding: 4mm 10mm; font-size: 17px; font-weight: bold; letter-spacing: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* ── Blocs émetteur / destinataire ── */
  .parties { display: flex; gap: 4mm; margin-top: 3mm; }
  .party-box { flex: 1; border: 1px solid #cbd5e1; padding: 2.5mm 3.5mm; font-size: 9px; line-height: 1.4; }
  .party-box.dest { background: #f8fafc; }
  .party-box h4 { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 1.5mm; border-bottom: 1px solid #e2e8f0; padding-bottom: 1mm; }
  .party-box .nom { font-weight: bold; font-size: 11px; margin-bottom: 0.5mm; }
  .party-box .meta { margin-top: 2mm; padding-top: 1.5mm; border-top: 1px solid #e2e8f0; }
  .party-box .meta .row { display: flex; gap: 3px; margin-bottom: 0.5mm; }
  .party-box .meta .label { color: #64748b; min-width: 18mm; font-size: 8px; }

  /* ── Objet ── */
  .objet { text-align: center; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; padding: 2mm; background: #f1f5f9; border: 1px solid #e2e8f0; margin-top: 3mm; margin-bottom: 3mm; }

  /* ── Tableau : largeur 190mm, lignes hautes ── */
  table { width: 190mm; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
  thead th { background: ${headerBg}; color: #fff; padding: 2.5mm 3.5mm; text-align: left; font-weight: bold; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; border: 1px solid ${headerBg}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tbody td { border: 1px solid #cbd5e1; padding: 3mm 3.5mm; vertical-align: middle; height: 12mm; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody tr.empty td { border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top: none; border-bottom: 1px solid #cbd5e1; height: 40mm; }
  td.c, th.c { text-align: center; }
  td.r, th.r { text-align: right; }

  /* ── Après tableau : zone mixte ── */
  .after-table { display: flex; justify-content: space-between; margin-top: 3mm; gap: 4mm; }
  .after-left { flex: 1; }
  .after-right { width: 70mm; flex-shrink: 0; }

  .totaux-box { border: 1px solid #cbd5e1; padding: 2.5mm 4mm; }
  .totaux-row { display: flex; justify-content: space-between; padding: 1.2mm 0; font-size: 9px; border-bottom: 1px solid #f1f5f9; }
  .totaux-row.total { font-size: 10px; font-weight: bold; border-top: 2px solid ${couleurPrincipale}; border-bottom: 2px solid ${couleurPrincipale}; padding: 1.5mm 0; margin-top: 1mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .totaux-row.net { font-size: 11px; font-weight: bold; color: #047857; border-bottom: none; padding-top: 1.5mm; }

  .conditions-inline { font-size: 9px; line-height: 1.6; padding: 3mm 4mm; background: #f8fafc; border: 1px solid #e2e8f0; }
  .conditions-inline b { color: #1e293b; }
  .conditions-inline div { margin-bottom: 1mm; }

  /* ── Signatures : 2 zones en bas ── */
  .signatures { display: flex; gap: 8mm; margin-top: 6mm; justify-content: space-between; }
  .sign-zone { flex: 1; text-align: center; }
  .sign-zone p { margin-bottom: 1.5mm; font-size: 9px; font-weight: bold; }
  .sign-box { display: block; width: 100%; border: 1px dashed #94a3b8; padding: 8mm 4mm; min-height: 12mm; font-style: italic; color: #475569; font-size: 9px; }

  /* ── Footer ── */
  .footer { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #cbd5e1; padding: 2mm 10mm; font-size: 8px; color: #64748b; text-align: center; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { width: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .footer { padding: 2mm 10mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  @media screen { body { width: 190mm; margin: 10mm auto; box-shadow: 0 0 10px rgba(0,0,0,.1); padding: 10mm; } }
</style></head>
<body>
  <div class="header">
    <div class="logo-block">
      ${ent.logo ? `<img src="${ent.logo}" alt="logo">` : `<div class="company-name">${esc(ent.nom)}</div>`}
      ${ent.slogan ? `<div class="slogan">${esc(ent.slogan)}</div>` : ''}
    </div>
    <div class="title-block">
      <div class="title-box ${titleClass}">${esc(title.toUpperCase())}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party-box">
      <h4>Émetteur</h4>
      <div class="nom">${esc(ent.nom)}</div>
      ${ent.adresse ? `<div>${esc(ent.adresse)}</div>` : ''}
      ${ent.tel ? `<div>Tél : ${esc(ent.tel)}</div>` : ''}
      ${ent.email ? `<div>${esc(ent.email)}</div>` : ''}
      ${ent.rccm ? `<div>RCCM : ${esc(ent.rccm)}</div>` : ''}
      ${settings.siret ? `<div>${esc(settings.siret)}</div>` : ''}
      <div class="meta">
        <div class="row"><span class="label">N° ${esc(title)} :</span><span>${esc(numero || '—')}</span></div>
        <div class="row"><span class="label">Date :</span><span>${fmtDate(doc.date || new Date())}</span></div>
        ${doc.date_echeance ? `<div class="row"><span class="label">Échéance :</span><span>${fmtDate(doc.date_echeance)}</span></div>` : ''}
      </div>
    </div>
    <div class="party-box dest">
      <h4>Destinataire</h4>
      <div class="nom">${esc(clientNom || '—')}</div>
      ${clientAdr ? `<div>${esc(clientAdr).replace(/\n/g, '<br>')}</div>` : ''}
    </div>
  </div>

  ${doc.objet ? `<div class="objet">${esc(doc.objet)}</div>` : ''}

  <table>
    <thead><tr>${theadCols}</tr></thead>
    <tbody>${lignesRows || `<tr><td colspan="${isBL ? 4 : 6}" style="text-align:center;color:#94a3b8;padding:5mm">Aucune ligne</td></tr>`}${emptyRows}</tbody>
  </table>

  <div class="after-table">
    <div class="after-left">
      ${conditionsContent ? `<div class="conditions-inline">${conditionsContent}</div>` : ''}
    </div>
    <div class="after-right">
      <div class="totaux-box">
        ${totauxRows}
      </div>
    </div>
  </div>

  <div class="signatures">
    <div class="sign-zone">
      <p>Signature du Client</p>
      <div class="sign-box"></div>
    </div>
    <div class="sign-zone">
      <p>Signature &amp; cachet de l'Entreprise</p>
      <div class="sign-box">${doc.signature_auto && ent.signature ? `<img src="${ent.signature}" alt="signature" style="max-width:55mm;max-height:18mm;object-fit:contain;">` : (doc.signature_auto ? esc(ent.nom) : '')}</div>
    </div>
  </div>

  <div class="footer">
    ${settings.message_remerciement ? `<div style="font-weight:bold;margin-bottom:1mm;">${esc(settings.message_remerciement)}</div>` : ''}
    ${esc(ent.nom)}${ent.tel ? ' · Tél : ' + esc(ent.tel) : ''}${ent.email ? ' · ' + esc(ent.email) : ''}${ent.rccm ? ' · RCCM : ' + esc(ent.rccm) : ''}
    ${settings.coordonnees_bancaires ? `<div style="margin-top:1mm;">${esc(settings.coordonnees_bancaires)}</div>` : ''}
    ${settings.mentions_legales ? `<div style="margin-top:1mm;font-style:italic;">${esc(settings.mentions_legales)}</div>` : ''}
  </div>
</body></html>`
}
