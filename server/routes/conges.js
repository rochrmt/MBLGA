'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

function nbJours(debut, fin) {
  const d1 = new Date(debut)
  const d2 = new Date(fin)
  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : 1
}

// GET /api/conges
router.get('/', async (_req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT cg.*, e.nom AS employe_nom, e.prenom AS employe_prenom
         FROM conges cg JOIN employes e ON e.id = cg.employe_id
        ORDER BY cg.created_at DESC, cg.id DESC`,
    )
    res.json(rows)
  } catch (err) {
    console.error('[AGEO] conges GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des congés' })
  }
})

// POST /api/conges
router.post('/', async (req, res) => {
  const { employe_id, type, date_debut, date_fin, motif } = req.body || {}
  if (!employe_id || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'Employé, date de début et date de fin obligatoires' })
  }
  try {
    const jours = nbJours(date_debut, date_fin)
    const id = await db.insert(
      `INSERT INTO conges (employe_id, type, date_debut, date_fin, nb_jours, motif, statut)
       VALUES (?, ?, ?, ?, ?, ?, 'en_attente')`,
      [employe_id, type || 'conge_paye', date_debut, date_fin, jours, motif || null],
    )
    await log(req, { module: 'Personnel', action: 'Congé', description: `Demande de congé #${id}` })
    res.status(201).json({ id })
  } catch (err) {
    console.error('[AGEO] conges POST:', err.message)
    res.status(500).json({ error: 'Erreur lors de la création de la demande' })
  }
})

// PUT /api/conges/:id/statut
router.put('/:id/statut', async (req, res) => {
  const { statut } = req.body || {}
  const valides = ['en_attente', 'approuve', 'refuse']
  if (!valides.includes(statut)) return res.status(400).json({ error: 'Statut invalide' })
  try {
    await db.run('UPDATE conges SET statut = ? WHERE id = ?', [statut, req.params.id])
    await log(req, { module: 'Personnel', action: 'Congé', description: `Congé #${req.params.id} → ${statut}` })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' })
  }
})

// DELETE /api/conges/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM conges WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
