// ============================================================
//  Sauvegarde automatique de la base MySQL (ageo)
//  Usage : node scripts/backup-db.js
//  Nécessite mysqldump dans le PATH
// ============================================================

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

// ── Configuration ──────────────────────────────────────────
const dbConfig = {
  host: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'ageo',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
}

// Dossier de sauvegarde (modifiable)
const backupDir = 'C:\\Backups'

// Nombre de jours de rétention (les .sql plus anciens sont supprimés)
const retentionDays = 30

// ── Exécution ──────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
    console.log(`Dossier créé : ${backupDir}`)
  }

  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
  const fileName = `${dbConfig.database}_${dateStr}.sql`
  const fullPath = path.join(backupDir, fileName)

  console.log(`Sauvegarde de '${dbConfig.database}' en cours...`)

  const cmd = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user}${dbConfig.password ? ` -p${dbConfig.password}` : ''} --single-transaction --routines --triggers ${dbConfig.database} > "${fullPath}"`
  execSync(cmd, { stdio: 'inherit' })

  if (fs.existsSync(fullPath)) {
    const sizeMB = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2)
    console.log(`Sauvegarde OK : ${fullPath} (${sizeMB} MB)`)
  } else {
    console.log("ERREUR : le fichier de sauvegarde n'a pas été créé")
    process.exit(1)
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const files = fs.readdirSync(backupDir).filter((f) => f.startsWith(`${dbConfig.database}_`) && f.endsWith('.sql'))
  for (const f of files) {
    const filePath = path.join(backupDir, f)
    if (fs.statSync(filePath).mtimeMs < cutoff) {
      fs.unlinkSync(filePath)
      console.log(`Ancienne sauvegarde supprimée : ${f}`)
    }
  }

  console.log('Terminé.')
}

main().catch((err) => {
  console.error('ERREUR :', err.message)
  process.exit(1)
})
