require('dotenv').config()
const mysql = require('mysql2/promise')

const config = {
  host: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'ageo',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
}

console.log('Tentative de connexion MySQL avec:')
console.log('  Host:', config.host)
console.log('  Port:', config.port)
console.log('  Database:', config.database)
console.log('  User:', config.user)
console.log('  Password:', config.password ? '*** (' + config.password.length + ' chars)' : '(vide)')

mysql.createConnection(config)
  .then(async (conn) => {
    console.log('\n✅ Connexion MySQL réussie !')
    const [rows] = await conn.query('SELECT VERSION() as version')
    console.log('Version MySQL:', rows[0].version)
    await conn.end()
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ Erreur de connexion:', err.message)
    console.error('Code:', err.code || 'N/A')
    process.exit(1)
  })
