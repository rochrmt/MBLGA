'use strict'

/*
 * Numérotation des documents commerciaux (FAC-*, PRO-*, BL-*).
 *
 * Le prochain numéro est calculé sur le MAX du suffixe existant et non sur
 * COUNT(*) : après suppression d'un document, le comptage rendait un numéro
 * déjà pris → violation de UQ_factures_numero → erreur 500 permanente.
 * Le filtre porte sur le préfixe du numéro (et non sur type_document) afin de
 * rester correct même si une ligne a changé de type.
 */

const PREFIXES = {
  bon_livraison:      'BL',
  facture_proforma:   'PRO',
  facture_definitive: 'FAC',
}

// tq : connexion transactionnelle (ou db directement)
async function nextNumero(tq, type) {
  const prefix = PREFIXES[type] || 'FAC'
  const row = await tq.getOne(
    `SELECT MAX(CAST(SUBSTRING_INDEX(numero, '-', -1) AS UNSIGNED)) AS n
       FROM factures WHERE numero LIKE ?`,
    [`${prefix}-%`],
  )
  const seq = String((row?.n || 0) + 1).padStart(5, '0')
  return `${prefix}-${seq}`
}

// true si l'erreur MySQL est une violation d'unicité sur le numéro de facture
function isDuplicateNumero(err) {
  return !!err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)
    && String(err.message || '').includes('numero')
}

// Exécute fn (qui doit créer le document via nextNumero) avec nouvelle tentative
// en cas de collision de numéro — couvre les générations simultanées.
// Chaque tentative repart dans une transaction neuve (nouveau snapshot InnoDB).
async function withNumeroRetry(fn, maxAttempts = 4) {
  let lastErr = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isDuplicateNumero(err)) throw err
    }
  }
  throw lastErr
}

module.exports = { PREFIXES, nextNumero, isDuplicateNumero, withNumeroRetry }
