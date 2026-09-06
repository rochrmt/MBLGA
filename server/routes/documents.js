'use strict'
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'employes')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// GET /api/employes/:id/documents
router.get('/:id/documents', async (req, res) => {
  try {
    const rows = await db.getAll(
      'SELECT * FROM documents_employes WHERE employe_id = ? ORDER BY created_at DESC',
      [req.params.id],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des documents' })
  }
})

// POST /api/employes/:id/documents
router.post('/:id/documents', upload.single('fichier'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' })
  try {
    const id = await db.insert(
      `INSERT INTO documents_employes
         (employe_id, nom_fichier, nom_original, type_mime, taille, categorie)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, req.file.filename, req.file.originalname,
       req.file.mimetype, req.file.size, req.body.categorie || 'autre'],
    )
    await log(req, { module: 'Personnel', action: 'Document', description: `Document ajouté (employé #${req.params.id})` })
    res.status(201).json({ id })
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de l'enregistrement du document" })
  }
})

// GET /api/employes/documents/:docId/download
router.get('/documents/:docId/download', async (req, res) => {
  try {
    const doc = await db.getOne('SELECT * FROM documents_employes WHERE id = ?', [req.params.docId])
    if (!doc) return res.status(404).json({ error: 'Document introuvable' })
    const filePath = path.join(UPLOAD_DIR, doc.nom_fichier)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier manquant' })
    res.download(filePath, doc.nom_original)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du téléchargement' })
  }
})

// DELETE /api/employes/documents/:docId
router.delete('/documents/:docId', async (req, res) => {
  try {
    const doc = await db.getOne('SELECT * FROM documents_employes WHERE id = ?', [req.params.docId])
    if (doc) {
      const filePath = path.join(UPLOAD_DIR, doc.nom_fichier)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      await db.run('DELETE FROM documents_employes WHERE id = ?', [req.params.docId])
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
