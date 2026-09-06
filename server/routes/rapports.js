'use strict'
const express = require('express')
const db = require('../db/database')

const router = express.Router()

const LINE_TOTAL = 'lc.quantite * lc.prix_unitaire * (1 - lc.remise / 100.0)'

// GET /api/rapports/synthese?annee=2026
router.get('/synthese', async (req, res) => {
  const annee = parseInt(req.query.annee, 10) || new Date().getFullYear()
  try {
    const caLivre = await db.getOne(
      `SELECT IFNULL(SUM(${LINE_TOTAL}), 0) AS ca
         FROM commandes cmd JOIN lignes_commande lc ON lc.commande_id = cmd.id
        WHERE cmd.statut = 'livree' AND YEAR(cmd.date_commande) = ?`,
      [annee],
    )
    const commandes = await db.getOne(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN statut = 'livree' THEN 1 ELSE 0 END) AS livrees,
              SUM(CASE WHEN statut = 'annulee' THEN 1 ELSE 0 END) AS annulees
         FROM commandes WHERE YEAR(date_commande) = ?`,
      [annee],
    )
    const clients = await db.getOne('SELECT COUNT(*) AS n FROM clients WHERE actif = 1')

    const mensuel = await db.getAll(
      `SELECT MONTH(cmd.date_commande) AS mois, IFNULL(SUM(${LINE_TOTAL}), 0) AS ca
         FROM commandes cmd JOIN lignes_commande lc ON lc.commande_id = cmd.id
        WHERE cmd.statut = 'livree' AND YEAR(cmd.date_commande) = ?
        GROUP BY MONTH(cmd.date_commande) ORDER BY mois`,
      [annee],
    )

    const total = commandes.total || 0
    const tauxLivraison = total > 0 ? Math.round((commandes.livrees / total) * 100) : 0

    res.json({
      annee,
      ca_livre:       caLivre.ca,
      commandes:      total,
      commandes_livrees: commandes.livrees || 0,
      commandes_annulees: commandes.annulees || 0,
      clients_actifs: clients.n,
      taux_livraison: tauxLivraison,
      mensuel,
    })
  } catch (err) {
    console.error('[AGEO] rapports synthese:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement de la synthèse' })
  }
})

// GET /api/rapports/categories?annee=2026
router.get('/categories', async (req, res) => {
  const annee = parseInt(req.query.annee, 10) || new Date().getFullYear()
  try {
    const rows = await db.getAll(
      `SELECT IFNULL(cat.nom, 'Sans catégorie') AS categorie,
              IFNULL(SUM(${LINE_TOTAL}), 0) AS ca,
              IFNULL(SUM(lc.quantite), 0) AS quantite
         FROM lignes_commande lc
         JOIN commandes cmd ON cmd.id = lc.commande_id AND cmd.statut = 'livree' AND YEAR(cmd.date_commande) = ?
         JOIN produits p ON p.id = lc.produit_id
         LEFT JOIN categories cat ON cat.id = p.categorie_id
        GROUP BY cat.nom ORDER BY ca DESC`,
      [annee],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement par catégorie' })
  }
})

// GET /api/rapports/stock
router.get('/stock', async (_req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT p.code, p.nom, p.stock, p.stock_min, p.prix_ht,
              (p.stock * p.prix_ht) AS valeur,
              CASE WHEN p.stock <= p.stock_min THEN 1 ELSE 0 END AS alerte,
              cat.nom AS categorie_nom
         FROM produits p
         LEFT JOIN categories cat ON cat.id = p.categorie_id
        WHERE p.actif = 1
        ORDER BY alerte DESC, p.nom`,
    )
    const valeurTotale = rows.reduce((s, r) => s + (r.valeur || 0), 0)
    const alertes = rows.filter((r) => r.alerte).length
    res.json({ produits: rows, valeur_totale: valeurTotale, alertes })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement du stock' })
  }
})

// GET /api/rapports/clients?annee=2026
router.get('/clients', async (req, res) => {
  const annee = parseInt(req.query.annee, 10) || new Date().getFullYear()
  try {
    const rows = await db.getAll(
      `SELECT c.nom,
              COUNT(DISTINCT cmd.id) AS nb_commandes,
              IFNULL(SUM(${LINE_TOTAL}), 0) AS ca
         FROM clients c
         JOIN commandes cmd ON cmd.client_id = c.id AND cmd.statut = 'livree' AND YEAR(cmd.date_commande) = ?
         JOIN lignes_commande lc ON lc.commande_id = cmd.id
        GROUP BY c.nom ORDER BY ca DESC
        LIMIT 20`,
      [annee],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de l'analyse clients" })
  }
})

module.exports = router
