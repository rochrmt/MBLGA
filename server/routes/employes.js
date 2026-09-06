'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

// GET /api/employes
router.get('/', async (_req, res) => {
  try {
    const rows = await db.getAll('SELECT * FROM employes ORDER BY nom, prenom')
    res.json(rows)
  } catch (err) {
    console.error('[AGEO] employes GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des employés' })
  }
})

// GET /api/employes/:id
router.get('/:id', async (req, res) => {
  try {
    const emp = await db.getOne('SELECT * FROM employes WHERE id = ?', [req.params.id])
    if (!emp) return res.status(404).json({ error: 'Employé introuvable' })
    res.json(emp)
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/employes
router.post('/', async (req, res) => {
  const { nom, prenom, poste, departement, telephone, email, date_embauche, salaire } = req.body || {}
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })

  try {
    const matricule = `EMP-${Math.floor(100000 + Math.random() * 900000)}`
    const id = await db.insert(
      `INSERT INTO employes
         (matricule, nom, prenom, poste, departement, telephone, email, date_embauche, salaire)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [matricule, nom.trim(), prenom || null, poste || null, departement || null,
       telephone || null, email || null, date_embauche || null, Number(salaire) || 0],
    )
    await log(req, { module: 'Personnel', action: 'Création', description: `Employé créé : ${nom} ${prenom || ''}` })
    const emp = await db.getOne('SELECT * FROM employes WHERE id = ?', [id])
    res.status(201).json(emp)
  } catch (err) {
    console.error('[AGEO] employes POST:', err.message)
    res.status(500).json({ error: "Erreur lors de la création de l'employé" })
  }
})

// PUT /api/employes/:id
router.put('/:id', async (req, res) => {
  const { nom, prenom, poste, departement, telephone, email, date_embauche, salaire, actif } = req.body || {}
  try {
    await db.run(
      `UPDATE employes
          SET nom = ?, prenom = ?, poste = ?, departement = ?, telephone = ?,
              email = ?, date_embauche = ?, salaire = ?, actif = ?, updated_at = NOW()
        WHERE id = ?`,
      [nom, prenom || null, poste || null, departement || null, telephone || null,
       email || null, date_embauche || null, Number(salaire) || 0,
       actif == null ? 1 : actif, req.params.id],
    )
    await log(req, { module: 'Personnel', action: 'Modification', description: `Employé modifié : ${nom}` })
    const emp = await db.getOne('SELECT * FROM employes WHERE id = ?', [req.params.id])
    res.json(emp)
  } catch (err) {
    console.error('[AGEO] employes PUT:', err.message)
    res.status(500).json({ error: 'Erreur lors de la mise à jour' })
  }
})

// DELETE /api/employes/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id
    // Delete related records that lack ON DELETE CASCADE
    await db.run('DELETE FROM bulletins_paie WHERE employe_id = ?', [id])
    // conges and documents_employes have ON DELETE CASCADE, but delete explicitly to be safe
    await db.run('DELETE FROM conges WHERE employe_id = ?', [id])
    await db.run('DELETE FROM documents_employes WHERE employe_id = ?', [id])
    await db.run('DELETE FROM employes WHERE id = ?', [id])
    await log(req, { module: 'Personnel', action: 'Suppression', description: `Employé #${id} supprimé` })
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] employes DELETE:', err.message)
    // Last resort: deactivate
    try {
      await db.run('UPDATE employes SET actif = 0 WHERE id = ?', [req.params.id])
      res.json({ ok: true, desactive: true })
    } catch {
      res.status(500).json({ error: 'Erreur lors de la suppression' })
    }
  }
})

module.exports = router
