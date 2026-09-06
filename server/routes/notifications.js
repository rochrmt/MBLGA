'use strict'
const express = require('express')
const db = require('../db/database')
const { verify: verifyLicence } = require('../utils/licence')

const router = express.Router()

// GET /api/notifications
router.get('/', async (_req, res) => {
  try {
    const alerts = []

    const stockBas = await db.getAll(
      `SELECT id, nom, stock, stock_min FROM produits
        WHERE actif = 1 AND stock <= stock_min ORDER BY stock`,
    )
    for (const p of stockBas) {
      alerts.push({
        type: 'stock',
        niveau: p.stock === 0 ? 'danger' : 'warning',
        titre: 'Stock bas',
        message: `${p.nom} — ${p.stock} en stock (seuil ${p.stock_min})`,
        lien: '/produits',
      })
    }

    const enAttente = await db.getOne(
      "SELECT COUNT(*) AS n FROM commandes WHERE statut = 'en_attente'",
    )
    if (enAttente.n > 0) {
      alerts.push({
        type: 'commande',
        niveau: 'info',
        titre: 'Commandes en attente',
        message: `${enAttente.n} commande(s) en attente de traitement`,
        lien: '/commandes',
      })
    }

    const echues = await db.getOne(
      `SELECT COUNT(*) AS n FROM factures
        WHERE statut IN ('emise', 'partielle')
          AND date_echeance IS NOT NULL AND date_echeance < CURDATE()`,
    )
    if (echues.n > 0) {
      alerts.push({
        type: 'facture',
        niveau: 'danger',
        titre: 'Factures échues',
        message: `${echues.n} facture(s) impayée(s) et échue(s)`,
        lien: '/facturation',
      })
    }

    // Abonnements / contrats : échéances proches ou dépassées
    const echeances = await db.getAll(
      `SELECT ct.id, ct.reference, ct.type, ct.intitule, ct.prochaine_echeance, ct.jours_relance,
              c.nom AS client_nom,
              DATEDIFF(CURDATE(), ct.prochaine_echeance) AS jours_restants
         FROM contrats ct
         JOIN clients c ON c.id = ct.client_id
        WHERE ct.statut = 'actif'
          AND ct.prochaine_echeance IS NOT NULL
          AND DATEDIFF(CURDATE(), ct.prochaine_echeance) <= IFNULL(ct.jours_relance, 7)
        ORDER BY ct.prochaine_echeance ASC`,
    )
    for (const e of echeances) {
      const libelle = e.type === 'abonnement' ? 'Abonnement' : 'Contrat'
      if (e.jours_restants < 0) {
        alerts.push({
          type: 'contrat', niveau: 'danger',
          titre: `${libelle} en retard`,
          message: `${e.client_nom} — « ${e.intitule} » : échéance dépassée de ${Math.abs(e.jours_restants)} j`,
          lien: '/clients',
        })
      } else {
        alerts.push({
          type: 'contrat', niveau: e.jours_restants <= 2 ? 'warning' : 'info',
          titre: `Échéance ${libelle.toLowerCase()} proche`,
          message: `${e.client_nom} — « ${e.intitule} » : ${e.jours_restants === 0 ? "aujourd'hui" : `dans ${e.jours_restants} j`}`,
          lien: '/clients',
        })
      }
    }

    // Licence : expiration proche ou expirée
    const lic = verifyLicence(process.env.LICENCE_KEY ?? '')
    if (lic.payload && lic.payload.expiration) {
      const daysLeft = lic.daysLeft
      const entreprise = lic.payload.entreprise || 'Votre entreprise'
      if (!lic.valid && lic.expired) {
        alerts.push({
          type: 'licence', niveau: 'danger',
          titre: 'Licence expirée',
          message: `La licence de ${entreprise} a expiré le ${lic.payload.expiration}. Renouvelez-la pour continuer à utiliser l'application.`,
          lien: '/parametres',
        })
      } else if (lic.valid && daysLeft <= 30) {
        alerts.push({
          type: 'licence',
          niveau: daysLeft <= 7 ? 'danger' : 'warning',
          titre: 'Licence bientôt expirée',
          message: `La licence de ${entreprise} expire dans ${daysLeft} jour(s) (${lic.payload.expiration}). Pensez à la renouveler.`,
          lien: '/parametres',
        })
      }
    }

    res.json({ count: alerts.length, alertes: alerts })
  } catch (err) {
    console.error('[AGEO] notifications:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des notifications' })
  }
})

module.exports = router
