'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

// GET /api/caisse/session/active
router.get('/session/active', async (_req, res) => {
  try {
    const session = await db.getOne(
      "SELECT * FROM sessions_caisse WHERE statut = 'ouverte' ORDER BY id DESC LIMIT 1",
    )
    if (!session) return res.json({ session: null })
    const trs = await db.getAll(
      'SELECT * FROM transactions_caisse WHERE session_id = ? ORDER BY id DESC',
      [session.id],
    )
    const total = trs.reduce((s, t) => s + (t.type === 'retrait' ? -t.montant : t.montant), 0)
    res.json({ session, transactions: trs, total })
  } catch (err) {
    console.error('[AGEO] caisse active:', err.message)
    res.status(500).json({ error: 'Erreur caisse' })
  }
})

// GET /api/caisse/sessions?date=YYYY-MM-DD
router.get('/sessions', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10)
  try {
    const rows = await db.getAll(
      `SELECT s.*,
              (SELECT IFNULL(SUM(CASE WHEN t.type = 'retrait' THEN -t.montant ELSE t.montant END), 0)
                 FROM transactions_caisse t WHERE t.session_id = s.id) AS total_transactions
         FROM sessions_caisse s
        WHERE CAST(s.date_ouverture AS DATE) = ?
        ORDER BY s.id DESC`,
      [date],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des sessions' })
  }
})

// POST /api/caisse/open
router.post('/open', async (req, res) => {
  const { montant_ouverture, notes } = req.body || {}
  try {
    const open = await db.getOne("SELECT id FROM sessions_caisse WHERE statut = 'ouverte'")
    if (open) return res.status(400).json({ error: 'Une session de caisse est déjà ouverte' })

    const id = await db.insert(
      `INSERT INTO sessions_caisse (montant_ouverture, notes, statut)
       VALUES (?, ?, 'ouverte')`,
      [Number(montant_ouverture) || 0, notes || null],
    )
    await log(req, { module: 'Caisse', action: 'Ouverture', description: 'Ouverture de caisse' })
    res.status(201).json({ id })
  } catch (err) {
    console.error('[AGEO] caisse open:', err.message)
    res.status(500).json({ error: "Erreur lors de l'ouverture de la caisse" })
  }
})

// POST /api/caisse/close
router.post('/close', async (req, res) => {
  const { montant_fermeture, notes } = req.body || {}
  try {
    const session = await db.getOne("SELECT * FROM sessions_caisse WHERE statut = 'ouverte'")
    if (!session) return res.status(400).json({ error: 'Aucune session ouverte' })

    await db.run(
      `UPDATE sessions_caisse
          SET statut = 'fermee', date_fermeture = NOW(),
              montant_fermeture = ?, notes = COALESCE(?, notes)
        WHERE id = ?`,
      [montant_fermeture == null ? null : Number(montant_fermeture), notes || null, session.id],
    )
    await log(req, { module: 'Caisse', action: 'Fermeture', description: 'Fermeture de caisse' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] caisse close:', err.message)
    res.status(500).json({ error: 'Erreur lors de la fermeture de la caisse' })
  }
})

// POST /api/caisse/transaction
router.post('/transaction', async (req, res) => {
  const { montant, mode_paiement, reference, notes, produits, type, facture_id, commande_id } = req.body || {}
  try {
    const session = await db.getOne("SELECT id FROM sessions_caisse WHERE statut = 'ouverte'")
    if (!session) return res.status(400).json({ error: 'Ouvrez une session de caisse' })

    const id = await db.insert(
      `INSERT INTO transactions_caisse
         (session_id, montant, mode_paiement, reference, notes, produits, type, facture_id, commande_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.id, Number(montant) || 0, mode_paiement || 'especes',
       reference || null, notes || null,
       produits ? JSON.stringify(produits) : null,
       type || 'encaissement', facture_id || null, commande_id || null],
    )
    await log(req, { module: 'Caisse', action: 'Transaction', description: `Encaissement ${montant}` })
    res.status(201).json({ id })
  } catch (err) {
    console.error('[AGEO] caisse transaction:', err.message)
    res.status(500).json({ error: "Erreur lors de l'enregistrement de la transaction" })
  }
})

// POST /api/caisse/encaisser-commande/:id — encaisse une commande livrée impayée
router.post('/encaisser-commande/:id', async (req, res) => {
  const { mode_paiement, notes } = req.body || {}
  try {
    const session = await db.getOne("SELECT id FROM sessions_caisse WHERE statut = 'ouverte'")
    if (!session) return res.status(400).json({ error: 'Ouvrez une session de caisse' })

    const cmd = await db.getOne(
      `SELECT cmd.*, c.nom AS client_nom,
              (SELECT IFNULL(SUM(lc.quantite * lc.prix_unitaire * (1 - lc.remise / 100.0)), 0)
                 FROM lignes_commande lc WHERE lc.commande_id = cmd.id) AS montant_ht
         FROM commandes cmd
         LEFT JOIN clients c ON c.id = cmd.client_id
        WHERE cmd.id = ?`,
      [req.params.id],
    )
    if (!cmd) return res.status(404).json({ error: 'Commande introuvable' })
    if (cmd.statut !== 'livree') return res.status(400).json({ error: 'La commande doit être livrée' })

    const lignes = await db.getAll(
      `SELECT lc.*, p.nom AS produit_nom
         FROM lignes_commande lc
         LEFT JOIN produits p ON p.id = lc.produit_id
        WHERE lc.commande_id = ?`,
      [req.params.id],
    )

    const montant = cmd.montant_ht
    const produits = lignes.map((l) => ({
      nom: l.produit_nom || 'Article',
      quantite: l.quantite,
      prix: l.prix_unitaire * (1 - (l.remise || 0) / 100),
    }))

    const trId = await db.transaction(async (tq) => {
      // 1. Enregistrer la transaction de caisse
      const id = await tq.insert(
        `INSERT INTO transactions_caisse
           (session_id, montant, mode_paiement, notes, produits, type, commande_id)
         VALUES (?, ?, ?, ?, ?, 'encaissement', ?)`,
        [session.id, montant, mode_paiement || 'especes',
         notes || `Encaissement commande ${cmd.numero}`, JSON.stringify(produits), cmd.id],
      )
      // 2. Marquer la commande comme payée
      await tq.run(
        "UPDATE commandes SET statut_paiement = 'payee' WHERE id = ?",
        [cmd.id],
      )
      return id
    })

    await log(req, { module: 'Caisse', action: 'Encaissement commande', description: `Commande ${cmd.numero} encaissée (${montant})` })
    res.status(201).json({ id: trId, montant, numero: cmd.numero })
  } catch (err) {
    console.error('[AGEO] caisse encaisser-commande:', err.message, err.stack)
    res.status(500).json({ error: err.message || "Erreur lors de l'encaissement de la commande" })
  }
})

// GET /api/caisse/etat — état de caisse de la session active
router.get('/etat', async (_req, res) => {
  try {
    const session = await db.getOne(
      "SELECT * FROM sessions_caisse WHERE statut = 'ouverte' ORDER BY id DESC LIMIT 1",
    )
    if (!session) return res.json({ session: null })

    const trs = await db.getAll(
      'SELECT * FROM transactions_caisse WHERE session_id = ? ORDER BY id DESC',
      [session.id],
    )

    const encaissements = trs.filter((t) => t.type === 'encaissement')
    const retraits = trs.filter((t) => t.type === 'retrait')

    const parMode = {}
    for (const t of encaissements) {
      const mode = t.mode_paiement || 'especes'
      if (!parMode[mode]) parMode[mode] = 0
      parMode[mode] += t.montant
    }

    const totalEncaissements = encaissements.reduce((s, t) => s + t.montant, 0)
    const totalRetraits = retraits.reduce((s, t) => s + t.montant, 0)
    const solde = (session.montant_ouverture || 0) + totalEncaissements - totalRetraits

    res.json({
      session,
      total_encaissements: totalEncaissements,
      total_retraits: totalRetraits,
      solde,
      par_mode: parMode,
      nb_transactions: trs.length,
      transactions: trs,
    })
  } catch (err) {
    console.error('[AGEO] caisse etat:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement de l\'état de caisse' })
  }
})

// ── Petite Caisse ─────────────────────────────────────────────────────────────

// GET /api/caisse/petite-caisse
router.get('/petite-caisse', async (_req, res) => {
  try {
    const pc = await db.getOne('SELECT * FROM petite_caisse WHERE actif = 1')
    if (!pc) return res.json({ petite_caisse: null, transactions: [], total_depenses: 0, total_approvisionnements: 0 })
    const trs = await db.getAll(
      'SELECT * FROM transactions_petite_caisse WHERE petite_caisse_id = ? ORDER BY id DESC',
      [pc.id],
    )
    const totalDepenses = trs.filter(t => t.type === 'depense').reduce((s, t) => s + t.montant, 0)
    const totalAppro = trs.filter(t => t.type === 'approvisionnement').reduce((s, t) => s + t.montant, 0)
    res.json({ petite_caisse: pc, transactions: trs, total_depenses: totalDepenses, total_approvisionnements: totalAppro })
  } catch (err) {
    console.error('[AGEO] petite caisse get:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement de la petite caisse' })
  }
})

// POST /api/caisse/petite-caisse/approvisionner
router.post('/petite-caisse/approvisionner', async (req, res) => {
  const role = req.user?.role
  const poste = req.user?.poste
  const canAppro = ['admin', 'super_admin'].includes(role) || poste === 'comptable'
  if (!canAppro) return res.status(403).json({ error: 'Seuls les administrateurs et le comptable peuvent approvisionner la petite caisse' })

  const { montant, notes } = req.body || {}
  try {
    const pc = await db.getOne('SELECT * FROM petite_caisse WHERE actif = 1')
    if (!pc) return res.status(404).json({ error: 'Aucune petite caisse active' })

    const session = await db.getOne("SELECT id FROM sessions_caisse WHERE statut = 'ouverte'")
    if (!session) return res.status(400).json({ error: 'Ouvrez une session de caisse principale pour approvisionner la petite caisse' })

    const mnt = Number(montant) || 0
    if (mnt <= 0) return res.status(400).json({ error: 'Le montant doit être positif' })

    await db.transaction(async (tq) => {
      // 1. Retrait de la caisse principale
      await tq.run(
        `INSERT INTO transactions_caisse (session_id, montant, mode_paiement, type, notes)
         VALUES (?, ?, 'especes', 'retrait', ?)`,
        [session.id, mnt, `Approvisionnement petite caisse: ${notes || ''}`],
      )
      // 2. Ajout à la petite caisse
      await tq.run(
        `UPDATE petite_caisse SET solde = solde + ?, updated_at = NOW() WHERE id = ?`,
        [mnt, pc.id],
      )
      // 3. Enregistrer la transaction dans l'historique petite caisse
      await tq.insert(
        `INSERT INTO transactions_petite_caisse (petite_caisse_id, montant, type, categorie, reference, notes, session_caisse_id)
         VALUES (?, ?, 'approvisionnement', 'Approvisionnement', ?, ?, ?)`,
        [pc.id, mnt, `Caisse principale #${session.id}`, notes || null, session.id],
      )
    })

    await log(req, { module: 'Caisse', action: 'Approvisionnement petite caisse', description: `Approvisionnement de ${mnt} vers la petite caisse` })
    res.status(201).json({ ok: true })
  } catch (err) {
    console.error('[AGEO] petite caisse appro:', err.message)
    res.status(500).json({ error: "Erreur lors de l'approvisionnement" })
  }
})

// POST /api/caisse/petite-caisse/transaction
router.post('/petite-caisse/transaction', async (req, res) => {
  const { montant, type, categorie, beneficiaire, notes } = req.body || {}
  try {
    const pc = await db.getOne('SELECT * FROM petite_caisse WHERE actif = 1')
    if (!pc) return res.status(404).json({ error: 'Aucune petite caisse active' })

    const mnt = Number(montant) || 0
    if (mnt <= 0) return res.status(400).json({ error: 'Le montant doit être positif' })

    const trType = type || 'depense'
    if (trType === 'depense' && mnt > pc.solde) {
      return res.status(400).json({ error: 'Solde insuffisant dans la petite caisse' })
    }

    const id = await db.transaction(async (tq) => {
      const delta = trType === 'depense' ? -mnt : mnt
      await tq.run(
        `UPDATE petite_caisse SET solde = solde + ?, updated_at = NOW() WHERE id = ?`,
        [delta, pc.id],
      )
      return tq.insert(
        `INSERT INTO transactions_petite_caisse (petite_caisse_id, montant, type, categorie, beneficiaire, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pc.id, mnt, trType, categorie || null, beneficiaire || null, notes || null],
      )
    })

    await log(req, { module: 'Caisse', action: `Petite caisse - ${trType}`, description: `${trType === 'depense' ? 'Dépense' : 'Entrée'} de ${mnt} ${categorie ? '(' + categorie + ')' : ''}` })
    res.status(201).json({ id })
  } catch (err) {
    console.error('[AGEO] petite caisse transaction:', err.message)
    res.status(500).json({ error: "Erreur lors de l'enregistrement de la transaction" })
  }
})

// PUT /api/caisse/petite-caisse/plafond
router.put('/petite-caisse/plafond', async (req, res) => {
  const { plafond } = req.body || {}
  try {
    const pc = await db.getOne('SELECT * FROM petite_caisse WHERE actif = 1')
    if (!pc) return res.status(404).json({ error: 'Aucune petite caisse active' })
    await db.run('UPDATE petite_caisse SET plafond = ?, updated_at = NOW() WHERE id = ?', [Number(plafond) || 0, pc.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du plafond' })
  }
})

// DELETE /api/caisse/transaction/:id — supprime une transaction de la session active
router.delete('/transaction/:id', async (req, res) => {
  try {
    const tr = await db.getOne('SELECT * FROM transactions_caisse WHERE id = ?', [req.params.id])
    if (!tr) return res.status(404).json({ error: 'Transaction introuvable' })
    await db.run('DELETE FROM transactions_caisse WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] caisse transaction DELETE:', err.message)
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

// DELETE /api/caisse/petite-caisse/transaction/:id — supprime une transaction de petite caisse
router.delete('/petite-caisse/transaction/:id', async (req, res) => {
  try {
    const tr = await db.getOne('SELECT * FROM transactions_petite_caisse WHERE id = ?', [req.params.id])
    if (!tr) return res.status(404).json({ error: 'Transaction introuvable' })
    await db.run('DELETE FROM transactions_petite_caisse WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] petite caisse transaction DELETE:', err.message)
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

// GET /api/caisse/historique?from=YYYY-MM-DD&to=YYYY-MM-DD
// Retourne les transactions de la caisse principale et de la petite caisse sur une période
router.get('/historique', async (req, res) => {
  const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const to = req.query.to || new Date().toISOString().slice(0, 10)
  try {
    // ── Caisse principale ──
    const principales = await db.getAll(
      `SELECT t.id, t.date_transaction, t.montant, t.mode_paiement, t.type,
              t.notes, t.reference, t.session_id, s.montant_ouverture
         FROM transactions_caisse t
         LEFT JOIN sessions_caisse s ON s.id = t.session_id
        WHERE CAST(t.date_transaction AS DATE) BETWEEN ? AND ?
        ORDER BY t.date_transaction DESC`,
      [from, to],
    )
    const totalEnc = principales.filter(t => t.type !== 'retrait').reduce((s, t) => s + t.montant, 0)
    const totalRet = principales.filter(t => t.type === 'retrait').reduce((s, t) => s + t.montant, 0)

    // ── Petite caisse ──
    const petites = await db.getAll(
      `SELECT id, date_transaction, montant, type, categorie, beneficiaire,
              reference, notes
         FROM transactions_petite_caisse
        WHERE CAST(date_transaction AS DATE) BETWEEN ? AND ?
        ORDER BY date_transaction DESC`,
      [from, to],
    )
    const totalDep = petites.filter(t => t.type === 'depense').reduce((s, t) => s + t.montant, 0)
    const totalAppro = petites.filter(t => t.type === 'approvisionnement').reduce((s, t) => s + t.montant, 0)
    const totalEntree = petites.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)

    res.json({
      periode: { from, to },
      caisse_principale: {
        transactions: principales,
        total_encaissements: totalEnc,
        total_retraits: totalRet,
        solde: totalEnc - totalRet,
        nb: principales.length,
      },
      petite_caisse: {
        transactions: petites,
        total_depenses: totalDep,
        total_approvisionnements: totalAppro,
        total_entrees: totalEntree,
        solde: totalAppro + totalEntree - totalDep,
        nb: petites.length,
      },
    })
  } catch (err) {
    console.error('[AGEO] caisse historique:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement de l\'historique' })
  }
})

module.exports = router
