'use strict'
const express = require('express')
const db = require('../db/database')

const router = express.Router()

const LINE_TOTAL = 'lc.quantite * lc.prix_unitaire * (1 - lc.remise / 100.0)'

function rangeStart(periode) {
  switch (periode) {
    case 'semaine':   return 'DATE_SUB(NOW(), INTERVAL 7 DAY)'
    case 'trimestre': return 'DATE_SUB(NOW(), INTERVAL 3 MONTH)'
    case 'annee':     return 'DATE_SUB(NOW(), INTERVAL 1 YEAR)'
    case 'mois':
    default:          return 'DATE_SUB(NOW(), INTERVAL 1 MONTH)'
  }
}

// GET /api/ventes?periode=mois
router.get('/', async (req, res) => {
  const periode = ['semaine', 'mois', 'trimestre', 'annee'].includes(req.query.periode)
    ? req.query.periode : 'mois'
  const start = rangeStart(periode)

  try {
    const stats = await db.getOne(
      `SELECT
         IFNULL(SUM(${LINE_TOTAL}), 0) AS ca,
         COUNT(DISTINCT cmd.id) AS commandes,
         COUNT(DISTINCT cmd.client_id) AS clients
       FROM commandes cmd
       JOIN lignes_commande lc ON lc.commande_id = cmd.id
      WHERE cmd.statut = 'livree' AND cmd.date_commande >= ${start}`,
    )

    const panier = stats.commandes > 0 ? stats.ca / stats.commandes : 0

    const evolution = await db.getAll(
      `SELECT DATE_FORMAT(cmd.date_commande, '%Y-%m-%d') AS jour,
              IFNULL(SUM(${LINE_TOTAL}), 0) AS ca
         FROM commandes cmd
         JOIN lignes_commande lc ON lc.commande_id = cmd.id
        WHERE cmd.statut = 'livree' AND cmd.date_commande >= ${start}
        GROUP BY DATE_FORMAT(cmd.date_commande, '%Y-%m-%d')
        ORDER BY jour`,
    )

    res.json({
      periode,
      ca:          stats.ca,
      commandes:   stats.commandes,
      clients:     stats.clients,
      panier_moyen: Math.round(panier),
      evolution,
    })
  } catch (err) {
    console.error('[AGEO] ventes GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des ventes' })
  }
})

module.exports = router
