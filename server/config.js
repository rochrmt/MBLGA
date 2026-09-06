// Override JWT_SECRET via environment variable in production
module.exports = {
  JWT_SECRET:  process.env.JWT_SECRET  || 'ageo_jwt_secret_ombre_2026',
  JWT_EXPIRES: process.env.JWT_EXPIRES || '10h',
}
