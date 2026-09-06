// ============================================================
//  Restauration de la base MySQL (ageo) depuis un .sql
//  Usage : node scripts/restore-db.js "C:\Backups\ageo_2026-07-31_1022.sql"
// ============================================================

const { execSync } = require('child_process')
const fs = require('fs')
require('dotenv').config()

// ── Configuration ──────────────────────────────────────────
const dbConfig = {
  host: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'ageo',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
}

// ── Exécution ──────────────────────────────────────────────
async function main() {
  const sqlFile = process.argv[2]
  if (!sqlFile) {
    console.log('Usage : node scripts/restore-db.js "C:\\Backups\\ageo_2026-07-31_1022.sql"')
    console.log('')
    console.log('Indiquez le chemin du fichier .sql à restaurer.')
    process.exit(1)
  }

  if (!fs.existsSync(sqlFile)) {
    console.log(`ERREUR : le fichier "${sqlFile}" n'existe pas`)
    process.exit(1)
  }

  const sizeMB = (fs.statSync(sqlFile).size / (1024 * 1024)).toFixed(2)
  console.log(`Fichier de sauvegarde : ${sqlFile} (${sizeMB} MB)`)

  console.log('')
  console.log(`⚠️  ATTENTION : toutes les données actuelles de "${dbConfig.database}" seront`)
  console.log('   remplacées par celles de la sauvegarde. Cette action est irréversible.')
  console.log('')

  console.log(`Restauration en cours...`)
  const cmd = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user}${dbConfig.password ? ` -p${dbConfig.password}` : ''} ${dbConfig.database} < "${sqlFile}"`
  execSync(cmd, { stdio: 'inherit' })

  console.log('')
  console.log(`✅ Restauration terminée : "${dbConfig.database}" restaurée depuis ${sqlFile}`)
}

main().catch((err) => {
  console.error('ERREUR :', err.message)
  process.exit(1)
})
