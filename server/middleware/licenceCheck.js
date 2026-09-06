'use strict'
const { verify } = require('../utils/licence')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')

// Cache the licence key from DB to avoid querying on every request
let cachedLicenceKey = null
let cacheExpiry = 0
const CACHE_TTL = 10000 // 10 seconds

async function getDbLicenceKey() {
  const now = Date.now()
  if (now < cacheExpiry) return cachedLicenceKey
  try {
    const db = require('../db/database')
    const row = await db.getOne("SELECT valeur FROM parametres WHERE cle = 'licence_key'")
    cachedLicenceKey = row?.valeur || null
    cacheExpiry = now + CACHE_TTL
  } catch {
    cachedLicenceKey = null
  }
  return cachedLicenceKey
}

function extractUser(req) {
  const header = req.headers['authorization']
  if (!header?.startsWith('Bearer ')) return null
  try {
    return jwt.verify(header.slice(7), JWT_SECRET)
  } catch {
    return null
  }
}

module.exports = async function licenceCheck(req, res, next) {
  // Try DB licence first, then fall back to .env
  const dbKey = await getDbLicenceKey()
  const key = dbKey || process.env.LICENCE_KEY || ''
  const result = verify(key)

  if (result.valid) {
    req.licence = result
    return next()
  }

  // Licence is invalid/expired — check if the user is super_admin
  const user = extractUser(req)
  if (user && user.role === 'super_admin') {
    // Super admin can still access everything even with expired licence
    req.licence = result
    return next()
  }

  // For everyone else, block access
  return res.status(402).json({
    error:   'Licence invalide ou expirée',
    reason:  result.reason,
    expired: result.expired ?? false,
  })
}

module.exports.invalidateCache = function() {
  cachedLicenceKey = null
  cacheExpiry = 0
}
