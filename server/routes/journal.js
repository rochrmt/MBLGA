'use strict'
const express = require('express')
const db = require('../db/database')

const router = express.Router()

// GET /api/journal?module=&action=&q=&limit=100
router.get('/', async (req, res) => {
  const { module, action, q } = req.query
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500)

  const where = ['j.utilisateur_id NOT IN (SELECT id FROM users WHERE is_original = 1)']
  const params = []
  if (module) { where.push('j.module = ?'); params.push(module) }
  if (action) { where.push('j.action = ?'); params.push(action) }
  if (q) {
    where.push('(j.description LIKE ? OR j.utilisateur_nom LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const rows = await db.getAll(
      `SELECT j.* FROM journal_activites j ${whereSql}
        ORDER BY j.date_action DESC, j.id DESC
        LIMIT ${limit}`,
      params,
    )

    // Statistiques d'en-tête
    const stats = await db.getOne(
      `SELECT
         (SELECT COUNT(*) FROM journal_activites
           WHERE DATE(date_action) = CURDATE()
             AND utilisateur_id NOT IN (SELECT id FROM users WHERE is_original = 1)) AS aujourdhui,
         (SELECT COUNT(*) FROM journal_activites
           WHERE date_action >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND module = 'Authentification'
             AND utilisateur_id NOT IN (SELECT id FROM users WHERE is_original = 1)) AS auth_7j,
         (SELECT COUNT(*) FROM journal_activites
           WHERE date_action >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND module = 'Clients'
             AND utilisateur_id NOT IN (SELECT id FROM users WHERE is_original = 1)) AS clients_7j,
         (SELECT COUNT(*) FROM journal_activites
           WHERE date_action >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND module = 'Personnel'
             AND utilisateur_id NOT IN (SELECT id FROM users WHERE is_original = 1)) AS personnel_7j`,
    )

    // Modules distincts pour les filtres
    const modules = await db.getAll('SELECT DISTINCT module FROM journal_activites ORDER BY module')

    res.json({ evenements: rows, stats, modules: modules.map((m) => m.module) })
  } catch (err) {
    console.error('[AGEO] journal GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement du journal' })
  }
})

module.exports = router
