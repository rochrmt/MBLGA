'use strict'
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const { JWT_SECRET, JWT_EXPIRES } = require('../config')
const { log } = require('../utils/journal')
const { verify } = require('../utils/licence')

const router = express.Router()

function parsePermissions(raw) {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : null
  } catch {
    return null
  }
}

function publicUser(u) {
  const isAdmin = u.role === 'admin' || u.role === 'super_admin'
  return {
    id:          u.id,
    username:    u.username,
    email:       u.email,
    nom:         u.nom,
    role:        u.role,
    poste:       u.poste || null,
    permissions: isAdmin ? null : parsePermissions(u.permissions), // null = accès complet
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' })
  }

  try {
    const id = email.trim().toLowerCase()
    const user = await db.getOne(
      'SELECT * FROM users WHERE (email = ? OR LOWER(username) = ?) AND actif = 1',
      [id, id],
    )
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Identifiants ou mot de passe incorrect' })
    }

    // Check licence: block non-super_admin users when licence is expired
    if (user.role !== 'super_admin') {
      let dbKey = null
      try {
        const row = await db.getOne("SELECT valeur FROM parametres WHERE cle = 'licence_key'")
        dbKey = row?.valeur || null
      } catch {}
      const key = dbKey || process.env.LICENCE_KEY || ''
      const licenceResult = verify(key)
      if (!licenceResult.valid) {
        return res.status(402).json({
          error: 'Licence expirée ou invalide. Contactez le super administrateur.',
          reason: licenceResult.reason,
          expired: licenceResult.expired ?? false,
        })
      }
    }

    await db.run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])

    const payload = publicUser(user)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    await log({ user: payload, headers: req.headers, socket: req.socket }, {
      module: 'Authentification',
      action: 'Connexion',
      description: `Connexion : ${user.nom}`,
    })

    res.json({ token, user: payload })
  } catch (err) {
    console.error('[AGEO] Erreur login:', err.message)
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' })
  }
})

module.exports = router
