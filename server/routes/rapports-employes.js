'use strict'
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'rapports-employes')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// GET /api/rapports-employes — admin: all reports | employee: own reports
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin'
    if (isAdmin) {
      const rows = await db.getAll(
        `SELECT * FROM rapports_employes ORDER BY date_upload DESC`,
      )
      res.json(rows)
    } else {
      const rows = await db.getAll(
        `SELECT * FROM rapports_employes WHERE user_id = ? ORDER BY date_upload DESC`,
        [req.user.id],
      )
      res.json(rows)
    }
  } catch (err) {
    console.error('[AGEO] rapports employes list:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des rapports' })
  }
})

// GET /api/rapports-employes/non-lus — admin only: count of unread reports
router.get('/non-lus', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin'
    if (!isAdmin) return res.json({ count: 0 })
    const { n } = await db.getOne('SELECT COUNT(*) AS n FROM rapports_employes WHERE lu_admin = 0')
    res.json({ count: n })
  } catch (err) {
    res.status(500).json({ error: 'Erreur' })
  }
})

// POST /api/rapports-employes/upload — employee uploads a report
router.post('/upload', upload.single('fichier'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' })
  const { titre, periode, description } = req.body || {}
  if (!titre) return res.status(400).json({ error: 'Le titre est requis' })

  try {
    const id = await db.insert(
      `INSERT INTO rapports_employes
         (user_id, employe_nom, titre, periode, description, nom_fichier, nom_original, type_mime, taille)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, req.user.nom || req.user.username,
       titre, periode || null, description || null,
       req.file.filename, req.file.originalname, req.file.mimetype, req.file.size],
    )
    await log(req, { module: 'Rapports', action: 'Upload rapport employé', description: `Rapport "${titre}" uploaded par ${req.user.nom}` })
    res.status(201).json({ id })
  } catch (err) {
    console.error('[AGEO] rapport employe upload:', err.message)
    if (req.file) {
      const fp = path.join(UPLOAD_DIR, req.file.filename)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    }
    res.status(500).json({ error: "Erreur lors de l'enregistrement du rapport" })
  }
})

// GET /api/rapports-employes/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const row = await db.getOne('SELECT * FROM rapports_employes WHERE id = ?', [req.params.id])
    if (!row) return res.status(404).json({ error: 'Rapport introuvable' })

    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin'
    if (!isAdmin && row.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' })
    }

    const filePath = path.join(UPLOAD_DIR, row.nom_fichier)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier manquant' })
    res.download(filePath, row.nom_original)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du téléchargement' })
  }
})

// PUT /api/rapports-employes/:id/lu — admin marks as read
router.put('/:id/lu', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin'
    if (!isAdmin) return res.status(403).json({ error: 'Accès refusé' })
    await db.run('UPDATE rapports_employes SET lu_admin = 1, date_lecture = NOW() WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur' })
  }
})

// DELETE /api/rapports-employes/:id — owner or admin can delete
router.delete('/:id', async (req, res) => {
  try {
    const row = await db.getOne('SELECT * FROM rapports_employes WHERE id = ?', [req.params.id])
    if (!row) return res.status(404).json({ error: 'Rapport introuvable' })

    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin'
    if (!isAdmin && row.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' })
    }

    const filePath = path.join(UPLOAD_DIR, row.nom_fichier)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    await db.run('DELETE FROM rapports_employes WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
