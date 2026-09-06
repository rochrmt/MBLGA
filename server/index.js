'use strict'
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')

const db = require('./db/setup')

const licenceCheck        = require('./middleware/licenceCheck')
const { verify: verifyLicence, generate: generateLicence } = require('./utils/licence')
const requireAuth      = require('./middleware/auth')
const authRoutes       = require('./routes/auth')
const dashboardRoutes  = require('./routes/dashboard')
const clientsRoutes    = require('./routes/clients')
const contratsRoutes   = require('./routes/contrats')
const produitsRoutes   = require('./routes/produits')
const commandesRoutes  = require('./routes/commandes')
const ventesRoutes     = require('./routes/ventes')
const rapportsRoutes   = require('./routes/rapports')
const parametresRoutes = require('./routes/parametres')
const searchRoutes     = require('./routes/search')
const caisseRoutes     = require('./routes/caisse')
const facturationRoutes   = require('./routes/facturation')
const notificationsRoutes = require('./routes/notifications')
const employesRoutes      = require('./routes/employes')
const departementsRoutes  = require('./routes/departements')
const congesRoutes        = require('./routes/conges')
const paieRoutes          = require('./routes/paie')
const documentsRoutes     = require('./routes/documents')
const journalRoutes       = require('./routes/journal')
const rapportsEmployesRoutes = require('./routes/rapports-employes')

const app         = express()
const PORT        = process.env.PORT || 3001
const CLIENT_DIST = path.join(__dirname, '../client/dist')

app.use(cors())
app.use(express.json({ limit: '15mb' }))
app.use(express.urlencoded({ limit: '15mb', extended: true }))

// Auth (public — no token required)
app.use('/api/auth', authRoutes)

// Licence info (public — toujours accessible même si licence expirée)
app.get('/api/licence/info', async (_, res) => {
  let dbKey = null
  try {
    const database = require('./db/database')
    const row = await database.getOne("SELECT valeur FROM parametres WHERE cle = 'licence_key'")
    dbKey = row?.valeur || null
  } catch {}
  const key = dbKey || process.env.LICENCE_KEY || ''
  const result = verifyLicence(key)
  res.json({
    valid:          result.valid,
    expired:        result.expired ?? false,
    reason:         result.reason  ?? null,
    entreprise:     result.payload?.entreprise  ?? null,
    expiration:     result.payload?.expiration  ?? null,
    jours_restants: result.daysLeft             ?? null,
    max_users:      result.payload?.max_users   ?? null,
    modules:        result.payload?.modules     ?? null,
    issued_at:      result.payload?.issued_at   ?? null,
  })
})

// Vérification de licence pour toutes les routes protégées
app.use('/api', licenceCheck)

// All routes below require a valid JWT
app.use('/api', requireAuth)

// Generate a licence key (super_admin only)
app.post('/api/licence/generate', (req, res) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Accès réservé au super administrateur' })
  }
  const { entreprise, expiration, max_users, modules } = req.body || {}
  if (!entreprise || !expiration) {
    return res.status(400).json({ error: 'Entreprise et expiration sont requises' })
  }
  try {
    const key = generateLicence({
      entreprise,
      expiration,
      max_users: max_users || null,
      modules: modules || ['all'],
    })
    res.json({ key })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la génération de la licence' })
  }
})

// Apply a licence key to this installation (super_admin only) — stores in DB
app.post('/api/licence/apply', async (req, res) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Accès réservé au super administrateur' })
  }
  try {
    const { entreprise, expiration, max_users, modules } = req.body || {}
    if (!expiration) {
      return res.status(400).json({ error: 'La date d\'expiration est requise' })
    }
    // Generate the licence key
    const key = generateLicence({
      entreprise: entreprise || req.user.nom || 'Entreprise',
      expiration,
      max_users: max_users || null,
      modules: modules || ['all'],
    })
    // Store in DB
    const database = require('./db/database')
    const exists = await database.getOne("SELECT 1 AS f FROM parametres WHERE cle = 'licence_key'")
    if (exists) {
      await database.run("UPDATE parametres SET valeur = ? WHERE cle = 'licence_key'", [key])
    } else {
      await database.run("INSERT INTO parametres (cle, valeur) VALUES ('licence_key', ?)", [key])
    }
    // Invalidate cache
    const licenceCheck = require('./middleware/licenceCheck')
    if (licenceCheck.invalidateCache) licenceCheck.invalidateCache()

    const result = verifyLicence(key)
    await require('./utils/journal').log(req, {
      module: 'Licence',
      action: 'Application',
      description: `Licence appliquée : ${entreprise || 'Entreprise'} — expire le ${expiration}`,
    })
    res.json({
      ok: true,
      valid: result.valid,
      expired: result.expired ?? false,
      expiration: result.payload?.expiration,
      jours_restants: result.daysLeft,
    })
  } catch (err) {
    console.error('[AGEO] licence/apply:', err.message)
    res.status(500).json({ error: 'Erreur lors de l\'application de la licence' })
  }
})

// Remove licence (super_admin only) — reverts to internal mode
app.delete('/api/licence/apply', async (req, res) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Accès réservé au super administrateur' })
  }
  try {
    const database = require('./db/database')
    await database.run("DELETE FROM parametres WHERE cle = 'licence_key'")
    const licenceCheck = require('./middleware/licenceCheck')
    if (licenceCheck.invalidateCache) licenceCheck.invalidateCache()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur' })
  }
})

app.use('/api/dashboard',     dashboardRoutes)
app.use('/api/clients',       clientsRoutes)
app.use('/api/contrats',      contratsRoutes)
app.use('/api/produits',      produitsRoutes)
app.use('/api/commandes',     commandesRoutes)
app.use('/api/ventes',        ventesRoutes)
app.use('/api/rapports',      rapportsRoutes)
app.use('/api/parametres',    parametresRoutes)
app.use('/api/search',        searchRoutes)
app.use('/api/caisse',        caisseRoutes)
app.use('/api/facturation',   facturationRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/employes',      employesRoutes)
app.use('/api/employes',      documentsRoutes)
app.use('/api/departements', departementsRoutes)
app.use('/api/conges',       congesRoutes)
app.use('/api/paie',         paieRoutes)
app.use('/api/journal',      journalRoutes)
app.use('/api/rapports-employes', rapportsEmployesRoutes)
app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '1.0.0', db: 'MySQL' }))

// Serve built React app
app.use(express.static(CLIENT_DIST))
app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next()
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.sendFile(path.join(CLIENT_DIST, 'index.html'))
})

async function start() {
  try {
    // Vérification de la licence au démarrage
    const lic = verifyLicence(process.env.LICENCE_KEY ?? '')
    if (!lic.valid) {
      console.warn(`[AGEO] ⚠️  LICENCE : ${lic.reason}`)
    } else {
      const warn = lic.daysLeft <= 30 ? ` — ⚠️  expire dans ${lic.daysLeft} jour(s) !` : ''
      console.log(`[AGEO] ✅ Licence valide — ${lic.payload.entreprise} (expire le ${lic.payload.expiration}${warn})`)
    }

    await db.initialize()
    app.listen(PORT, () => {
      if (fs.existsSync(CLIENT_DIST)) {
        console.log(`[AGEO] Application disponible sur http://localhost:${PORT}`)
      } else {
        console.log(`[AGEO] API démarrée sur http://localhost:${PORT}`)
        console.log(`[AGEO] Pour l'interface : cd client && npm run dev  → http://localhost:3000`)
      }
    })
  } catch (err) {
    console.error('[AGEO] Impossible de démarrer — erreur base de données:', err.message)
    process.exit(1)
  }
}

start()
