'use strict'
/*
 * Générateur de clés de licence.
 *
 * Usage :
 *   node scripts/generate-licence.js "Nom Entreprise" 2027-12-31 [max_users] [modules]
 *
 * Exemples :
 *   node scripts/generate-licence.js "Mon Entreprise" 2027-12-31
 *   node scripts/generate-licence.js "Mon Entreprise" 2027-12-31 10 all
 *
 * Le secret utilisé est LICENCE_SECRET (voir .env). Placez la clé générée
 * dans .env sous LICENCE_KEY=...
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { generate } = require('../utils/licence')

const [, , entreprise, expiration, maxUsers, modules] = process.argv

if (!entreprise || !expiration) {
  console.log('Usage : node scripts/generate-licence.js "Nom Entreprise" YYYY-MM-DD [max_users] [modules]')
  process.exit(1)
}

const key = generate({
  entreprise,
  expiration,
  max_users: maxUsers ? parseInt(maxUsers, 10) : null,
  modules:   modules ? modules.split(',').map((m) => m.trim()) : ['all'],
})

console.log('\nClé de licence générée :\n')
console.log(key)
console.log('\nAjoutez-la dans server/.env :\n')
console.log(`LICENCE_KEY=${key}\n`)
