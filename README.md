# Application de Gestion d'Entreprise

Application web complète de gestion d'entreprise : clients, produits, commandes, ventes, caisse, facturation, rapports, personnel (employés, congés, paie), journal d'activité et paramètres.

## Stack technique

- **Frontend** : React 18 + Vite + Tailwind CSS + React Router v6 + lucide-react
- **Backend** : Node.js + Express
- **Base de données** : MySQL 8.0
- **Authentification** : JWT + bcrypt (login par email)
- **Déploiement** : Docker + Docker Compose

## Démarrage rapide (Docker)

```bash
# 1. Cloner le dépôt
git clone https://github.com/VOTRE-COMPTE/VOTRE-REPO.git
cd VOTRE-REPO

# 2. Configurer les variables d'environnement
#    Éditer docker-compose.yml : JWT_SECRET, mots de passe MySQL, etc.

# 3. Lancer
docker compose up -d --build

# 4. Accéder
#    http://localhost:3001
#    Email : admin@entreprise.com
#    Mot de passe : admin1234
```

## Démarrage en développement

### Backend

```bash
cd server
npm install
cp .env.example .env  # ou créer .env avec vos paramètres MySQL
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

## Configuration

### Variables d'environnement (server/.env)

| Variable | Description | Valeur par défaut |
|---|---|---|
| `DB_SERVER` | Hôte MySQL | `localhost` |
| `DB_PORT` | Port MySQL | `3306` |
| `DB_NAME` | Nom de la base | `ageo` |
| `DB_USER` | Utilisateur MySQL | `root` |
| `DB_PASSWORD` | Mot de passe MySQL | — |
| `JWT_SECRET` | Secret JWT | — |
| `JWT_EXPIRES` | Durée de validité du token | `10h` |
| `LICENCE_SECRET` | Secret de licence | — |
| `LICENCE_KEY` | Clé de licence (vide = mode interne) | — |
| `PORT` | Port du serveur | `3001` |

### Compte par défaut

- **Email** : `admin@entreprise.com`
- **Mot de passe** : `admin1234`

> ⚠️ Changez le mot de passe après la première connexion.

## Structure du projet

```
├── client/              # Frontend React (Vite)
│   ├── src/
│   │   ├── pages/       # Pages de l'application
│   │   ├── components/  # Composants réutilisables
│   │   ├── context/     # Contextes React (Auth, etc.)
│   │   └── lib/         # Utilitaires (API, templates)
│   └── package.json
├── server/              # Backend Express
│   ├── routes/          # Routes API
│   ├── db/              # Connexion et initialisation MySQL
│   ├── middleware/      # Auth, licence
│   ├── utils/           # Licence, journal
│   ├── scripts/         # Sauvegarde, restauration
│   └── package.json
├── Dockerfile           # Image Docker (frontend + backend)
├── docker-compose.yml   # Stack MySQL + App
└── GUIDE-DEPLOIEMENT-VPS.md
```

## Licence

Système de licence intégré avec clé HMAC-SHA256. Voir `server/utils/licence.js`.

Générer une clé de licence :

```bash
cd server
node scripts/generate-licence.js "Mon Entreprise" 2027-12-31
```

## Déploiement

Voir [`GUIDE-DEPLOIEMENT-VPS.md`](GUIDE-DEPLOIEMENT-VPS.md) pour le déploiement complet sur VPS Hostinger.
