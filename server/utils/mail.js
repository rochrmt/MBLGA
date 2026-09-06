'use strict'
require('dotenv').config()
const nodemailer = require('nodemailer')

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  if (!host || !user || !pass) return null

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: parseInt(process.env.SMTP_PORT || '587') === 465,
    auth: { user, pass },
  })
  return transporter
}

/**
 * Envoie un email.
 * @param {string} to - adresse destinataire
 * @param {string} subject - sujet
 * @param {string} html - corps HTML
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function sendMail(to, subject, html) {
  const t = getTransporter()
  if (!t) {
    return { ok: false, error: 'SMTP non configuré. Vérifiez SMTP_HOST, SMTP_USER, SMTP_PASSWORD dans .env' }
  }
  if (!to) {
    return { ok: false, error: 'Aucune adresse email destinataire' }
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to, subject, html,
    })
    return { ok: true }
  } catch (err) {
    console.error('[AGEO] sendMail:', err.message)
    return { ok: false, error: err.message }
  }
}

module.exports = { sendMail }
