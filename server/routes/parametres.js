'use strict'
const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

const isAdmin = (req) => ['admin', 'super_admin'].includes(req.user?.role)

// ── Réglages clé/valeur ──────────────────────────────────────────────────────

async function upsertSetting(cle, valeur) {
  const v = valeur == null ? null : String(valeur)
  const exists = await db.getOne('SELECT 1 AS f FROM parametres WHERE cle = ?', [cle])
  if (exists) await db.run('UPDATE parametres SET valeur = ? WHERE cle = ?', [v, cle])
  else await db.run('INSERT INTO parametres (cle, valeur) VALUES (?, ?)', [cle, v])
}

// GET /api/parametres
router.get('/', async (_req, res) => {
  try {
    const rows = await db.getAll('SELECT cle, valeur FROM parametres')
    const obj = {}
    for (const r of rows) obj[r.cle] = r.valeur
    res.json(obj)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des paramètres' })
  }
})

// PUT /api/parametres  (objet clé/valeur)
router.put('/', async (req, res) => {
  try {
    const entries = Object.entries(req.body || {})
    for (const [cle, valeur] of entries) await upsertSetting(cle, valeur)
    await log(req, { module: 'Paramètres', action: 'Modification', description: 'Paramètres mis à jour' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] parametres PUT:', err.message)
    res.status(500).json({ error: "Erreur lors de l'enregistrement des paramètres" })
  }
})

// ── Catégories de produits ───────────────────────────────────────────────────

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

router.post('/categories', async (req, res) => {
  const { nom } = req.body || {}
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'Nom obligatoire' })
  try {
    const id = await db.insert('INSERT INTO categories (nom) VALUES (?)', [nom.trim()])
    res.status(201).json({ id, nom: nom.trim() })
  } catch (err) {
    res.status(400).json({ error: 'Cette catégorie existe déjà' })
  }
})

router.put('/categories/:id', async (req, res) => {
  const { nom } = req.body || {}
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'Nom obligatoire' })
  try {
    await db.run('UPDATE categories SET nom = ? WHERE id = ?', [nom.trim(), req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: 'Cette catégorie existe déjà' })
  }
})

router.delete('/categories/:id', async (req, res) => {
  try {
    await db.run('UPDATE produits SET categorie_id = NULL WHERE categorie_id = ?', [req.params.id])
    await db.run('DELETE FROM categories WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

// ── Utilisateurs (Sécurité) ──────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  try {
    const isSuperAdmin = req.user?.role === 'super_admin'
    // Hide original super_admin from everyone except itself
    // Hide all super_admin from non-super_admin users
    let query
    if (isSuperAdmin) {
      // Super admins see all except the original super_admin (unless they ARE the original)
      query = `SELECT id, username, email, nom, role, poste, actif, permissions, last_login, created_at FROM users WHERE (is_original = 0 OR id = ${parseInt(req.user.id)}) ORDER BY id`
    } else {
      query = `SELECT id, username, email, nom, role, poste, actif, permissions, last_login, created_at FROM users WHERE role != 'super_admin' ORDER BY id`
    }
    const rows = await db.getAll(query)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des utilisateurs' })
  }
})

router.post('/users', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  const { username, email, nom, password, role, poste, permissions } = req.body || {}
  if (!email || !nom || !password) {
    return res.status(400).json({ error: 'Email, nom et mot de passe obligatoires' })
  }
  // Only super_admin can create super_admin accounts
  if (role === 'super_admin' && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Rôle non autorisé' })
  }
  try {
    const hash = bcrypt.hashSync(password, 10)
    const perms = Array.isArray(permissions) ? JSON.stringify(permissions) : null
    const id = await db.insert(
      `INSERT INTO users (username, email, nom, password_hash, role, poste, permissions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username || email, email, nom, hash, role || 'user', poste || null, perms],
    )
    await log(req, { module: 'Utilisateurs', action: 'Création', description: `Utilisateur créé : ${nom}` })
    res.status(201).json({ id })
  } catch (err) {
    res.status(400).json({ error: 'Cet identifiant est déjà utilisé' })
  }
})

router.put('/users/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  const { username, nom, email, role, poste, permissions, actif, password } = req.body || {}
  try {
    const target = await db.getOne('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' })
    // Original super_admin is invisible to everyone except itself
    if (target.is_original && req.user?.id != target.id) {
      return res.status(404).json({ error: 'Utilisateur introuvable' })
    }
    // Non-super_admin cannot see or modify super_admin accounts
    if (target.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(404).json({ error: 'Utilisateur introuvable' })
    }
    // Original super_admin cannot be retrograded
    if (target.is_original && role && role !== 'super_admin') {
      return res.status(400).json({ error: 'Le super administrateur ne peut pas être rétrogradé' })
    }
    if (target.role === 'super_admin' && role && role !== 'super_admin') {
      return res.status(400).json({ error: 'Le super administrateur ne peut pas être rétrogradé' })
    }
    // Only super_admin can assign super_admin role
    if (role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Rôle non autorisé' })
    }

    const perms = Array.isArray(permissions) ? JSON.stringify(permissions) : target.permissions
    await db.run(
      `UPDATE users SET username = ?, nom = ?, email = ?, role = ?, poste = ?, permissions = ?, actif = ? WHERE id = ?`,
      [username || target.username, nom ?? target.nom, email ?? target.email, role ?? target.role, poste !== undefined ? (poste || null) : target.poste, perms,
       actif == null ? target.actif : actif, req.params.id],
    )
    if (password) {
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?',
        [bcrypt.hashSync(password, 10), req.params.id])
    }
    await log(req, { module: 'Utilisateurs', action: 'Modification', description: `Utilisateur modifié : ${nom || target.nom}` })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' })
  }
})

router.delete('/users/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  try {
    const target = await db.getOne('SELECT role, is_original FROM users WHERE id = ?', [req.params.id])
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' })
    // Original super_admin is invisible to everyone except itself
    if (target.is_original && req.user?.id != req.params.id) {
      return res.status(404).json({ error: 'Utilisateur introuvable' })
    }
    // Non-super_admin cannot see or delete super_admin accounts
    if (target.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(404).json({ error: 'Utilisateur introuvable' })
    }
    // No one can delete the original super_admin
    if (target.is_original) {
      return res.status(400).json({ error: 'Le super administrateur original ne peut pas être supprimé' })
    }
    // Only the original super_admin can delete other super_admins
    if (target.role === 'super_admin') {
      const requester = await db.getOne('SELECT is_original FROM users WHERE id = ?', [req.user.id])
      if (!requester?.is_original) {
        return res.status(400).json({ error: 'Seul le super administrateur original peut supprimer un super administrateur' })
      }
    }
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id])
    await log(req, { module: 'Utilisateurs', action: 'Suppression', description: `Utilisateur #${req.params.id} supprimé` })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

// POST /api/parametres/password  (changer SON mot de passe)
router.post('/password', async (req, res) => {
  const { ancien, nouveau } = req.body || {}
  if (!ancien || !nouveau) return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' })
  try {
    const user = await db.getOne('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user || !bcrypt.compareSync(ancien, user.password_hash)) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' })
    }
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?',
      [bcrypt.hashSync(nouveau, 10), req.user.id])
    await log(req, { module: 'Sécurité', action: 'Mot de passe', description: 'Mot de passe modifié' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' })
  }
})

// GET /api/parametres/database  (statistiques base de données)
router.get('/database', async (_req, res) => {
  try {
    const clients = await db.getOne('SELECT COUNT(*) AS total, SUM(CASE WHEN actif=1 THEN 1 ELSE 0 END) AS actifs FROM clients')
    const produits = await db.getOne('SELECT COUNT(*) AS total, SUM(CASE WHEN actif=1 THEN 1 ELSE 0 END) AS actifs FROM produits')
    const categories = await db.getOne('SELECT COUNT(*) AS n FROM categories')
    const commandes = await db.getOne("SELECT COUNT(*) AS total, SUM(CASE WHEN statut='livree' THEN 1 ELSE 0 END) AS livrees FROM commandes")
    const lignes = await db.getOne('SELECT IFNULL(SUM(quantite),0) AS n FROM lignes_commande')
    const ca = await db.getOne(
      `SELECT IFNULL(SUM(lc.quantite*lc.prix_unitaire*(1-lc.remise/100.0)),0) AS ca
         FROM lignes_commande lc JOIN commandes cmd ON cmd.id=lc.commande_id WHERE cmd.statut='livree'`,
    )
    const dates = await db.getOne('SELECT MIN(date_commande) AS premiere, MAX(date_commande) AS derniere FROM commandes')
    res.json({
      clients: { total: clients.total, actifs: clients.actifs || 0 },
      produits: { total: produits.total, actifs: produits.actifs || 0 },
      categories: categories.n,
      commandes: { total: commandes.total, livrees: commandes.livrees || 0 },
      lignes_commande: lignes.n,
      ca_livre: ca.ca,
      premiere_commande: dates.premiere,
      derniere_commande: dates.derniere,
    })
  } catch (err) {
    console.error('[AGEO] parametres database:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des statistiques' })
  }
})

// GET /api/parametres/backup  — export all data as JSON
router.get('/backup', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  try {
    const tables = [
      'categories', 'clients', 'produits', 'commandes', 'lignes_commande',
      'users', 'sessions_caisse', 'transactions_caisse',
      'factures', 'lignes_facture', 'contrats', 'contrats_paiements',
      'parametres', 'departements', 'employes', 'conges',
      'bulletins_paie', 'documents_employes', 'journal_activites',
      'petite_caisse', 'transactions_petite_caisse', 'rapports_employes',
    ]
    const dump = {}
    for (const t of tables) {
      try {
        if (t === 'users') {
          // Exclude super_admin accounts from export
          dump[t] = await db.getAll('SELECT * FROM `users` WHERE role != ?', ['super_admin'])
        } else {
          dump[t] = await db.getAll(`SELECT * FROM \`${t}\``)
        }
      } catch { dump[t] = [] }
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="sauvegarde_${ts}.bak"`)
    await log(req, { module: 'Base de données', action: 'Sauvegarde', description: 'Export des données' })
    res.json({ _meta: { app: 'ageo', version: '1.0.0', exported_at: new Date().toISOString(), table_count: tables.length }, data: dump })
  } catch (err) {
    console.error('[AGEO] backup:', err.message)
    res.status(500).json({ error: 'Erreur lors de la sauvegarde' })
  }
})

// POST /api/parametres/restore  — import JSON data
router.post('/restore', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  try {
    const payload = req.body
    if (!payload || !payload.data || typeof payload.data !== 'object') {
      return res.status(400).json({ error: 'Fichier de sauvegarde invalide' })
    }
    const dump = payload.data

    // Convert ISO date strings to MySQL datetime format
    function convertVal(v) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
        return v.replace('T', ' ').replace(/\.\d+Z$/, '').replace(/Z$/, '')
      }
      // Convert Date objects to MySQL format
      if (v instanceof Date) {
        return v.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
      }
      return v
    }

    // Order matters: parent tables first, then child tables
    const orderedTables = [
      'categories', 'departements', 'parametres', 'users',
      'clients', 'produits', 'employes',
      'commandes', 'lignes_commande',
      'sessions_caisse', 'transactions_caisse',
      'factures', 'lignes_facture',
      'contrats', 'contrats_paiements',
      'conges', 'bulletins_paie', 'documents_employes',
      'petite_caisse', 'transactions_petite_caisse',
      'rapports_employes', 'journal_activites',
    ]

    await db.transaction(async (tq) => {
      // Disable FK checks during restore
      await tq.run('SET FOREIGN_KEY_CHECKS = 0')

      for (const table of orderedTables) {
        if (!dump[table] || !Array.isArray(dump[table])) continue
        // Truncate existing data (preserve super_admin users)
        if (table === 'users') {
          await tq.run('DELETE FROM `users` WHERE role != ?', ['super_admin'])
        } else {
          await tq.run(`DELETE FROM \`${table}\``)
        }

        if (dump[table].length === 0) continue

        // Get column names from first row
        const cols = Object.keys(dump[table][0])
        if (cols.length === 0) continue

        // Insert in batches of 100
        const batch = 100
        for (let i = 0; i < dump[table].length; i += batch) {
          const slice = dump[table].slice(i, i + batch)
          const placeholders = slice.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ')
          const values = slice.flatMap(row => cols.map(c => convertVal(row[c] === undefined ? null : row[c])))
          await tq.run(
            `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES ${placeholders}`,
            values,
          )
        }
      }

      await tq.run('SET FOREIGN_KEY_CHECKS = 1')
    })

    await log(req, { module: 'Base de données', action: 'Restauration', description: 'Import des données' })
    res.json({ ok: true, message: 'Données restaurées avec succès' })
  } catch (err) {
    console.error('[AGEO] restore:', err.message)
    res.status(500).json({ error: 'Erreur lors de la restauration: ' + err.message })
  }
})

module.exports = router
