'use strict'
const express = require('express')
const db = require('../db/database')

const router = express.Router()

// GET /api/search?q=...
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q) return res.json({ clients: [], produits: [], commandes: [], factures: [] })
  const like = `%${q}%`

  try {
    const [clients, produits, commandes, factures] = await Promise.all([
      db.getAll(
        `SELECT id, code, nom, ville FROM clients
          WHERE nom LIKE ? OR code LIKE ? OR email LIKE ? OR ville LIKE ?
          LIMIT 5`,
        [like, like, like, like],
      ),
      db.getAll(
        `SELECT id, code, nom, prix_ht FROM produits
          WHERE nom LIKE ? OR code LIKE ?
          LIMIT 5`,
        [like, like],
      ),
      db.getAll(
        `SELECT cmd.id, cmd.numero, cmd.statut, c.nom AS client_nom
           FROM commandes cmd LEFT JOIN clients c ON c.id = cmd.client_id
          WHERE cmd.numero LIKE ? OR c.nom LIKE ?
          LIMIT 5`,
        [like, like],
      ),
      db.getAll(
        `SELECT f.id, f.numero, f.statut, c.nom AS client_nom
           FROM factures f LEFT JOIN clients c ON c.id = f.client_id
          WHERE f.numero LIKE ? OR c.nom LIKE ?
          LIMIT 5`,
        [like, like],
      ),
    ])
    res.json({ clients, produits, commandes, factures })
  } catch (err) {
    console.error('[AGEO] search:', err.message)
    res.status(500).json({ error: 'Erreur lors de la recherche' })
  }
})

module.exports = router
