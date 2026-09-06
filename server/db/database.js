'use strict'
require('dotenv').config()
const mysql = require('mysql2/promise')

const config = {
  host:     process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME     || 'ageo',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
}

let pool = null

async function getPool() {
  if (!pool) {
    const MAX = 6
    for (let i = 1; i <= MAX; i++) {
      try {
        pool = mysql.createPool(config)
        await pool.query('SELECT 1')
        console.log('[AGEO] Connexion MySQL établie')
        return pool
      } catch (err) {
        if (i === MAX) throw err
        console.warn(`[AGEO] MySQL pas encore prêt (${i}/${MAX}), nouvelle tentative dans 5s...`)
        await new Promise(r => setTimeout(r, 5000))
      }
    }
  }
  return pool
}

const db = {
  async getOne(sqlStr, values = []) {
    const p = await getPool()
    const [rows] = await p.query(sqlStr, values)
    return rows[0] ?? null
  },

  async getAll(sqlStr, values = []) {
    const p = await getPool()
    const [rows] = await p.query(sqlStr, values)
    return rows
  },

  async run(sqlStr, values = []) {
    const p = await getPool()
    const [result] = await p.query(sqlStr, values)
    return { rowsAffected: result.affectedRows ?? 0 }
  },

  async insert(sqlStr, values = []) {
    const p = await getPool()
    const [result] = await p.query(sqlStr, values)
    return result.insertId ?? null
  },

  async exec(sqlStr) {
    const p = await getPool()
    const statements = sqlStr.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      await p.query(stmt)
    }
  },

  async transaction(fn) {
    const p = await getPool()
    const conn = await p.getConnection()
    await conn.beginTransaction()
    const tq = {
      async getOne(sqlStr, values = []) {
        const [rows] = await conn.query(sqlStr, values)
        return rows[0] ?? null
      },
      async getAll(sqlStr, values = []) {
        const [rows] = await conn.query(sqlStr, values)
        return rows
      },
      async run(sqlStr, values = []) {
        const [result] = await conn.query(sqlStr, values)
        return { rowsAffected: result.affectedRows ?? 0 }
      },
      async insert(sqlStr, values = []) {
        const [result] = await conn.query(sqlStr, values)
        return result.insertId ?? null
      },
    }
    try {
      const result = await fn(tq)
      await conn.commit()
      conn.release()
      return result
    } catch (err) {
      await conn.rollback()
      conn.release()
      throw err
    }
  },

  mysql,
}

module.exports = db
