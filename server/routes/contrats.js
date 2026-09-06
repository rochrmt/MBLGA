'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

// Normalise une valeur date (objet Date SQL Server ou string) en YYYY-MM-DD
function toDateString(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string') return v.slice(0, 10)
  return null
}

// Avance une date selon la périodicité (renvoie une chaîne YYYY-MM-DD)
function avancerEcheance(dateStr, periodicite) {
  const d = dateStr ? new Date(dateStr) : new Date()
  const map = { mensuel: 1, trimestriel: 3, semestriel: 6, annuel: 12 }
  if (periodicite === 'unique' || !map[periodicite]) return null
  d.setMonth(d.getMonth() + map[periodicite])
  return d.toISOString().slice(0, 10)
}

const PAYE_SQL = `
  (SELECT IFNULL(SUM(cp.montant), 0)
     FROM contrats_paiements cp WHERE cp.contrat_id = ct.id)`

// GET /api/contrats
router.get('/', async (_req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT ct.*, c.nom AS client_nom, c.code AS client_code,
              ${PAYE_SQL} AS total_paye
         FROM contrats ct
         JOIN clients c ON c.id = ct.client_id
        ORDER BY
          CASE ct.statut WHEN 'actif' THEN 0 ELSE 1 END,
          ct.prochaine_echeance ASC, ct.reference DESC`,
    )
    res.json(rows)
  } catch (err) {
    console.error('[AGEO] contrats GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des contrats' })
  }
})

// GET /api/contrats/:id  (avec historique des paiements)
router.get('/:id', async (req, res) => {
  try {
    const c = await db.getOne(
      `SELECT ct.*, c.nom AS client_nom, c.code AS client_code, ${PAYE_SQL} AS total_paye
         FROM contrats ct JOIN clients c ON c.id = ct.client_id
        WHERE ct.id = ?`,
      [req.params.id],
    )
    if (!c) return res.status(404).json({ error: 'Contrat introuvable' })
    c.paiements = await db.getAll(
      'SELECT * FROM contrats_paiements WHERE contrat_id = ? ORDER BY date_paiement DESC, id DESC',
      [req.params.id],
    )
    res.json(c)
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/contrats
router.post('/', async (req, res) => {
  const {
    client_id, type, intitule, montant, periodicite, date_debut, date_fin,
    prochaine_echeance, jours_relance, statut, notes,
  } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'Client obligatoire' })
  if (!intitule || !intitule.trim()) return res.status(400).json({ error: "L'intitulé est obligatoire" })

  try {
    const prefix = type === 'abonnement' ? 'ABO' : 'CTR'
    const reference = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`
    // Pour un abonnement sans échéance fournie, on part de la date de début + périodicité
    let echeance = prochaine_echeance || null
    if (type === 'abonnement' && !echeance) {
      echeance = avancerEcheance(date_debut, periodicite)
    }
    const id = await db.insert(
      `INSERT INTO contrats
         (reference, client_id, type, intitule, montant, periodicite,
          date_debut, date_fin, prochaine_echeance, jours_relance, statut, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reference, client_id, type || 'contrat', intitule.trim(), Number(montant) || 0,
       periodicite || 'mensuel', date_debut || null, date_fin || null,
       echeance, Number(jours_relance) || 7, statut || 'actif', notes || null],
    )
    await log(req, { module: 'Contrats', action: 'Création', description: `${type === 'abonnement' ? 'Abonnement' : 'Contrat'} créé : ${intitule}` })
    const created = await db.getOne('SELECT * FROM contrats WHERE id = ?', [id])
    res.status(201).json(created)
  } catch (err) {
    console.error('[AGEO] contrats POST:', err.message)
    res.status(500).json({ error: 'Erreur lors de la création du contrat' })
  }
})

// PUT /api/contrats/:id
router.put('/:id', async (req, res) => {
  const {
    client_id, type, intitule, montant, periodicite, date_debut, date_fin,
    prochaine_echeance, jours_relance, statut, notes,
  } = req.body || {}
  try {
    const cur = await db.getOne('SELECT * FROM contrats WHERE id = ?', [req.params.id])
    if (!cur) return res.status(404).json({ error: 'Contrat introuvable' })
    await db.run(
      `UPDATE contrats
          SET client_id = ?, type = ?, intitule = ?, montant = ?, periodicite = ?,
              date_debut = ?, date_fin = ?, prochaine_echeance = ?, jours_relance = ?,
              statut = ?, notes = ?, updated_at = NOW()
        WHERE id = ?`,
      [client_id ?? cur.client_id, type ?? cur.type, intitule ?? cur.intitule,
       montant == null ? cur.montant : Number(montant), periodicite ?? cur.periodicite,
       date_debut ?? cur.date_debut, date_fin ?? cur.date_fin,
       prochaine_echeance ?? cur.prochaine_echeance,
       jours_relance == null ? cur.jours_relance : Number(jours_relance),
       statut ?? cur.statut, notes ?? cur.notes, req.params.id],
    )
    await log(req, { module: 'Contrats', action: 'Modification', description: `Contrat modifié : ${intitule || cur.intitule}` })
    const updated = await db.getOne('SELECT * FROM contrats WHERE id = ?', [req.params.id])
    res.json(updated)
  } catch (err) {
    console.error('[AGEO] contrats PUT:', err.message)
    res.status(500).json({ error: 'Erreur lors de la mise à jour' })
  }
})

// POST /api/contrats/:id/paiement  — enregistre un paiement et avance l'échéance (abonnement)
router.post('/:id/paiement', async (req, res) => {
  const { montant, date_paiement, mode, notes } = req.body || {}
  try {
    const c = await db.getOne('SELECT * FROM contrats WHERE id = ?', [req.params.id])
    if (!c) return res.status(404).json({ error: 'Contrat introuvable' })

    await db.run(
      `INSERT INTO contrats_paiements (contrat_id, montant, date_paiement, mode, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, Number(montant) || 0, date_paiement || null, mode || null, notes || null],
    )

    // Abonnement : on avance la prochaine échéance à partir de l'échéance courante
    if (c.type === 'abonnement') {
      const base = c.prochaine_echeance || date_paiement || new Date().toISOString().slice(0, 10)
      const prochaine = avancerEcheance(base, c.periodicite)
      if (prochaine) {
        await db.run('UPDATE contrats SET prochaine_echeance = ?, updated_at = NOW() WHERE id = ?',
          [prochaine, req.params.id])
      }
    }
    await log(req, { module: 'Contrats', action: 'Paiement', description: `Paiement contrat ${c.reference} : ${montant}` })
    const updated = await db.getOne('SELECT * FROM contrats WHERE id = ?', [req.params.id])
    res.status(201).json(updated)
  } catch (err) {
    console.error('[AGEO] contrats paiement:', err.message)
    res.status(500).json({ error: "Erreur lors de l'enregistrement du paiement" })
  }
})

// POST /api/contrats/:id/facture — génère une facture définitive depuis le contrat
router.post('/:id/facture', async (req, res) => {
  try {
    const c = await db.getOne('SELECT * FROM contrats WHERE id = ?', [req.params.id])
    if (!c) return res.status(404).json({ error: 'Contrat introuvable' })

    const client = await db.getOne('SELECT * FROM clients WHERE id = ?', [c.client_id])

    // Numérotation facture
    const row = await db.getOne(
      "SELECT COUNT(*) AS n FROM factures WHERE type_document = 'facture_definitive'",
    )
    const numero = `FAC-${String((row?.n || 0) + 1).padStart(5, '0')}`

    const montant = Number(c.montant) || 0
    const echeanceStr = toDateString(c.prochaine_echeance)
    const ligneDesc = c.type === 'abonnement'
      ? `${c.intitule} — ${c.periodicite} (échéance ${echeanceStr || '—'})`
      : c.intitule

    const facId = await db.insert(
      `INSERT INTO factures
         (numero, type_document, client_id, commande_id, date_echeance, statut,
          total_ht, taux_tva, montant_tva, total_ttc, remise_globale, avance, reste_a_payer,
          notes, client_nom_libre, client_adresse_libre, objet, signature_auto,
          conditions_reglement, mode_reglement)
       VALUES (?, 'facture_definitive', ?, NULL, ?, 'brouillon', ?, 0, 0, ?, 0, 0, ?, ?, ?, ?, ?, 0, NULL, NULL)`,
      [numero, c.client_id, echeanceStr,
       montant, montant, montant,
       `Facture générée depuis ${c.type === 'abonnement' ? 'abonnement' : 'contrat'} ${c.reference}`,
       client?.nom || null, client?.adresse || null, c.intitule],
    )

    await db.run(
      `INSERT INTO lignes_facture (facture_id, reference, description, quantite, prix_unitaire, remise, total)
       VALUES (?, ?, ?, 1, ?, 0, ?)`,
      [facId, c.reference, ligneDesc, montant, montant],
    )

    await log(req, { module: 'Contrats', action: 'Facturation', description: `Facture ${numero} générée depuis contrat ${c.reference}` })
    res.status(201).json({ id: facId, numero })
  } catch (err) {
    console.error('[AGEO] contrats facture:', err.message)
    res.status(500).json({ error: 'Erreur lors de la génération de la facture' })
  }
})

// DELETE /api/contrats/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM contrats WHERE id = ?', [req.params.id])
    await log(req, { module: 'Contrats', action: 'Suppression', description: `Contrat #${req.params.id} supprimé` })
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] contrats DELETE:', err.message)
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
