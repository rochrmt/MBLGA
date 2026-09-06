'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

// GET /api/produits/categories  (liste pour les filtres/formulaires)
router.get('/categories', async (_req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT c.id, c.nom,
              (SELECT COUNT(*) FROM produits p WHERE p.categorie_id = c.id) AS nb_produits
         FROM categories c ORDER BY c.nom`,
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des catégories' })
  }
})

// GET /api/produits
router.get('/', async (req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT p.*, cat.nom AS categorie_nom
         FROM produits p
         LEFT JOIN categories cat ON cat.id = p.categorie_id
        ORDER BY p.nom`,
    )
    res.json(rows)
  } catch (err) {
    console.error('[AGEO] produits GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des produits' })
  }
})

// POST /api/produits
router.post('/', async (req, res) => {
  const { nom, description, categorie_id, prix_ht, tva, stock, stock_min } = req.body || {}
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'La désignation est obligatoire' })

  try {
    const code = `PRD-${Math.floor(100000 + Math.random() * 900000)}`
    const id = await db.insert(
      `INSERT INTO produits (code, nom, description, categorie_id, prix_ht, tva, stock, stock_min)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, nom.trim(), description || null, categorie_id || null,
       Number(prix_ht) || 0, tva == null ? 20 : Number(tva),
       Number(stock) || 0, stock_min == null ? 5 : Number(stock_min)],
    )
    await log(req, { module: 'Produits', action: 'Création', description: `Produit créé : ${nom}` })
    const produit = await db.getOne('SELECT * FROM produits WHERE id = ?', [id])
    res.status(201).json(produit)
  } catch (err) {
    console.error('[AGEO] produits POST:', err.message)
    res.status(500).json({ error: 'Erreur lors de la création du produit' })
  }
})

// PUT /api/produits/:id
router.put('/:id', async (req, res) => {
  const { nom, description, categorie_id, prix_ht, tva, stock, stock_min, actif } = req.body || {}
  try {
    await db.run(
      `UPDATE produits
          SET nom = ?, description = ?, categorie_id = ?, prix_ht = ?, tva = ?,
              stock = ?, stock_min = ?, actif = ?
        WHERE id = ?`,
      [nom, description || null, categorie_id || null, Number(prix_ht) || 0,
       tva == null ? 20 : Number(tva), Number(stock) || 0,
       stock_min == null ? 5 : Number(stock_min), actif == null ? 1 : actif, req.params.id],
    )
    await log(req, { module: 'Produits', action: 'Modification', description: `Produit modifié : ${nom}` })
    const produit = await db.getOne('SELECT * FROM produits WHERE id = ?', [req.params.id])
    res.json(produit)
  } catch (err) {
    console.error('[AGEO] produits PUT:', err.message)
    res.status(500).json({ error: 'Erreur lors de la mise à jour' })
  }
})

// DELETE /api/produits/:id
router.delete('/:id', async (req, res) => {
  try {
    const nb = await db.getOne('SELECT COUNT(*) AS n FROM lignes_commande WHERE produit_id = ?', [req.params.id])
    if (nb.n > 0) {
      await db.run('UPDATE produits SET actif = 0 WHERE id = ?', [req.params.id])
    } else {
      await db.run('DELETE FROM produits WHERE id = ?', [req.params.id])
    }
    await log(req, { module: 'Produits', action: 'Suppression', description: `Produit #${req.params.id} supprimé` })
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] produits DELETE:', err.message)
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
