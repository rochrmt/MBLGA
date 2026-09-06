'use strict'
const crypto = require('crypto')

/*
 * Système de licence signé — propre à cette installation.
 * Format d'une clé :  base64url(JSON payload) + "." + HMAC-SHA256(payload, LICENCE_SECRET) en hex
 *
 * Le secret est lu depuis la variable d'environnement LICENCE_SECRET.
 * Générez vos propres clés avec :  node scripts/generate-licence.js
 *
 * Si aucune LICENCE_KEY n'est fournie, l'application démarre en "mode interne"
 * (licence locale valide) afin de rester utilisable ; fournissez une vraie clé
 * signée pour activer le contrôle strict.
 */

const SECRET = process.env.LICENCE_SECRET || 'changez-ce-secret-de-licence-par-une-chaine-aleatoire'

function sign(payloadB64) {
  return crypto.createHmac('sha256', SECRET).update(payloadB64).digest('hex')
}

function encode(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

function decode(payloadB64) {
  return JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'))
}

// Génère une clé de licence signée à partir d'un payload
function generate(payload) {
  const body = {
    entreprise: payload.entreprise ?? '',
    expiration: payload.expiration,                         // 'YYYY-MM-DD'
    max_users:  payload.max_users ?? null,
    modules:    payload.modules ?? ['all'],
    issued_at:  payload.issued_at ?? new Date().toISOString().slice(0, 10),
  }
  const b64 = encode(body)
  return `${b64}.${sign(b64)}`
}

function daysBetween(from, to) {
  const ms = to.getTime() - from.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

// Licence interne par défaut (aucune clé fournie) — garde l'app utilisable
function internalLicence() {
  const exp = new Date()
  exp.setFullYear(exp.getFullYear() + 1)
  const payload = {
    entreprise: '',
    expiration: exp.toISOString().slice(0, 10),
    max_users:  null,
    modules:    ['all'],
    issued_at:  new Date().toISOString().slice(0, 10),
  }
  return {
    valid:    true,
    expired:  false,
    reason:   'Mode interne (aucune clé de licence configurée)',
    payload,
    daysLeft: daysBetween(new Date(), exp),
  }
}

// Vérifie une clé de licence
function verify(key) {
  if (!key || !key.trim()) {
    return internalLicence()
  }

  const parts = key.trim().split('.')
  if (parts.length !== 2) {
    return { valid: false, reason: 'Format de licence invalide', expired: false }
  }

  const [b64, sig] = parts
  const expected = sign(b64)

  // Comparaison à temps constant
  const sigBuf = Buffer.from(sig, 'hex')
  const expBuf = Buffer.from(expected, 'hex')
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'Signature de licence invalide', expired: false }
  }

  let payload
  try {
    payload = decode(b64)
  } catch {
    return { valid: false, reason: 'Contenu de licence illisible', expired: false }
  }

  const now = new Date()
  const exp = new Date(`${payload.expiration}T23:59:59`)
  if (isNaN(exp.getTime())) {
    return { valid: false, reason: "Date d'expiration invalide", expired: false, payload }
  }

  if (now > exp) {
    return {
      valid:    false,
      expired:  true,
      reason:   `Licence expirée le ${payload.expiration}`,
      payload,
      daysLeft: 0,
    }
  }

  return {
    valid:    true,
    expired:  false,
    reason:   null,
    payload,
    daysLeft: daysBetween(now, exp),
  }
}

module.exports = { verify, generate, sign, encode, decode }
