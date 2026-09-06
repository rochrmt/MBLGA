'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

const CA_SQL = `
  (SELECT IFNULL(SUM(lc.quantite * lc.prix_unitaire * (1 - lc.remise / 100.0)), 0)
     FROM lignes_commande lc
     JOIN commandes cm ON cm.id = lc.commande_id
    WHERE cm.client_id = c.id AND cm.statut <> 'annulee')`

const NB_SQL = `
  (SELECT COUNT(*) FROM commandes cm2 WHERE cm2.client_id = c.id)`

// GET /api/clients
router.get('/', async (req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT c.*, ${NB_SQL} AS nb_commandes, ${CA_SQL} AS ca_total
         FROM clients c
        ORDER BY c.nom`,
    )
    res.json(rows)
  } catch (err) {
    console.error('[AGEO] clients GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des clients' })
  }
})

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
  try {
    const client = await db.getOne('SELECT * FROM clients WHERE id = ?', [req.params.id])
    if (!client) return res.status(404).json({ error: 'Client introuvable' })
    res.json(client)
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/clients
router.post('/', async (req, res) => {
  const { nom, email, telephone, adresse, ville, type } = req.body || {}
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })

  try {
    const code = `CLT-${Math.floor(100000 + Math.random() * 900000)}`
    const id = await db.insert(
      `INSERT INTO clients (code, nom, email, telephone, adresse, ville, type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code, nom.trim(), email || null, telephone || null, adresse || null, ville || null, type || 'client'],
    )
    await log(req, { module: 'Clients', action: 'Création', description: `Client créé : ${nom}` })
    const client = await db.getOne('SELECT * FROM clients WHERE id = ?', [id])
    res.status(201).json(client)
  } catch (err) {
    console.error('[AGEO] clients POST:', err.message)
    res.status(500).json({ error: 'Erreur lors de la création du client' })
  }
})

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  const { nom, email, telephone, adresse, ville, type, actif } = req.body || {}
  try {
    await db.run(
      `UPDATE clients
          SET nom = ?, email = ?, telephone = ?, adresse = ?, ville = ?, type = ?,
              actif = ?, updated_at = NOW()
        WHERE id = ?`,
      [nom, email || null, telephone || null, adresse || null, ville || null,
       type || 'client', actif == null ? 1 : actif, req.params.id],
    )
    await log(req, { module: 'Clients', action: 'Modification', description: `Client modifié : ${nom}` })
    const client = await db.getOne('SELECT * FROM clients WHERE id = ?', [req.params.id])
    res.json(client)
  } catch (err) {
    console.error('[AGEO] clients PUT:', err.message)
    res.status(500).json({ error: 'Erreur lors de la mise à jour' })
  }
})

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  try {
    const nb = await db.getOne('SELECT COUNT(*) AS n FROM commandes WHERE client_id = ?', [req.params.id])
    if (nb.n > 0) {
      // Désactivation si des commandes existent (intégrité référentielle)
      await db.run('UPDATE clients SET actif = 0, updated_at = NOW() WHERE id = ?', [req.params.id])
    } else {
      await db.run('DELETE FROM clients WHERE id = ?', [req.params.id])
    }
    await log(req, { module: 'Clients', action: 'Suppression', description: `Client #${req.params.id} supprimé` })
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] clients DELETE:', err.message)
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
