# AGEO — Guide des commandes & déploiement

## Sommaire

1. [Démarrage du serveur (manuel)](#1-démarrage-du-serveur-manuel)
2. [Démarrage du serveur avec PM2 (recommandé)](#2-démarrage-du-serveur-avec-pm2-recommandé)
3. [Redémarrer le serveur (tuer + relancer)](#3-redémarrer-le-serveur-tuer--relancer)
4. [Build du frontend](#4-build-du-frontend)
5. [Déploiement chez un client (pas à pas)](#5-déploiement-chez-un-client-pas-à-pas)
6. [Gestion des licences](#6-gestion-des-licences)
7. [Effacer ses traces après déploiement](#7-effacer-ses-traces-après-déploiement-chez-un-client)
8. [Hébergement sur un serveur propre (alternative)](#8-hébergement-sur-un-serveur-propre-alternative-recommandée)
9. [Commandes utiles](#9-commandes-utiles)
10. [Sauvegarde de la base de données (pas à pas)](#10-sauvegarde-de-la-base-de-données-pas-à-pas)
11. [Déploiement Docker (tout-en-un, réseau local)](#11-déploiement-docker-tout-en-un-réseau-local)
12. [Ouvrir le port dans le pare-feu (détaillé)](#12-ouvrir-le-port-dans-le-pare-feu-détaillé)
13. [Diagnostic & dépannage](#13-diagnostic--dépannage)

---

## 1. Démarrage du serveur (manuel)

Ouvrir un terminal dans `C:\Users\RMT\OneDrive\Desktop\AGEO\server` :

```bash
npm start
```

Pour arrêter : `Ctrl + C`

> Inconvénient : fermer le terminal arrête le serveur.

---

## 2. Démarrage du serveur avec PM2 (recommandé)

PM2 garde le serveur en vie en permanence, même après fermeture du terminal.

### Installer PM2 (une seule fois)

```bash
npm install -g pm2 pm2-windows-startup
```

### Démarrer le serveur

```bash
cd C:\Users\RMT\OneDrive\Desktop\AGEO
pm2 start ecosystem.config.js
```

### Démarrage automatique au boot (une seule fois)

```bash
pm2-windows-startup install
pm2 save
```

> À chaque redémarrage de la machine, le serveur se lance automatiquement.

### Arrêter le serveur

```bash
pm2 stop ageo-server
```

### Voir les logs

```bash
pm2 logs ageo-server
```

---

## 3. Redémarrer le serveur (tuer + relancer)

### Méthode A — Avec PM2

```bash
pm2 restart ageo-server
```

### Méthode B — Sans PM2 (PowerShell)

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Seconds 2; Start-Process -FilePath "node.exe" -ArgumentList "index.js" -WorkingDirectory "C:\Users\RMT\OneDrive\Desktop\AGEO\server"; Start-Sleep -Seconds 4; Write-Host "Serveur redémarré"
```

### Explication de la commande

| Partie                                                                                  | Action                               |
| --------------------------------------------------------------------------------------- | ------------------------------------ |
| `Get-Process -Name node -ErrorAction SilentlyContinue`                                | Cherche tous les processus node      |
| `\| Stop-Process -Force`                                                               | Tue tous les processus node trouvés |
| `Start-Sleep -Seconds 2`                                                              | Attend 2s (libération du port 3001) |
| `Start-Process -FilePath "node.exe" -ArgumentList "index.js" -WorkingDirectory "..."` | Démarre le serveur en arrière-plan |
| `Start-Sleep -Seconds 4`                                                              | Attend 4s (temps de démarrage)      |
| `Write-Host "Serveur redémarré"`                                                    | Affiche le message de confirmation   |

---

## 4. Build du frontend

Après toute modification du code frontend (`client/src/`), il faut rebuild :

```bash
cd C:\Users\RMT\OneDrive\Desktop\AGEO
npm run build
```

Puis redémarrer le serveur (voir section 3).

### Build + redémarrage en une commande (PowerShell)

```powershell
npm run build; Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Seconds 2; Start-Process -FilePath "node.exe" -ArgumentList "index.js" -WorkingDirectory "C:\Users\RMT\OneDrive\Desktop\AGEO\server"; Start-Sleep -Seconds 4; Write-Host "Build + redémarrage terminés"
```

---

## 5. Déploiement chez un client (pas à pas)

### Étape 1 — Générer la licence (sur votre machine)

1. Connectez-vous en `admin` (super_admin)
2. Allez dans **Paramètres → Licence → Générer une licence**
3. Remplissez : nom de l'entreprise, date d'expiration (1 an), utilisateurs max
4. Cliquez **Générer**, puis **Copier** la clé

### Étape 2 — Préparer le dossier

Sur votre machine :

```bash
cd C:\Users\RMT\OneDrive\Desktop\AGEO
npm run build
```

Une fois le build terminé, copiez le dossier `AGEO/` vers la machine client (clé USB, zip, réseau).

#### ⚠️ Dossiers et fichiers à NE PAS copier

Ces dossiers/fichiers sont inutiles sur la machine client (trop volumineux ou spécifiques à votre machine de développement) :

| Dossier / Fichier          | Raison                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `client/node_modules/`   | Trop volumineux (~200+ Mo). Sera recréé sur le client avec `npm install`       |
| `server/node_modules/`   | Idem. Sera recréé sur le client avec `npm install`                             |
| `node_modules/` (racine) | Idem. Sera recréé avec `npm install`                                           |
| `client/dist/`           | **À copier** — c'est le résultat du build (déjà inclus dans le dossier) |
| `img_New_Appli/`         | Dossier de captures d'écran de conception — inutile en production                |
| `.git/`                  | Historique Git — inutile en production                                            |
| `extract_pdf.py`         | Script temporaire de test — à supprimer                                          |

#### ✅ Ce qu'il FAUT copier

| Dossier / Fichier         | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `server/`               | Tout le backend (sauf `node_modules/`)               |
| `client/dist/`          | Le frontend compilé (généré par `npm run build`) |
| `client/package.json`   | Pour réinstaller les dépendances frontend si besoin  |
| `server/package.json`   | Pour réinstaller les dépendances backend             |
| `package.json` (racine) | Scripts globaux                                        |
| `ecosystem.config.js`   | Configuration PM2                                      |
| `GUIDE-COMMANDES.md`    | Ce guide                                               |

#### Méthode rapide (PowerShell) — créer un zip sans les dossiers inutiles

```powershell
# Se placer dans le dossier parent
cd C:\Users\RMT\OneDrive\Desktop

# Créer un dossier temporaire propre
Remove-Item -Recurse -Force AGEO_deploy -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path AGEO_deploy

# Copier en excluant les dossiers inutiles
robocopy AGEO AGEO_deploy /E /XD node_modules .git img_New_Appli /XF extract_pdf.py

# Créer le zip
Compress-Archive -Path AGEO_deploy\* -DestinationPath AGEO_deploy.zip -Force

# Nettoyer le dossier temporaire
Remove-Item -Recurse -Force AGEO_deploy

Write-Host "Archive créée : C:\Users\RMT\OneDrive\Desktop\AGEO_deploy.zip"
```

Vous obtenez un fichier `AGEO_deploy.zip` prêt à copier sur la machine client (clé USB, réseau, etc.).

### Étape 3 — Installer les prérequis sur la machine client

#### Node.js

- Télécharger et installer **Node.js LTS** (v20+) depuis https://nodejs.org

#### SQL Server

- Installer **SQL Server Express** (gratuit) + **SSMS**
- Choisir **Authentification mixte** (SQL + Windows)
- Noter le mot de passe `sa`
- Noter le nom de l'instance (ex: `NOM_MACHINE\SQLEXPRESS`)
- Noter le port (par défaut `1433`)

#### Créer la base

- Ouvrir SSMS, se connecter en `sa`
- Créer une base nommée `ageo`

### Étape 4 — Configurer le `.env` (sur la machine client)

Ouvrir `AGEO/server/.env` et modifier :

```ini
# Connexion SQL Server (infos de la machine client)
DB_SERVER=NOM_MACHINE_CLIENT\SQLEXPRESS
DB_PORT=1433
DB_NAME=ageo
DB_USER=sa
DB_PASSWORD=mot_de_passe_sa_client

# JWT — une nouvelle chaîne aléatoire
JWT_SECRET=une_nouvelle_chaine_aleatoire_longue

# Licence — IDENTIQUE au vôtre + clé générée
LICENCE_SECRET=12fffd0329f96cf89632f961f0f24c8269552b2f6405ce5f3ba560b74f2bca5d16f8231e3ddc97ce97d215a7be976def
LICENCE_KEY=COLLEZ_ICI_LA_CLE_GENEREE
```

> **Critique** : `LICENCE_SECRET` doit être **identique** à celui de votre machine.

### Étape 5 — Installer les dépendances et initialiser la base

Ouvrir un terminal **en administrateur** dans le dossier `AGEO` :

```bash
npm run install:all
```

Puis initialiser la base de données :

```bash
cd server
node db/setup.js
cd ..
```

### Étape 6 — Démarrer avec PM2 (démarrage automatique)

```bash
npm install -g pm2 pm2-windows-startup
pm2 start ecosystem.config.js
pm2-windows-startup install
pm2 save
```

> Le serveur se lancera automatiquement à chaque démarrage de la machine.

### Étape 7 — Vérifier

- Ouvrir `http://localhost:3001` sur la machine client
- Se connecter avec `admin` / `metasploit2`
- Vérifier dans **Paramètres → Licence** que la licence est active

### Étape 8 — Donner accès aux utilisateurs

1. Trouver l'IP de la machine serveur (ex: `192.168.1.50`)
2. Les utilisateurs tapent : `http://192.168.1.50:3001`
3. Créer les comptes utilisateurs dans **Paramètres → Sécurité**

### Étape 9 — Ouvrir le port dans le pare-feu

Sur la machine serveur (PowerShell en administrateur) :

```powershell
New-NetFirewallRule -DisplayName "AGEO Server" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

---

## 6. Gestion des licences

### Comment ça marche

- **`LICENCE_SECRET`** = secret qui signe/vérifie les licences (identique sur toutes les machines)
- **`LICENCE_KEY`** = la licence signée pour une entreprise (vide = mode interne, pas de contrôle)

### Générer une licence (interface)

1. Se connecter en super_admin (`admin`)
2. **Paramètres → Licence → Générer une licence**
3. Remplir le formulaire et générer
4. Copier la clé et la mettre dans le `.env` du client

### Générer une licence (terminal)

```bash
cd C:\Users\RMT\OneDrive\Desktop\AGEO\server
node scripts/generate-licence.js "Nom Entreprise" 2027-12-31
```

Avec options :

```bash
node scripts/generate-licence.js "Nom Entreprise" 2027-12-31 10 all
```

> Arguments : entreprise, expiration (YYYY-MM-DD), max_users (optionnel), modules (optionnel)

### Notifications d'expiration

- **30 jours avant** : alerte orange dans la cloche + bannière ambre
- **7 jours avant** : alerte rouge + bannière rouge
- **Expirée** : alerte rouge + bannière rouge "Licence expirée"

---

## 7. Effacer ses traces après déploiement chez un client

Après avoir installé l'application et vérifié qu'elle fonctionne chez le client, supprimez les fichiers sensibles et inutiles pour protéger votre code.

### Étape 1 — Supprimer le code source frontend

Le dossier `client/src/` contient tout votre code source React. Une fois le build fait (`client/dist/`), il est inutile :

```bash
cd C:\AGEO
rmdir /s /q client\src
rmdir /s /q client\node_modules
del client\package.json
del client\vite.config.js
del client\index.html
```

### Étape 2 — Supprimer les fichiers de développement

```bash
del package.json
del package-lock.json
```

### Étape 3 — Supprimer les scripts et fichiers sensibles

```bash
cd server
rmdir /s /q scripts
del check-cols.js
del check-users.js
del fix-admin.js
del test-conn.js
del test-encaisser.js
cd ..
```

### Étape 4 — Supprimer les logs et fichiers temporaires

```bash
rmdir /s /q logs
del server-out.log
del server-err.log
```

### Étape 5 — Supprimer le guide lui-même

```bash
del GUIDE-COMMANDES.md
```

### Étape 6 — Vider l'historique PowerShell

Pour effacer l'historique des commandes tapées dans le terminal :

```powershell
Remove-Item (Get-PSReadlineOption).HistorySavePath -ErrorAction SilentlyContinue
Clear-History
```

### Étape 7 — Vider la corbeille

```powershell
Clear-RecycleBin -Force
```

### Ce qui doit rester sur la machine client

```
AGEO/
├── client/
│   └── dist/              # Frontend buildé (HTML/CSS/JS minifié)
├── server/
│   ├── routes/            # API backend (nécessaire au runtime)
│   ├── db/                # Connexion base de données
│   ├── middleware/        # Auth + licence
│   ├── utils/             # Licence + journal
│   ├── node_modules/      # Dépendances serveur
│   ├── .env               # Configuration (sans vos infos)
│   ├── config.js
│   └── index.js
├── ecosystem.config.js    # Config PM2
└── node_modules/          # Dépendances racine
```

### Sécurité supplémentaire

- **Changer le mot de passe admin** : connectez-vous avec `admin`/`metasploit2`, allez dans Paramètres → Sécurité, changez le mot de passe
- **Restreindre l'accès au dossier** : clic droit sur `AGEO/` → Propriétés → Sécurité → retirer les utilisateurs non admin
- **Cacher le dossier** : attribut hidden sur le dossier

```powershell
attrib +h C:\AGEO
```

> **Note** : le code backend (`server/`) reste en JavaScript lisible. Pour une protection totale, envisagez d'héberger le serveur vous-même (voir section 8).

---

## 8. Hébergement sur un serveur propre (alternative recommandée)

Au lieu d'installer chez le client, hébergez l'application sur un serveur cloud. Les clients accèdent juste via une URL.

### Avantages

- Code 100% protégé (rien sur la machine client)
- Mises à jour centralisées
- Une seule instance à gérer par client

### Étapes

1. Louer un VPS (ex: OVH, DigitalOcean, Hostinger)
2. Installer Node.js, SQL Server (ou utiliser une base managée)
3. Copier le projet, configurer `.env`, `npm run install:all`
4. Build + PM2 + démarrage auto
5. Configurer un nom de domaine + HTTPS (Nginx + Let's Encrypt)
6. Donner l'URL au client (ex: `https://societe-abc.votredomaine.com`)

---

## 9. Commandes utiles

### Tout installer depuis zéro

```bash
cd C:\Users\RMT\OneDrive\Desktop\AGEO
npm run install:all
```

### Build + démarrer

```bash
npm run build:start
```

### Initialiser la base de données

```bash
cd C:\Users\RMT\OneDrive\Desktop\AGEO\server
node db/setup.js
```

### Voir l'état PM2

```bash
pm2 status
```

### Voir les logs en temps réel

```bash
pm2 logs ageo-server --lines 50
```

### Tuer tous les processus node (urgence)

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Vérifier la santé du serveur

```bash
curl http://localhost:3001/api/health
```

### Ouvrir le port 3001 dans le pare-feu

```powershell
New-NetFirewallRule -DisplayName "AGEO Server" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

---

## 10. Sauvegarde de la base de données (pas à pas)

La base de données SQL Server (`ageo`) contient toutes vos données : clients, produits, commandes, factures, personnel, etc. Il est **indispensable** de la sauvegarder régulièrement.

Deux scripts ont été créés dans `server/scripts/` :

- `backup-db.js` : le script Node.js qui fait la sauvegarde (utilise le package `mssql` déjà installé)
- `setup-backup-task.bat` : le script qui planifie la sauvegarde automatique

### Étape 1 : Configurer le script de sauvegarde

Ouvrez le fichier `server/scripts/backup-db.js` et vérifiez/modifiez ces lignes selon votre configuration :

```javascript
const config = {
  server: 'SERVEURRMT',       // Votre serveur SQL
  port: 63813,                // Le port SQL Server
  database: 'ageo',           // Nom de la base
  user: 'sa',                 // Utilisateur SQL
  password: '123456',         // Mot de passe SQL
  options: { encrypt: false, trustServerCertificate: true },
}

// Dossier où les sauvegardes seront stockées
const backupDir = 'C:\\Backups'        // ← Modifiable (ex: 'D:\\Sauvegardes\\AGEO')

// Nombre de jours avant suppression des anciennes sauvegardes
const retentionDays = 30               // ← Les .bak de plus de 30 jours sont auto-supprimés
```

> **Note** : ces valeurs sont les mêmes que dans `server/.env`. Pas besoin d'installer `sqlcmd` — le script utilise Node.js + le package `mssql` déjà installé dans le projet.

### Étape 2 : Faire une sauvegarde manuelle (test)

Ouvrez un terminal dans le dossier `server/` et lancez :

```bash
node scripts/backup-db.js
```

Résultat attendu :

```
Sauvegarde de 'ageo' en cours...
Sauvegarde OK : C:\Backups\ageo_2026-07-31_1022.bak (10.87 MB)
Terminé.
```

Vérifiez que le fichier `.bak` existe bien dans `C:\Backups\`.

### Étape 3 : Activer la sauvegarde automatique (tous les jours)

1. Faites un **clic droit** sur le fichier `server/scripts/setup-backup-task.bat`
2. Choisissez **« Exécuter en tant qu'administrateur »**
3. Une fenêtre s'ouvre et confirme la création de la tâche planifiée

Résultat attendu :

```
Tache planifiee creee avec succes !
Nom        : AGEO_Backup_DB
Frequence  : Tous les jours a 02:00
```

À partir de maintenant, **tous les jours à 02h00 du matin**, la base sera sauvegardée automatiquement dans `C:\Backups\`.

### Étape 4 : Vérifier que la planification fonctionne

Pour voir la tâche planifiée :

```powershell
schtasks /query /tn "AGEO_Backup_DB"
```

Pour lancer la tâche manuellement (test sans attendre 02h00) :

```powershell
schtasks /run /tn "AGEO_Backup_DB"
```

### Étape 5 : Restaurer une sauvegarde (en cas de problème)

Un script `restore-db.js` a été créé pour restaurer la base depuis un fichier `.bak`.

**1. Arrêter le serveur** (pour libérer la base) :

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

**2. Lister les sauvegardes disponibles** :

```powershell
Get-ChildItem "C:\Backups" -Filter "*.bak" | Format-Table Name, Length, LastWriteTime
```

**3. Restaurer** (remplacez par le nom du fichier voulu) :

```bash
node scripts/restore-db.js "C:\Backups\ageo_2026-07-31_1022.bak"
```

Résultat attendu :

```
Fichier de sauvegarde : C:\Backups\ageo_2026-07-31_1022.bak (10.87 MB)

⚠️  ATTENTION : toutes les données actuelles de "ageo" seront
   remplacées par celles de la sauvegarde. Cette action est irréversible.

Connexion à SQL Server...
Fermeture des connexions sur "ageo"...
Restauration en cours...

✅ Restauration terminée : "ageo" restaurée depuis C:\Backups\ageo_2026-07-31_1022.bak
   Vous pouvez redémarrer le serveur maintenant.
```

**4. Redémarrer le serveur** :

```powershell
Start-Process -FilePath "node.exe" -ArgumentList "index.js" -WorkingDirectory "C:\Users\RMT\OneDrive\Desktop\AGEO\server"
```

> **Attention** : la restauration remplace toutes les données actuelles par celles de la sauvegarde. Arrêtez toujours le serveur avant de restaurer.

### Résumé des commandes

| Action                     | Commande                                                                     |
| -------------------------- | ---------------------------------------------------------------------------- |
| Sauvegarde manuelle        | `node scripts/backup-db.js` (depuis le dossier `server/`)                |
| Activer planification      | Clic droit → Exécuter en admin sur `setup-backup-task.bat`               |
| Lancer tâche manuellement | `schtasks /run /tn "AGEO_Backup_DB"`                                       |
| Voir la tâche             | `schtasks /query /tn "AGEO_Backup_DB"`                                     |
| Supprimer la tâche        | `schtasks /delete /tn "AGEO_Backup_DB" /f`                                 |
| Restaurer                  | `node scripts/restore-db.js "C:\Backups\fichier.bak"` (depuis `server/`) |
| Lister les sauvegardes     | `Get-ChildItem "C:\Backups" -Filter "*.bak"`                               |

---

## 11. Déploiement Docker (tout-en-un, réseau local)

Docker permet d'installer **l'application + la base SQL Server en une seule commande**, sans installer Node.js ni SQL Server manuellement sur la machine du client.

Trois fichiers ont été créés à la racine du projet :

- `Dockerfile` : construit l'image de l'application (compile le frontend + installe le backend)
- `docker-compose.yml` : lance 2 conteneurs (l'app + SQL Server) et les relie entre eux
- `.dockerignore` : exclut `node_modules/`, `.git/`, etc. de l'image

### Étape 1 — Installer Docker sur la machine du client

**Sur Windows :**

1. Télécharger **Docker Desktop** : https://www.docker.com/products/docker-desktop/
2. Installer (nécessite WSL2 — l'installateur propose de l'activer automatiquement)
3. Redémarrer la machine
4. Lancer Docker Desktop et attendre qu'il affiche « Engine running »

**Sur Linux (Ubuntu/Debian) :**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # puis reconnectez-vous
```

### Étape 2 — Copier le projet sur la machine

Copiez le dossier `AGEO_deploy` (créé à la section 5) **avec** les 3 fichiers Docker (`Dockerfile`, `docker-compose.yml`, `.dockerignore`) sur la machine du client, par exemple dans `C:\AGEO\`.

### Étape 3 — Adapter les secrets (optionnel mais recommandé)

Ouvrez `docker-compose.yml` et modifiez si souhaité :

- `MSSQL_SA_PASSWORD` (mot de passe SQL Server — doit rester fort : 8+ caractères, majuscules, minuscules, chiffres). **Si vous le changez, changez aussi `DB_PASSWORD` dans la section `app` — les deux doivent être identiques.**
- `JWT_SECRET` : une longue chaîne aléatoire
- `LICENCE_SECRET` : votre propre chaîne aléatoire
- `LICENCE_KEY` : laissez vide pour une utilisation illimitée (mode interne)

### Étape 4 — Lancer l'application

Ouvrez un terminal dans le dossier du projet et tapez :

```bash
docker compose up -d --build
```

Ce que fait cette commande :

1. Télécharge l'image SQL Server (~1,5 Go la première fois, quelques minutes)
2. Compile le frontend React
3. Installe les dépendances du backend
4. Démarre SQL Server, attend qu'il soit prêt
5. Démarre l'application, qui crée automatiquement la base `ageo` et ses tables

Suivez la progression avec :

```bash
docker compose logs -f
```

Quand vous voyez `[AGEO] Application disponible sur http://localhost:3001`, c'est prêt (Ctrl+C pour quitter les logs, l'app continue de tourner).

### Étape 5 — Ouvrir le pare-feu (accès réseau local)

Pour que les autres machines du réseau puissent accéder à l'app :

```powershell
New-NetFirewallRule -DisplayName "AGEO App" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

Trouvez l'adresse IP de la machine :

```powershell
ipconfig
```

(cherchez « Adresse IPv4 », ex: `192.168.1.50`)

### Étape 6 — Accéder à l'application

- **Sur la machine elle-même** : http://localhost:3001
- **Depuis n'importe quel poste du réseau local** : `http://192.168.1.50:3001` (remplacez par l'IP trouvée à l'étape 5)

Compte par défaut : **admin / admin1234** (changez-le immédiatement).

### Étape 7 — Redémarrage automatique (après redémarrage du PC)

L'application est configurée pour redémarrer **automatiquement** à chaque fois que l'ordinateur du client s'allume (grâce à la politique `restart: unless-stopped` dans le fichier `docker-compose.yml`).

**Prérequis indispensable :** Docker lui-même doit se lancer au démarrage de l'ordinateur.
- **Sur Windows / Mac (Docker Desktop) :** Allez dans les paramètres de Docker Desktop (⚙️ *Settings* > *General*) et assurez-vous que la case **"Start Docker Desktop when you log in"** est bien cochée.
- **Sur Linux :** Le service est généralement activé par défaut. Si besoin : `sudo systemctl enable docker`.

*(Note : Si vous arrêtez manuellement l'application avec `docker compose down` ou `docker compose stop`, elle ne redémarrera pas toute seule. Il faudra la relancer manuellement).*

### Commandes Docker utiles

| Action                                   | Commande                         |
| ---------------------------------------- | -------------------------------- |
| Démarrer l'app                          | `docker compose up -d`         |
| Arrêter l'app                           | `docker compose down`          |
| Redémarrer                              | `docker compose restart`       |
| Voir les logs                            | `docker compose logs -f`       |
| Voir l'état des conteneurs              | `docker compose ps`            |
| Reconstruire après modification du code | `docker compose up -d --build` |
| Tout supprimer (⚠️ avec les données)  | `docker compose down -v`       |

### Sauvegarde de la base (en mode Docker)

La base est dans le conteneur, donc sauvegardez depuis l'hôte avec :

```bash
docker exec ageo-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Ageo@2026!" -C -Q "BACKUP DATABASE [ageo] TO DISK = '/var/opt/mssql/backup/ageo.bak' WITH FORMAT, INIT"
```

Le fichier `ageo.bak` est dans le volume `ageo-sqlserver-data`. Pour le récupérer sur l'hôte :

```bash
docker cp ageo-sqlserver:/var/opt/mssql/backup/ageo.bak C:\Backups\ageo.bak
```

> **Note** : les données de la base persistent dans le volume Docker `ageo-sqlserver-data` — elles survivent aux redémarrages et aux mises à jour de l'app. Elles ne sont supprimées que si vous lancez `docker compose down -v`.

### Restaurer une base existante depuis une autre machine (mode Docker)

Si vous avez une ancienne machine qui fait tourner AGEO avec sa base SQL Server et que vous voulez récupérer ses données sur la nouvelle machine Docker, voici la procédure complète.

#### Étape 1 — Sauvegarder la base sur l'ancienne machine

**Option A — via le script** (si `backup-db.js` est présent sur cette machine) :

```bash
cd server
node scripts/backup-db.js
```

→ produit un fichier `C:\Backups\ageo_AAAA-MM-JJ_HHMM.bak`

**Option B — via SSMS** :

1. Ouvrir SSMS → se connecter à l'ancien serveur SQL
2. Clic droit sur la base **ageo** → **Tâches** → **Sauvegarder...**
3. Type : *Complet*, destination : *Disque*
4. Notez le chemin du fichier `.bak` généré

#### Étape 2 — Copier le .bak vers la nouvelle machine

Par clé USB ou réseau, placez le fichier `.bak` sur la nouvelle machine, par exemple dans `C:\Backups\ageo.bak`.

#### Étape 3 — Arrêter l'app (laisser SQL Server tourner)

Sur la nouvelle machine, ouvrez un terminal dans le dossier du projet :

```bash
docker compose stop app
```

Cela arrête l'application mais garde le conteneur SQL Server actif pour la restauration.

#### Étape 4 — Copier le .bak dans le conteneur SQL Server

```bash
docker exec ageo-sqlserver mkdir -p /var/opt/mssql/backup
docker cp C:\Backups\ageo.bak ageo-sqlserver:/var/opt/mssql/backup/ageo.bak
```

#### Étape 5 — Identifier les noms logiques des fichiers de la base

```bash
docker exec ageo-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Ageo@2026!" -C -Q "RESTORE FILELISTONLY FROM DISK = '/var/opt/mssql/backup/ageo.bak'"
```

Notez les valeurs dans la colonne **LogicalName** (généralement `ageo` et `ageo_log`, mais cela peut varier selon l'installation d'origine).

#### Étape 6 — Restaurer la base (WITH MOVE obligatoire)

Les chemins Windows de l'ancienne machine n'existent pas dans le conteneur Linux, donc il faut spécifier `WITH MOVE` pour dire à SQL Server où placer les fichiers :

```bash
docker exec ageo-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Ageo@2026!" -C -Q "RESTORE DATABASE [ageo] FROM DISK = '/var/opt/mssql/backup/ageo.bak' WITH REPLACE, RECOVERY, MOVE 'ageo' TO '/var/opt/mssql/data/ageo.mdf', MOVE 'ageo_log' TO '/var/opt/mssql/data/ageo_log.ldf'"
```

> **Important** : adaptez `'ageo'` et `'ageo_log'` selon les LogicalName trouvés à l'étape 5. Si les noms sont différents (ex: `ageo_Data` et `ageo_Log`), utilisez-les à la place.

Résultat attendu :

```
Processed 500 pages for database 'ageo'...
RESTORE DATABASE successfully processed 500 pages in X.XXX seconds
```

#### Étape 7 — Relancer l'application

```bash
docker compose start app
docker compose logs -f app
```

Au démarrage, l'application va :

- Se reconnecter à la base restaurée
- Exécuter les **migrations automatiques** (si l'ancienne base était d'une version plus ancienne, le schéma sera mis à jour automatiquement — les migrations sont idempotentes, sans risque de perte de données)

Quand vous voyez `[AGEO] Application disponible sur http://localhost:3001`, c'est prêt.

#### Étape 8 — Vérifier les données

Connectez-vous à l'application (`http://IP_MACHINE:3001`) avec votre compte admin et vérifiez que vos clients, produits, commandes, factures sont bien présents.

> **⚠️ Attention** : `WITH REPLACE` écrase la base actuelle (vide + données de démo créées par Docker) par les données de la sauvegarde. C'est voulu dans ce cas. Ne l'utilisez pas si vous voulez conserver les données actuelles.

---

## 12. Ouvrir le port dans le pare-feu (détaillé)

Pour que les autres postes du réseau local puissent accéder à l'application, il faut autoriser le port **3001** (TCP) dans le pare-feu de la machine serveur.

### Windows — PowerShell (en administrateur)

#### Créer la règle (entrante)

```powershell
New-NetFirewallRule -DisplayName "AGEO App (port 3001)" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Domain,Private
```

> `-Profile Domain,Private` autorise uniquement le réseau local (domaine/privé). Pour aussi autoriser les réseaux publics (Wi-Fi invité, hôtel), ajoutez `,Public`.

#### Vérifier que la règle existe

```powershell
Get-NetFirewallRule -DisplayName "AGEO*" | Format-Table DisplayName, Enabled, Direction, Action
```

#### Tester l'accès depuis un autre poste

Depuis un autre PC du réseau, ouvrez un navigateur et tapez :

```
http://<IP_DU_SERVEUR>:3001
```

Pour trouver l'IP du serveur :

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object InterfaceAlias, IPAddress
```

#### Supprimer la règle (si besoin)

```powershell
Remove-NetFirewallRule -DisplayName "AGEO App (port 3001)"
```

### Windows — Interface graphique (alternative)

1. Ouvrir **Panneau de configuration** → **Pare-feu Windows Defender** → **Paramètres avancés**
2. Clic gauche sur **Règles de trafic entrant** (dans le volet gauche)
3. Clic droit → **Nouvelle règle...**
4. Type : **Port** → Suivant
5. Protocole : **TCP**, Port : **3001** → Suivant
6. Action : **Autoriser la connexion** → Suivant
7. Profil : cochez **Domaine** et **Privé** → Suivant
8. Nom : **AGEO App (port 3001)** → Terminer

### Linux (Ubuntu/Debian) — UFW

```bash
sudo ufw allow 3001/tcp comment "AGEO App"
sudo ufw reload
sudo ufw status
```

### Linux — firewalld (CentOS/RHEL/Fedora)

```bash
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

### Résumé

| Action                                       | Commande (PowerShell admin)                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ouvrir le port 3001                          | `New-NetFirewallRule -DisplayName "AGEO App (port 3001)" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Domain,Private` |
| Vérifier la règle                          | `Get-NetFirewallRule -DisplayName "AGEO*"`                                                                                                       |
| Trouver l'IP locale                          | `ipconfig` ou `Get-NetIPAddress -AddressFamily IPv4`                                                                                           |
| Supprimer la règle                          | `Remove-NetFirewallRule -DisplayName "AGEO App (port 3001)"`                                                                                     |
| Tester la connectivité (depuis un autre PC) | `Test-NetConnection -ComputerName <IP_SERVEUR> -Port 3001`                                                                                       |

---

## 13. Diagnostic & dépannage

Cette section couvre les problèmes les plus fréquents rencontrés en production chez un client.

### 13.1 — L'interface n'est pas accessible depuis un autre poste du réseau

#### Étape 1 — Vérifier que l'app tourne sur la machine serveur

**Mode Docker :**
```powershell
docker compose ps
```
→ `ageo-app` doit être **Up**. Sinon :
```powershell
docker compose up -d
docker compose logs -f
```

**Mode Node.js (sans Docker) :**
```powershell
pm2 status
```
→ `ageo-server` doit être `online`. Sinon :
```powershell
pm2 restart ageo-server
```

**Test local** — sur la machine serveur, ouvrir un navigateur :
```
http://localhost:3001
```
- Si ça charge → l'app fonctionne, le problème est réseau/pare-feu
- Si ça ne charge pas → l'app ne tourne pas, voir les logs

#### Étape 2 — Vérifier le pare-feu Windows (cause n°1)

```powershell
# Vérifier si la règle existe
Get-NetFirewallRule -DisplayName "AGEO*"

# Si absente, la créer (PowerShell admin)
New-NetFirewallRule -DisplayName "AGEO App (port 3001)" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Domain,Private
```

> **Profil réseau** : si le réseau Windows est classé **"Public"**, la règle `Domain,Private` ne s'applique pas. Soit ajouter `,Public`, soit changer le type de réseau en **Privé** :
> ```powershell
> # Voir le profil actuel
> Get-NetConnectionProfile
>
> # Changer en Privé (remplacer par le nom de l'interface)
> Set-NetConnectionProfile -Name "Wi-Fi" -NetworkCategory Private
> ```

#### Étape 3 — Tester la connectivité depuis le poste client

Depuis un **autre PC** du réseau :
```powershell
Test-NetConnection -ComputerName 192.168.1.50 -Port 3001
```

| Résultat | Diagnostic |
|----------|------------|
| `TcpTestSucceeded : True` | Le réseau passe — vérifier l'URL dans le navigateur (bien `http://` et `:3001`) |
| `TcpTestSucceeded : False` | Pare-feu, app arrêtée, ou isolation réseau |

#### Étape 4 — Vérifier l'IP utilisée

Sur la **machine serveur** :
```powershell
ipconfig
```
→ Chercher "Adresse IPv4" (ex: `192.168.1.50`).

Les autres postes doivent taper : `http://192.168.1.50:3001`
- ❌ `http://localhost:3001` → ne marche que sur la machine serveur elle-même
- ❌ `http://192.168.1.50` (sans `:3001`) → port manquant

#### Étape 5 — Vérifier que les deux machines sont sur le même réseau

- Même box / switch / Wi-Fi
- Un **Wi-Fi invité** ou un **VLAN isolé** bloque la communication entre postes
- Certains routeurs ont une option **"Isolation des clients / AP isolation"** → à désactiver dans les paramètres du routeur

#### Étape 6 — Antivirus tiers

Un antivirus (Kaspersky, Avast, ESET, Bitdefender...) peut avoir son **propre pare-feu** qui bloque le port 3001, indépendamment de Windows.

- Vérifier dans l'antivirus : règles de pare-feu / exceptions
- Ajouter une exception pour le port 3001 en TCP entrant
- Ou désactiver temporairement le pare-feu de l'antivirus pour tester

---

### 13.2 — L'application ne démarre pas (Docker)

#### Symptôme : `docker compose up -d` échoue ou le conteneur s'arrête

```powershell
# Voir l'état des conteneurs
docker compose ps -a

# Voir les logs d'erreur
docker compose logs app
```

#### Causes fréquentes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `SQL Server not ready` | SQL Server met trop de temps à démarrer | Attendre et relancer : `docker compose up -d` |
| `ECONNREFUSED` | Base de données inaccessible | Vérifier que `ageo-sqlserver` est `healthy` : `docker compose ps` |
| `Port 3001 already in use` | Un autre processus utilise le port | `Get-Process -Name node -ErrorAction SilentlyContinue \| Stop-Process -Force` ou changer le port dans `docker-compose.yml` |
| `Image not found` | Docker n'a pas build l'image | `docker compose up -d --build` |
| `Permission denied` (Linux) | Utilisateur pas dans le groupe docker | `sudo usermod -aG docker $USER` puis se reconnecter |

#### Réinitialiser complètement

```powershell
docker compose down
docker compose up -d --build
```

#### Réinitialiser ET effacer les données (⚠️ perte de données)

```powershell
docker compose down -v
docker compose up -d --build
```

---

### 13.3 — L'application ne démarre pas (Node.js sans Docker)

#### Vérifier les logs PM2

```powershell
pm2 logs ageo-server --lines 50
```

#### Causes fréquentes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `ECONNREFRESH` ou `Login failed` | SQL Server inaccessible ou mauvais mot de passe | Vérifier `server/.env` : `DB_SERVER`, `DB_PORT`, `DB_PASSWORD` |
| `Port 3001 already in use` | Un autre processus utilise le port | `Get-Process -Name node -ErrorAction SilentlyContinue \| Stop-Process -Force` |
| `Cannot find module` | Dépendances non installées | `cd server && npm install` |
| `JWT_SECRET not defined` | `.env` manquant ou incomplet | Vérifier que `server/.env` existe et contient toutes les variables |

#### Tester la connexion à SQL Server

```powershell
cd server
node test-conn.js
```

---

### 13.4 — Licence expirée ou invalide

#### Vérifier le statut de la licence

**Via l'interface** : Paramètres → Licence

**Via le terminal (Docker) :**
```powershell
docker exec ageo-app node -e "const {verify}=require('./utils/licence'); const r=verify(process.env.LICENCE_KEY||''); console.log(JSON.stringify({valid:r.valid, expired:r.expired, reason:r.reason, entreprise:r.payload?.entreprise, expiration:r.payload?.expiration, daysLeft:r.daysLeft}, null, 2))"
```

**Via le terminal (Node.js) :**
```powershell
cd server
node -e "const {verify}=require('./utils/licence'); const r=verify(process.env.LICENCE_KEY||''); console.log(JSON.stringify({valid:r.valid, expired:r.expired, reason:r.reason, daysLeft:r.daysLeft}, null, 2))"
```

#### Causes

| Message | Cause | Solution |
|---------|-------|----------|
| `Mode interne` | `LICENCE_KEY` vide | Normal — mode illimité, pas de contrôle |
| `Signature de licence invalide` | `LICENCE_SECRET` ne correspond pas | Vérifier que le secret est identique à celui utilisé pour générer la clé |
| `Licence expirée le YYYY-MM-DD` | La date d'expiration est passée | Générer une nouvelle clé et la mettre dans `docker-compose.yml` ou `.env` |
| `Format de licence invalide` | Clé tronquée ou corrompue | Re-copier la clé complète (elle est longue ~200 caractères) |

#### Renouveler

1. Générer une nouvelle clé :
   ```powershell
   docker exec ageo-app node scripts/generate-licence.js "Entreprise" 2027-12-31
   ```
2. La coller dans `LICENCE_KEY` (`docker-compose.yml` ou `.env`)
3. Redémarrer :
   ```powershell
   # Docker
   docker compose down && docker compose up -d

   # Node.js
   pm2 restart ageo-server
   ```

---

### 13.5 — Page blanche ou erreur dans le navigateur

#### Vider le cache du navigateur

- **Ctrl + Shift + R** (rechargement forcé)
- Ou ouvrir en **navigation privée** pour tester

#### Vérifier que le frontend est bien buildé

**Mode Docker :** le build se fait automatiquement avec `docker compose up -d --build`. Forcer un rebuild :
```powershell
docker compose down
docker compose up -d --build
```

**Mode Node.js :**
```powershell
cd C:\AGEO
npm run build
pm2 restart ageo-server
```

#### Erreurs dans la console (F12)

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Failed to load resource 404` | Frontend non buildé | Rebuild (voir ci-dessus) |
| `NetworkError` | API inaccessible | Vérifier que le serveur tourne (section 13.1) |
| `402 Payment Required` | Licence expirée | Voir section 13.4 |
| `401 Unauthorized` | Session expirée | Se reconnecter |
| `CORS error` | URL d'API incorrecte | Vérifier que l'URL correspond au serveur |

---

### 13.6 — Base de données inaccessible

#### Vérifier que SQL Server tourne

**Mode Docker :**
```powershell
docker compose ps
# ageo-sqlserver doit être "Up (healthy)"
```

**Mode Node.js (SQL Server installé sur la machine) :**
```powershell
# Vérifier que le service SQL Server tourne
Get-Service -Name "*SQL*"
# Doit afficher "Running"
```

Si arrêté :
```powershell
Start-Service -Name "MSSQLSERVER"
# ou pour une instance nommée :
Start-Service -Name "MSSQL`$SQLEXPRESS"
```

#### Tester la connexion

```powershell
cd server
node test-conn.js
```

#### Causes fréquentes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Login failed for user 'sa'` | Mauvais mot de passe | Vérifier `DB_PASSWORD` dans `.env` ou `docker-compose.yml` |
| `Server not found` | Mauvais nom de serveur ou port | Vérifier `DB_SERVER` et `DB_PORT` |
| `Cannot connect to server` | SQL Server arrêté | Démarrer le service (voir ci-dessus) |
| `Database 'ageo' does not exist` | Base non créée | `cd server && node db/setup.js` |

---

### 13.7 — Lenteur ou gel de l'application

#### Vérifier les ressources

**Mode Docker :**
```powershell
docker stats
```
→ Vérifier CPU et RAM des conteneurs. SQL Server a besoin de **minimum 2 Go RAM**.

**Mode Node.js :**
```powershell
# CPU et RAM
Get-Process -Name node, sqlservr | Select-Object Name, CPU, WorkingSet
```

#### Causes fréquentes

- **RAM insuffisante** : SQL Server + Node.js nécessitent au moins 4 Go RAM au total
- **Disque plein** : vérifier l'espace disque
  ```powershell
  Get-PSDrive C | Select-Object Used, Free
  ```
- **Trop de connexions simultanées** : vérifier le nombre d'utilisateurs connectés
- **Logs trop volumineux** : vider les anciens logs
  ```powershell
  # Mode Docker
  docker system prune -f

  # Mode Node.js
  pm2 flush ageo-server
  ```

---

### 13.8 — Mot de passe admin perdu

#### Réinitialiser via le terminal

**Mode Docker :**
```powershell
docker exec ageo-app node -e "const db=require('./db/database'); db.run('UPDATE users SET mot_de_passe=? WHERE login=?', [require('bcryptjs').hashSync('admin1234', 10), 'admin']).then(()=>{console.log('Mot de passe réinitialisé : admin1234'); process.exit(0)})"
```

**Mode Node.js :**
```powershell
cd server
node -e "const db=require('./db/database'); db.run('UPDATE users SET mot_de_passe=? WHERE login=?', [require('bcryptjs').hashSync('admin1234', 10), 'admin']).then(()=>{console.log('Mot de passe réinitialisé : admin1234'); process.exit(0)})"
```

> Après reset, se connecter avec `admin` / `admin1234` et **changer immédiatement le mot de passe** dans Paramètres → Sécurité.

---

### 13.9 — Docker Desktop ne démarre pas

#### Sur Windows

| Problème | Solution |
|----------|----------|
| `WSL2 not installed` | Ouvrir PowerShell admin : `wsl --install` puis redémarrer |
| `Docker Engine not running` | Redémarrer Docker Desktop, ou `Restart-Service com.docker.service` (admin) |
| `Cannot start service` | Vérifier que la virtualisation est activée dans le BIOS (Intel VT-x / AMD-V) |
| `Out of memory` | Augmenter la RAM allouée à Docker dans Settings → Resources |

#### Vérifier l'état de Docker

```powershell
docker info
```
Si la commande répond, Docker fonctionne. Sinon, redémarrer Docker Desktop.

---

### 13.10 — Résumé des commandes de diagnostic

| Action | Commande |
|--------|----------|
| État des conteneurs Docker | `docker compose ps` |
| Logs de l'app (Docker) | `docker compose logs -f app` |
| Logs de SQL Server (Docker) | `docker compose logs -f sqlserver` |
| État PM2 | `pm2 status` |
| Logs PM2 | `pm2 logs ageo-server --lines 50` |
| Tester la connexion DB | `cd server && node test-conn.js` |
| Vérifier la licence (Docker) | `docker exec ageo-app node -e "const {verify}=require('./utils/licence'); console.log(JSON.stringify(verify(process.env.LICENCE_KEY\|\|''),null,2))"` |
| Tester l'accès distant | `Test-NetConnection -ComputerName <IP> -Port 3001` |
| Vérifier le pare-feu | `Get-NetFirewallRule -DisplayName "AGEO*"` |
| Trouver l'IP du serveur | `ipconfig` |
| Voir les ressources Docker | `docker stats` |
| Voir l'espace disque | `Get-PSDrive C` |
| Réinitialiser mot de passe admin (Docker) | `docker exec ageo-app node -e "const db=require('./db/database'); db.run('UPDATE users SET mot_de_passe=? WHERE login=?', [require('bcryptjs').hashSync('admin1234',10), 'admin']).then(()=>console.log('OK'))"` |
| Redémarrer l'app (Docker) | `docker compose restart` |
| Redémarrer l'app (PM2) | `pm2 restart ageo-server` |
| Tout reconstruire (Docker) | `docker compose down && docker compose up -d --build` |
