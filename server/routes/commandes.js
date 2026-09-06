'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

const MONTANT_HT = `
  (SELECT IFNULL(SUM(lc.quantite * lc.prix_unitaire * (1 - lc.remise / 100.0)), 0)
     FROM lignes_commande lc WHERE lc.commande_id = cmd.id)`
const NB_ARTICLES = `
  (SELECT IFNULL(SUM(lc.quantite), 0) FROM lignes_commande lc WHERE lc.commande_id = cmd.id)`

// GET /api/commandes
router.get('/', async (_req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT cmd.*, c.nom AS client_nom,
              ${MONTANT_HT} AS montant_ht,
              ${NB_ARTICLES} AS nb_articles
         FROM commandes cmd
         LEFT JOIN clients c ON c.id = cmd.client_id
        ORDER BY cmd.date_commande DESC, cmd.id DESC`,
    )
    res.json(rows)
  } catch (err) {
    console.error('[AGEO] commandes GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des commandes' })
  }
})

// GET /api/commandes/livrees-impayees
router.get('/livrees-impayees', async (_req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT cmd.*, c.nom AS client_nom,
              ${MONTANT_HT} AS montant_ht,
              ${NB_ARTICLES} AS nb_articles
         FROM commandes cmd
         LEFT JOIN clients c ON c.id = cmd.client_id
        WHERE cmd.statut = 'livree' AND (cmd.statut_paiement = 'impayee' OR cmd.statut_paiement IS NULL)
        ORDER BY cmd.date_commande DESC, cmd.id DESC`,
    )
    res.json(rows)
  } catch (err) {
    console.error('[AGEO] commandes livrees-impayees:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des commandes impayées' })
  }
})

// GET /api/commandes/:id
router.get('/:id', async (req, res) => {
  try {
    const cmd = await db.getOne(
      `SELECT cmd.*, c.nom AS client_nom FROM commandes cmd
         LEFT JOIN clients c ON c.id = cmd.client_id WHERE cmd.id = ?`,
      [req.params.id],
    )
    if (!cmd) return res.status(404).json({ error: 'Commande introuvable' })
    cmd.lignes = await db.getAll(
      `SELECT lc.*, p.nom AS produit_nom, p.tva
         FROM lignes_commande lc
         LEFT JOIN produits p ON p.id = lc.produit_id
        WHERE lc.commande_id = ?`,
      [req.params.id],
    )
    res.json(cmd)
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/commandes
router.post('/', async (req, res) => {
  const { client_id, notes, lignes } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'Le client est obligatoire' })
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ error: 'Ajoutez au moins un article' })
  }

  try {
    const numero = `CMD-${Math.floor(100000 + Math.random() * 900000)}`
    const id = await db.transaction(async (tq) => {
      const cmdId = await tq.insert(
        `INSERT INTO commandes (numero, client_id, statut, notes)
         VALUES (?, ?, 'en_attente', ?)`,
        [numero, client_id, notes || null],
      )
      for (const l of lignes) {
        await tq.run(
          `INSERT INTO lignes_commande (commande_id, produit_id, quantite, prix_unitaire, remise)
           VALUES (?, ?, ?, ?, ?)`,
          [cmdId, l.produit_id, Number(l.quantite) || 1, Number(l.prix_unitaire) || 0, Number(l.remise) || 0],
        )
      }
      return cmdId
    })
    await log(req, { module: 'Commandes', action: 'Création', description: `Commande créée : ${numero}` })
    res.status(201).json({ id, numero })
  } catch (err) {
    console.error('[AGEO] commandes POST:', err.message)
    res.status(500).json({ error: 'Erreur lors de la création de la commande' })
  }
})

// PUT /api/commandes/:id/statut
router.put('/:id/statut', async (req, res) => {
  const { statut } = req.body || {}
  const valides = ['en_attente', 'en_cours', 'livree', 'annulee']
  if (!valides.includes(statut)) return res.status(400).json({ error: 'Statut invalide' })

  try {
    const current = await db.getOne('SELECT statut FROM commandes WHERE id = ?', [req.params.id])
    if (!current) return res.status(404).json({ error: 'Commande introuvable' })

    // Décrémente le stock au passage en "livree"
    if (statut === 'livree' && current.statut !== 'livree') {
      const lignes = await db.getAll(
        'SELECT produit_id, quantite FROM lignes_commande WHERE commande_id = ?',
        [req.params.id],
      )
      for (const l of lignes) {
        await db.run('UPDATE produits SET stock = stock - ? WHERE id = ?', [l.quantite, l.produit_id])
      }
    }

    await db.run('UPDATE commandes SET statut = ? WHERE id = ?', [statut, req.params.id])
    await log(req, { module: 'Commandes', action: 'Statut', description: `Commande #${req.params.id} → ${statut}` })
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] commandes statut:', err.message)
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' })
  }
})

// DELETE /api/commandes/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM lignes_commande WHERE commande_id = ?', [req.params.id])
    await db.run('DELETE FROM commandes WHERE id = ?', [req.params.id])
    await log(req, { module: 'Commandes', action: 'Suppression', description: `Commande #${req.params.id} supprimée` })
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] commandes DELETE:', err.message)
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
