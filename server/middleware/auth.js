const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')

module.exports = function requireAuth(req, res, next) {
  const header = req.headers['authorization']
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' })
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' })
  }
}
