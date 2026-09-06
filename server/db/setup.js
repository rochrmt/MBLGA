'use strict'
const bcrypt = require('bcryptjs')
const mysql = require('mysql2/promise')
const db = require('./database')

// ── Création de la base si absente (utile pour Docker / première install) ────

async function ensureDatabase() {
  const dbName = process.env.DB_NAME || 'ageo'
  const conn = await mysql.createConnection({
    host:     process.env.DB_SERVER   || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
  })
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log(`[AGEO] Base de données '${dbName}' prête`)
  } finally {
    await conn.end()
  }
}

// ── Création des tables (idempotente) ─────────────────────────────────────────

async function createTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id  INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(255) NOT NULL,
      CONSTRAINT UQ_categories_nom UNIQUE (nom)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      code       VARCHAR(50)  NOT NULL,
      nom        VARCHAR(255) NOT NULL,
      email      VARCHAR(255),
      telephone  VARCHAR(50),
      adresse    TEXT,
      ville      VARCHAR(100),
      actif      TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT UQ_clients_code UNIQUE (code)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS produits (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      code         VARCHAR(50)  NOT NULL,
      nom          VARCHAR(255) NOT NULL,
      description  TEXT,
      categorie_id INT,
      prix_ht      DOUBLE NOT NULL DEFAULT 0,
      tva          DOUBLE DEFAULT 20,
      stock        INT   DEFAULT 0,
      stock_min    INT   DEFAULT 5,
      actif        TINYINT   DEFAULT 1,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT UQ_produits_code UNIQUE (code),
      CONSTRAINT fk_produits_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS commandes (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      numero         VARCHAR(50) NOT NULL,
      client_id      INT NOT NULL,
      date_commande  DATE DEFAULT (CURDATE()),
      date_livraison DATE,
      statut         VARCHAR(50) DEFAULT 'en_attente',
      notes          TEXT,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT UQ_commandes_numero UNIQUE (numero),
      CONSTRAINT fk_commandes_client FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lignes_commande (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      commande_id   INT   NOT NULL,
      produit_id    INT   NOT NULL,
      quantite      INT   NOT NULL DEFAULT 1,
      prix_unitaire DOUBLE NOT NULL,
      remise        DOUBLE DEFAULT 0,
      CONSTRAINT fk_lc_commande FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE,
      CONSTRAINT fk_lc_produit  FOREIGN KEY (produit_id)  REFERENCES produits(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      username      VARCHAR(100) NOT NULL,
      email         VARCHAR(255) NOT NULL,
      nom           VARCHAR(255) NOT NULL,
      password_hash TEXT NOT NULL,
      role          VARCHAR(50)  NOT NULL DEFAULT 'user',
      actif         TINYINT NOT NULL DEFAULT 1,
      permissions   TEXT,
      last_login    DATETIME,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT UQ_users_username UNIQUE (username),
      CONSTRAINT UQ_users_email UNIQUE (email)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions_caisse (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      date_ouverture    DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_fermeture    DATETIME,
      montant_ouverture DOUBLE DEFAULT 0,
      montant_fermeture DOUBLE,
      statut            VARCHAR(20) DEFAULT 'ouverte',
      notes             TEXT,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS transactions_caisse (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      session_id       INT NOT NULL,
      date_transaction DATETIME DEFAULT CURRENT_TIMESTAMP,
      montant          DOUBLE NOT NULL,
      mode_paiement    VARCHAR(50) DEFAULT 'especes',
      reference        TEXT,
      notes            TEXT,
      produits         TEXT,
      type             VARCHAR(20) DEFAULT 'encaissement',
      facture_id       INT,
      CONSTRAINT fk_tc_session FOREIGN KEY (session_id) REFERENCES sessions_caisse(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS factures (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      numero        VARCHAR(50) NOT NULL,
      client_id     INT,
      commande_id   INT,
      date_emission DATE DEFAULT (CURDATE()),
      date_echeance DATE,
      statut        VARCHAR(20) DEFAULT 'brouillon',
      total_ht      DOUBLE DEFAULT 0,
      taux_tva      DOUBLE DEFAULT 0,
      total_ttc     DOUBLE DEFAULT 0,
      montant_paye  DOUBLE DEFAULT 0,
      notes         TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT UQ_factures_numero UNIQUE (numero),
      CONSTRAINT fk_factures_client   FOREIGN KEY (client_id)   REFERENCES clients(id),
      CONSTRAINT fk_factures_commande FOREIGN KEY (commande_id) REFERENCES commandes(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lignes_facture (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      facture_id    INT   NOT NULL,
      description   TEXT NOT NULL,
      quantite      DOUBLE DEFAULT 1,
      prix_unitaire DOUBLE DEFAULT 0,
      remise        DOUBLE DEFAULT 0,
      total         DOUBLE DEFAULT 0,
      CONSTRAINT fk_lf_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS contrats (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      reference          VARCHAR(50)  NOT NULL,
      client_id          INT NOT NULL,
      type               VARCHAR(20)  DEFAULT 'contrat',
      intitule           VARCHAR(255) NOT NULL,
      montant            DOUBLE DEFAULT 0,
      periodicite        VARCHAR(20)  DEFAULT 'mensuel',
      date_debut         DATE DEFAULT (CURDATE()),
      date_fin           DATE,
      prochaine_echeance DATE,
      jours_relance      INT DEFAULT 7,
      statut             VARCHAR(20)  DEFAULT 'actif',
      notes              TEXT,
      created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT UQ_contrats_reference UNIQUE (reference),
      CONSTRAINT fk_contrats_client FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS contrats_paiements (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      contrat_id    INT NOT NULL,
      montant       DOUBLE DEFAULT 0,
      date_paiement DATE DEFAULT (CURDATE()),
      mode          VARCHAR(50),
      notes         TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_cp_contrat FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE CASCADE
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS parametres (
      cle    VARCHAR(100) PRIMARY KEY,
      valeur LONGTEXT
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS departements (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      nom        VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT UQ_departements_nom UNIQUE (nom)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS employes (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      matricule     VARCHAR(50)  NOT NULL,
      nom           VARCHAR(255) NOT NULL,
      prenom        VARCHAR(255),
      poste         VARCHAR(255),
      departement   VARCHAR(100),
      telephone     VARCHAR(50),
      email         VARCHAR(255),
      date_embauche DATE,
      salaire       DOUBLE DEFAULT 0,
      actif         TINYINT NOT NULL DEFAULT 1,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT UQ_employes_matricule UNIQUE (matricule)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS conges (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      employe_id  INT NOT NULL,
      type        VARCHAR(50)  NOT NULL DEFAULT 'conge_paye',
      date_debut  DATE NOT NULL,
      date_fin    DATE NOT NULL,
      nb_jours    INT,
      motif       TEXT,
      statut      VARCHAR(20) NOT NULL DEFAULT 'en_attente',
      notes       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_conges_employe FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE CASCADE
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS bulletins_paie (
      id                        INT AUTO_INCREMENT PRIMARY KEY,
      employe_id                INT NOT NULL,
      mois                      VARCHAR(7) NOT NULL,
      salaire_base              DOUBLE DEFAULT 0,
      primes                    DOUBLE DEFAULT 0,
      deductions                DOUBLE DEFAULT 0,
      net                       DOUBLE DEFAULT 0,
      prime_rendement           DOUBLE DEFAULT 0,
      prime_anciennete          DOUBLE DEFAULT 0,
      autres_primes             DOUBLE DEFAULT 0,
      autres_primes_libelle     VARCHAR(255),
      heures_sup                INT DEFAULT 0,
      taux_heure_sup            DOUBLE DEFAULT 0,
      montant_heures_sup        DOUBLE DEFAULT 0,
      jours_conge_paye          INT DEFAULT 0,
      heures_conge              DOUBLE DEFAULT 0,
      montant_conge             DOUBLE DEFAULT 0,
      avances_salaire           DOUBLE DEFAULT 0,
      avance_salaire            DOUBLE DEFAULT 0,
      retenue_absence           DOUBLE DEFAULT 0,
      nb_jours_absence          INT DEFAULT 0,
      autres_deductions         DOUBLE DEFAULT 0,
      autres_deductions_libelle VARCHAR(255),
      lignes_supplementaires    TEXT,
      statut                    VARCHAR(20) NOT NULL DEFAULT 'en_attente',
      date_paiement             DATE,
      mode_paiement             VARCHAR(50),
      notes                     TEXT,
      created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT UQ_bulletin_employe_mois UNIQUE (employe_id, mois),
      CONSTRAINT fk_bp_employe FOREIGN KEY (employe_id) REFERENCES employes(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS documents_employes (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      employe_id   INT NOT NULL,
      nom_fichier  VARCHAR(255) NOT NULL,
      nom_original VARCHAR(255) NOT NULL,
      type_mime    VARCHAR(100),
      taille       INT,
      categorie    VARCHAR(50) NOT NULL DEFAULT 'autre',
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_docs_employe FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE CASCADE
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS journal_activites (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      date_action     DATETIME DEFAULT CURRENT_TIMESTAMP,
      utilisateur_id  INT,
      utilisateur_nom VARCHAR(150),
      module          VARCHAR(50)  NOT NULL,
      action          VARCHAR(50)  NOT NULL,
      description     TEXT,
      details         TEXT,
      ip              VARCHAR(45)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS petite_caisse (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      nom          VARCHAR(100) NOT NULL DEFAULT 'Petite Caisse',
      solde        DOUBLE DEFAULT 0,
      plafond      DOUBLE DEFAULT 0,
      actif        TINYINT NOT NULL DEFAULT 1,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS transactions_petite_caisse (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      petite_caisse_id INT NOT NULL,
      date_transaction DATETIME DEFAULT CURRENT_TIMESTAMP,
      montant          DOUBLE NOT NULL,
      type             VARCHAR(20) NOT NULL DEFAULT 'depense',
      categorie        VARCHAR(100),
      beneficiaire     VARCHAR(255),
      reference        TEXT,
      notes            TEXT,
      session_caisse_id INT,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_tpc_pc FOREIGN KEY (petite_caisse_id) REFERENCES petite_caisse(id) ON DELETE CASCADE,
      CONSTRAINT fk_tpc_session FOREIGN KEY (session_caisse_id) REFERENCES sessions_caisse(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS rapports_employes (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      user_id         INT NOT NULL,
      employe_nom     VARCHAR(150) NOT NULL,
      titre           VARCHAR(255) NOT NULL,
      periode         VARCHAR(100),
      description     TEXT,
      nom_fichier     VARCHAR(255) NOT NULL,
      nom_original    VARCHAR(255) NOT NULL,
      type_mime       VARCHAR(100),
      taille          BIGINT DEFAULT 0,
      date_upload     DATETIME DEFAULT CURRENT_TIMESTAMP,
      lu_admin        TINYINT DEFAULT 0,
      date_lecture    DATETIME
    )
  `)

  const indexes = [
    ['idx_re_user',         'rapports_employes (user_id)'],
    ['idx_tpc_date',        'transactions_petite_caisse (date_transaction)'],
    ['idx_journal_date',    'journal_activites (date_action)'],
    ['idx_journal_module',  'journal_activites (module)'],
    ['idx_journal_user',    'journal_activites (utilisateur_id)'],
  ]
  for (const [name, target] of indexes) {
    try { await db.exec(`CREATE INDEX ${name} ON ${target}`) } catch { /* already exists */ }
  }
}

// ── Migrations (colonnes ajoutées progressivement) ───────────────────────────

async function addColIfMissing(table, col, type) {
  const exists = await db.getOne(
    'SELECT 1 AS found FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col],
  )
  if (!exists) {
    await db.exec(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${type}`)
  }
}

async function runMigrations() {
  // Départements par défaut
  const { n } = await db.getOne('SELECT COUNT(*) AS n FROM departements')
  if (n === 0) {
    for (const nom of ['Direction', 'Finance', 'Commercial', 'Technique', 'RH', 'Logistique', 'Informatique', 'Juridique']) {
      await db.exec(`INSERT INTO departements (nom) VALUES ('${nom}')`)
    }
    console.log('[AGEO] Migration : départements par défaut insérés')
  }

  // Petite caisse par défaut
  const { npc } = await db.getOne('SELECT COUNT(*) AS npc FROM petite_caisse')
  if (npc === 0) {
    await db.exec(`INSERT INTO petite_caisse (nom, solde, plafond, actif) VALUES ('Petite Caisse', 0, 50000, 1)`)
    console.log('[AGEO] Migration : petite caisse par défaut créée')
  }

  // Colonnes bulletins_paie (déjà dans CREATE TABLE, mais on garde pour bases existantes)
  for (const [col, type] of [
    ['prime_rendement',           'DOUBLE DEFAULT 0'],
    ['prime_anciennete',          'DOUBLE DEFAULT 0'],
    ['autres_primes',             'DOUBLE DEFAULT 0'],
    ['autres_primes_libelle',     'VARCHAR(255)'],
    ['heures_sup',                'INT DEFAULT 0'],
    ['taux_heure_sup',            'DOUBLE DEFAULT 0'],
    ['montant_heures_sup',        'DOUBLE DEFAULT 0'],
    ['jours_conge_paye',          'INT DEFAULT 0'],
    ['heures_conge',              'DOUBLE DEFAULT 0'],
    ['montant_conge',             'DOUBLE DEFAULT 0'],
    ['avances_salaire',           'DOUBLE DEFAULT 0'],
    ['avance_salaire',            'DOUBLE DEFAULT 0'],
    ['retenue_absence',           'DOUBLE DEFAULT 0'],
    ['nb_jours_absence',          'INT DEFAULT 0'],
    ['autres_deductions',         'DOUBLE DEFAULT 0'],
    ['autres_deductions_libelle', 'VARCHAR(255)'],
    ['lignes_supplementaires',    'TEXT'],
    ['mode_paiement',             'VARCHAR(50)'],
  ]) {
    await addColIfMissing('bulletins_paie', col, type)
  }

  // Colonnes diverses
  await addColIfMissing('users',               'permissions',  'TEXT NULL')
  await addColIfMissing('transactions_caisse', 'type',         "VARCHAR(20) DEFAULT 'encaissement'")
  await addColIfMissing('transactions_caisse', 'facture_id',   'INT NULL')
  await addColIfMissing('factures',            'montant_paye', 'DOUBLE DEFAULT 0')
  await addColIfMissing('clients',             'type',         "VARCHAR(20) DEFAULT 'client'")
  await addColIfMissing('commandes',           'statut_paiement', "VARCHAR(20) DEFAULT 'impayee'")
  await addColIfMissing('transactions_caisse', 'commande_id',  'INT NULL')

  // Colonnes documents (bon de livraison / facture proforma / facture définitive)
  for (const [col, type] of [
    ['type_document',        "VARCHAR(30) DEFAULT 'facture_definitive'"],
    ['client_nom_libre',     'VARCHAR(255) NULL'],
    ['client_adresse_libre', 'TEXT NULL'],
    ['objet',                'TEXT NULL'],
    ['signature_auto',       'TINYINT DEFAULT 0'],
    ['conditions_reglement', 'VARCHAR(255) NULL'],
    ['mode_reglement',       'VARCHAR(100) NULL'],
    ['delai_livraison',      'VARCHAR(100) NULL'],
    ['duree_garantie',       'VARCHAR(100) NULL'],
    ['montant_tva',          'DOUBLE DEFAULT 0'],
    ['remise_globale',       'DOUBLE DEFAULT 0'],
    ['avance',               'DOUBLE DEFAULT 0'],
    ['reste_a_payer',        'DOUBLE DEFAULT 0'],
  ]) {
    await addColIfMissing('factures', col, type)
  }
  for (const [col, type] of [
    ['reference',     'VARCHAR(100) NULL'],
    ['qte_commandee', 'DOUBLE DEFAULT 0'],
    ['qte_livree',    'DOUBLE DEFAULT 0'],
    ['main_oeuvre',   'DOUBLE DEFAULT 0'],
  ]) {
    await addColIfMissing('lignes_facture', col, type)
  }

  // Premier admin → super_admin
  const hasSA = await db.getOne("SELECT id FROM users WHERE role = 'super_admin'")
  if (!hasSA) {
    const firstAdmin = await db.getOne("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
    if (firstAdmin) {
      await db.run("UPDATE users SET role = 'super_admin' WHERE id = ?", [firstAdmin.id])
      console.log('[AGEO] Migration : premier administrateur promu super administrateur')
    }
  }

  // Colonne poste pour les utilisateurs (comptable, caissier, commercial, etc.)
  await addColIfMissing('users', 'poste', "VARCHAR(50) NULL")

  // Colonne email pour les utilisateurs (authentification par email)
  await addColIfMissing('users', 'email', "VARCHAR(255) NULL")

  // Colonne is_original pour identifier le super admin original (non supprimable, invisible aux autres)
  await addColIfMissing('users', 'is_original', "TINYINT DEFAULT 0")
  // Marquer le premier super_admin comme original
  const origSA = await db.getOne("SELECT id FROM users WHERE role = 'super_admin' AND is_original = 1")
  if (!origSA) {
    const firstSA = await db.getOne("SELECT id FROM users WHERE role = 'super_admin' ORDER BY id LIMIT 1")
    if (firstSA) {
      await db.run("UPDATE users SET is_original = 1 WHERE id = ?", [firstSA.id])
      console.log('[AGEO] Super admin original marqué (id=' + firstSA.id + ')')
    }
  }
}

// ── Données initiales (admin uniquement) ─────────────────────────────────────

async function seedData() {
  const { n } = await db.getOne('SELECT COUNT(*) AS n FROM users')
  if (n > 0) return

  const hash = bcrypt.hashSync('admin1234', 10)
  await db.run(
    "INSERT INTO users (username, email, nom, password_hash, role, is_original) VALUES (?, ?, ?, ?, 'super_admin', 1)",
    ['admin', 'admin@entreprise.com', 'Administrateur', hash],
  )
  console.log('[AGEO] Compte super_admin créé → email: admin@entreprise.com / mot de passe: admin1234')
}

// ── Public API ────────────────────────────────────────────────────────────────

async function initialize() {
  await ensureDatabase()
  await createTables()
  await runMigrations()
  await seedData()
  console.log('[AGEO] Base de données MySQL prête')
}

db.initialize = initialize
module.exports = db
