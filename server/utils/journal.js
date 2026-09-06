'use strict'
const db = require('../db/database')

/*
 * Enregistre une action dans le journal d'activité.
 * Ne jette jamais d'erreur (le logging ne doit pas casser une requête métier).
 */
async function log(req, { module, action, description = null, details = null }) {
  try {
    const user = req?.user || {}
    const ip =
      (req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
      req?.socket?.remoteAddress ||
      null

    await db.run(
      `INSERT INTO journal_activites
         (utilisateur_id, utilisateur_nom, module, action, description, details, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id ?? null,
        user.nom ?? user.email ?? null,
        module,
        action,
        description,
        details ? JSON.stringify(details) : null,
        ip,
      ],
    )
  } catch (err) {
    console.warn('[AGEO] Journal: échec du log —', err.message)
  }
}

module.exports = { log }
