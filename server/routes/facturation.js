'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

function ligneTotal(l) {
  return (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0)
       * (1 - (Number(l.remise) || 0) / 100)
       + (Number(l.main_oeuvre) || 0)
}

function computeTotals(lignes, tauxTva, remiseGlobale, avance) {
  const totalHt = lignes.reduce((s, l) => s + ligneTotal(l), 0)
  const tva = totalHt * ((Number(tauxTva) || 0) / 100)
  const totalTtc = totalHt + tva
  const remise = Number(remiseGlobale) || 0
  const av = Number(avance) || 0
  const net = totalTtc - remise
  const reste = net - av
  return { totalHt, tva, totalTtc, net, reste }
}

const PREFIXES = {
  bon_livraison:      'BL',
  facture_proforma:   'PRO',
  facture_definitive: 'FAC',
}

// GET /api/facturation
router.get('/', async (_req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT f.*, c.nom AS client_nom, cmd.numero AS commande_numero
         FROM factures f
         LEFT JOIN clients c   ON c.id = f.client_id
         LEFT JOIN commandes cmd ON cmd.id = f.commande_id
        ORDER BY f.date_emission DESC, f.id DESC`,
    )
    res.json(rows)
  } catch (err) {
    console.error('[AGEO] factures GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des factures' })
  }
})

// GET /api/facturation/:id
router.get('/:id', async (req, res) => {
  try {
    const f = await db.getOne(
      `SELECT f.*, c.nom AS client_nom, cmd.numero AS commande_numero
         FROM factures f
         LEFT JOIN clients c ON c.id = f.client_id
         LEFT JOIN commandes cmd ON cmd.id = f.commande_id
        WHERE f.id = ?`,
      [req.params.id],
    )
    if (!f) return res.status(404).json({ error: 'Facture introuvable' })
    f.lignes = await db.getAll('SELECT * FROM lignes_facture WHERE facture_id = ?', [req.params.id])
    res.json(f)
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

async function nextNumero(tq, type) {
  const prefix = PREFIXES[type] || 'FAC'
  const row = await tq.getOne(
    `SELECT COUNT(*) AS n FROM factures WHERE type_document = ?`, [type],
  )
  const seq = String((row?.n || 0) + 1).padStart(5, '0')
  return `${prefix}-${seq}`
}

// POST /api/facturation
router.post('/', async (req, res) => {
  const {
    type_document = 'facture_definitive',
    client_id, commande_id, date_echeance, notes, taux_tva, lignes,
    client_nom_libre, client_adresse_libre, objet, signature_auto,
    conditions_reglement, mode_reglement, delai_livraison, duree_garantie,
    remise_globale, avance,
  } = req.body || {}

  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ error: 'Ajoutez au moins une ligne' })
  }

  try {
    const { totalHt, tva, totalTtc, reste } = computeTotals(lignes, taux_tva, remise_globale, avance)

    const { id, numero } = await db.transaction(async (tq) => {
      const numero = await nextNumero(tq, type_document)
      const facId = await tq.insert(
        `INSERT INTO factures
           (numero, type_document, client_id, commande_id, date_echeance, statut,
            total_ht, taux_tva, montant_tva, total_ttc, remise_globale, avance, reste_a_payer,
            notes, client_nom_libre, client_adresse_libre, objet, signature_auto,
            conditions_reglement, mode_reglement, delai_livraison, duree_garantie)
         VALUES (?, ?, ?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [numero, type_document, client_id || null, commande_id || null, date_echeance || null,
         totalHt, Number(taux_tva) || 0, tva, totalTtc,
         Number(remise_globale) || 0, Number(avance) || 0, reste,
         notes || null, client_nom_libre || null, client_adresse_libre || null, objet || null,
         signature_auto ? 1 : 0, conditions_reglement || null, mode_reglement || null,
         delai_livraison || null, duree_garantie || null],
      )
      for (const l of lignes) {
        await tq.run(
          `INSERT INTO lignes_facture
             (facture_id, reference, description, quantite, qte_commandee, qte_livree,
              prix_unitaire, main_oeuvre, remise, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [facId, l.reference || null, l.description || '',
           Number(l.quantite) || 0, Number(l.qte_commandee) || 0, Number(l.qte_livree) || 0,
           Number(l.prix_unitaire) || 0, Number(l.main_oeuvre) || 0, Number(l.remise) || 0,
           ligneTotal(l)],
        )
      }
      return { id: facId, numero }
    })
    await log(req, { module: 'Facturation', action: 'Création', description: `Document créé : ${numero}` })
    res.status(201).json({ id, numero })
  } catch (err) {
    console.error('[AGEO] factures POST:', err.message)
    res.status(500).json({ error: 'Erreur lors de la création du document' })
  }
})

// PUT /api/facturation/:id  (modifier un document existant)
router.put('/:id', async (req, res) => {
  const {
    client_id, commande_id, date_echeance, notes, taux_tva, lignes,
    client_nom_libre, client_adresse_libre, objet, signature_auto,
    conditions_reglement, mode_reglement, delai_livraison, duree_garantie,
    remise_globale, avance,
  } = req.body || {}

  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ error: 'Ajoutez au moins une ligne' })
  }

  try {
    const existing = await db.getOne('SELECT * FROM factures WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Document introuvable' })

    const { totalHt, tva, totalTtc, reste } = computeTotals(lignes, taux_tva, remise_globale, avance)

    await db.transaction(async (tq) => {
      await tq.run(
        `UPDATE factures SET
           client_id = ?, commande_id = ?, date_echeance = ?,
           total_ht = ?, taux_tva = ?, montant_tva = ?, total_ttc = ?,
           remise_globale = ?, avance = ?, reste_a_payer = ?,
           notes = ?, client_nom_libre = ?, client_adresse_libre = ?,
           objet = ?, signature_auto = ?,
           conditions_reglement = ?, mode_reglement = ?,
           delai_livraison = ?, duree_garantie = ?
         WHERE id = ?`,
        [client_id || null, commande_id || null, date_echeance || null,
         totalHt, Number(taux_tva) || 0, tva, totalTtc,
         Number(remise_globale) || 0, Number(avance) || 0, reste,
         notes || null, client_nom_libre || null, client_adresse_libre || null,
         objet || null, signature_auto ? 1 : 0,
         conditions_reglement || null, mode_reglement || null,
         delai_livraison || null, duree_garantie || null,
         req.params.id],
      )
      await tq.run('DELETE FROM lignes_facture WHERE facture_id = ?', [req.params.id])
      for (const l of lignes) {
        await tq.run(
          `INSERT INTO lignes_facture
             (facture_id, reference, description, quantite, qte_commandee, qte_livree,
              prix_unitaire, main_oeuvre, remise, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.params.id, l.reference || null, l.description || '',
           Number(l.quantite) || 0, Number(l.qte_commandee) || 0, Number(l.qte_livree) || 0,
           Number(l.prix_unitaire) || 0, Number(l.main_oeuvre) || 0, Number(l.remise) || 0,
           ligneTotal(l)],
        )
      }
    })

    await log(req, { module: 'Facturation', action: 'Modification', description: `Document modifié : ${existing.numero}` })
    res.json({ ok: true, numero: existing.numero })
  } catch (err) {
    console.error('[AGEO] factures PUT:', err.message)
    res.status(500).json({ error: 'Erreur lors de la modification du document' })
  }
})

// PUT /api/facturation/:id/statut
router.put('/:id/statut', async (req, res) => {
  const { statut } = req.body || {}
  const valides = ['brouillon', 'emise', 'partielle', 'payee', 'annulee']
  if (!valides.includes(statut)) return res.status(400).json({ error: 'Statut invalide' })
  try {
    await db.run('UPDATE factures SET statut = ? WHERE id = ?', [statut, req.params.id])
    await log(req, { module: 'Facturation', action: 'Statut', description: `Facture #${req.params.id} → ${statut}` })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' })
  }
})

// POST /api/facturation/:id/paiement
router.post('/:id/paiement', async (req, res) => {
  const { montant } = req.body || {}
  try {
    const f = await db.getOne('SELECT * FROM factures WHERE id = ?', [req.params.id])
    if (!f) return res.status(404).json({ error: 'Facture introuvable' })

    const paye = (f.montant_paye || 0) + (Number(montant) || 0)
    const statut = paye >= f.total_ttc ? 'payee' : (paye > 0 ? 'partielle' : f.statut)
    await db.run('UPDATE factures SET montant_paye = ?, statut = ? WHERE id = ?', [paye, statut, req.params.id])
    await log(req, { module: 'Facturation', action: 'Paiement', description: `Paiement facture #${req.params.id} : ${montant}` })
    res.json({ ok: true, montant_paye: paye, statut })
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de l'enregistrement du paiement" })
  }
})

// DELETE /api/facturation/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM lignes_facture WHERE facture_id = ?', [req.params.id])
    await db.run('DELETE FROM factures WHERE id = ?', [req.params.id])
    await log(req, { module: 'Facturation', action: 'Suppression', description: `Facture #${req.params.id} supprimée` })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
