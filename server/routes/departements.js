'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

// GET /api/departements
router.get('/', async (_req, res) => {
  try {
    const rows = await db.getAll('SELECT * FROM departements ORDER BY nom')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des départements' })
  }
})

// POST /api/departements
router.post('/', async (req, res) => {
  const { nom } = req.body || {}
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'Nom obligatoire' })
  try {
    const id = await db.insert(
      'INSERT INTO departements (nom) VALUES (?)', [nom.trim()],
    )
    await log(req, { module: 'Personnel', action: 'Création', description: `Département créé : ${nom}` })
    res.status(201).json({ id, nom: nom.trim() })
  } catch (err) {
    res.status(400).json({ error: 'Ce département existe déjà' })
  }
})

// PUT /api/departements/:id
router.put('/:id', async (req, res) => {
  const { nom } = req.body || {}
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'Nom obligatoire' })
  try {
    await db.run('UPDATE departements SET nom = ? WHERE id = ?', [nom.trim(), req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: 'Ce département existe déjà' })
  }
})

// DELETE /api/departements/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM departements WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
