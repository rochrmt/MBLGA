# Guide de déploiement sur VPS Hostinger

Ce guide décrit l'installation complète de l'application sur un VPS Hostinger (Ubuntu 22.04 / 24.04) avec Traefik (reverse proxy + SSL automatique).

> **Exemple utilisé dans ce guide** : domaine `mbila-service.com`, VPS IP `203.0.113.50`, email `rochrmt@gmail.com`.
> Remplacez ces valeurs par les vôtres.

---

## 1. Prérequis

### 1.1 Côté Hostinger

1. **Acheter un VPS** (plan KVM — minimum 2 vCPU, 4 Go RAM, 50 Go disque).
2. **Système d'exploitation** : Ubuntu 22.04 LTS ou 24.04 LTS.
3. **Accès SSH** : connectez-vous avec `ssh root@IP_DU_VPS`.

### 1.2 Nom de domaine (OBLIGATOIRE pour SSL)

Vous devez posséder un nom de domaine (ex: `mbila-service.com`) et créer des **enregistrements DNS A** pointant vers l'IP de votre VPS.

Chez votre gestionnaire de domaine (Hostinger, Cloudflare, OVH, etc.) → **DNS / Zone DNS** :

| Type | Nom / Hôte | Valeur / Cible | TTL |
|------|------------|----------------|-----|
| A    | `ageo`     | `203.0.113.50` | 3600 |
| A    | `traefik`  | `203.0.113.50` | 3600 |

> **Explication** :
> - `ageo.mbila-service.com` → l'application AGEO
> - `traefik.mbila-service.com` → le dashboard Traefik
>
> Pour ajouter d'autres apps plus tard, créez d'autres sous-domaines (ex: `app2`, `blog`, etc.) pointant vers la même IP.

### 1.3 Vérifier que le DNS propage

```bash
# Sur le VPS ou sur votre PC
dig ageo.mbila-service.com +short
# Doit retourner : 203.0.113.50

dig traefik.mbila-service.com +short
# Doit retourner : 203.0.113.50
```

> Si le DNS n'est pas encore propagé, attendez quelques minutes (parfois jusqu'à 1h).

---

## 2. Préparation du serveur

### 2.1 Se connecter en SSH

```bash
ssh root@203.0.113.50
```

### 2.2 Mises à jour

```bash
apt update && apt upgrade -y
```

### 2.3 Installer Docker et Docker Compose

```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

### 2.4 Installer Git

```bash
apt install -y git
```

### 2.5 Ouvrir les ports dans le pare-feu Hostinger

Dans le panel Hostinger → **VPS → Pare-feu / Security** :

- Ajouter une règle TCP **port 22** (SSH)
- Ajouter une règle TCP **port 80** (HTTP)
- Ajouter une règle TCP **port 443** (HTTPS)

> Les ports 3001, 3306, etc. n'ont **pas besoin** d'être ouverts — Traefik gère tout en interne.

---

## 3. Installer Traefik (reverse proxy global)

Traefik gère le HTTPS automatiquement (Let's Encrypt) et permet d'héberger plusieurs applications sur le même VPS avec un seul reverse proxy.

### 3.1 Cloner le projet AGEO

```bash
cd /opt
git clone https://github.com/rochrmt/Ageo.git ageo
cd ageo
```

> Si le repo est privé, Git demandera vos identifiants :
> - **Username** : `rochrmt`
> - **Password** : votre Personal Access Token (pas votre mot de passe GitHub)
>
> Pour créer un token : GitHub → Settings → Developer settings → Personal access tokens → Generate new token (cochez `repo`).

### 3.2 Créer le réseau Docker partagé

```bash
docker network create traefik-proxy
```

> Ce réseau est utilisé par Traefik pour communiquer avec toutes vos applications. **À ne faire qu'une seule fois.**

### 3.3 Préparer les dossiers Traefik

```bash
mkdir -p /opt/traefik/dynamic
mkdir -p /opt/traefik/letsencrypt
```

### 3.4 Copier la configuration Traefik

```bash
cp /opt/ageo/traefik/docker-compose.yml /opt/traefik/docker-compose.yml
cp /opt/ageo/traefik/dynamic/dynamic.yml /opt/traefik/dynamic/dynamic.yml
```

### 3.5 Éditer la configuration Traefik

```bash
nano /opt/traefik/docker-compose.yml
```

**Changer 2 valeurs** dans ce fichier :

1. **Email pour Let's Encrypt** (ligne `--certificatesresolvers.letsencrypt.acme.email`) :

   ```yaml
   # AVANT
   - "--certificatesresolvers.letsencrypt.acme.email=votre@email.com"
   # APRÈS
   - "--certificatesresolvers.letsencrypt.acme.email=rochrmt@gmail.com"
   ```

   > Let's Encrypt enverra des notifications à cet email si vos certificats SSL vont expirer.

2. **Domaine du dashboard Traefik** (ligne `traefik.http.routers.dashboard.rule`) :

   ```yaml
   # AVANT
   - "traefik.http.routers.dashboard.rule=Host(`traefik.votre-domaine.com`)"
   # APRÈS
   - "traefik.http.routers.dashboard.rule=Host(`traefik.mbila-service.com`)"
   ```

   > Le dashboard Traefik sera accessible sur `https://traefik.mbila-service.com`.
   > Il montre toutes vos apps, certificats SSL, et le trafic en temps réel.

### 3.6 Démarrer Traefik

```bash
cd /opt/traefik
docker compose up -d
```

Vérifier que Traefik tourne :
```bash
docker compose ps
# Doit afficher : traefik   Up   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp, 0.0.0.0:8080->8080/tcp
```

Voir les logs :
```bash
docker compose logs -f traefik
```

> Le dashboard est temporairement accessible sur `http://203.0.113.50:8080` (avant que le SSL ne soit généré).

---

## 4. Configurer AGEO

### 4.1 Éditer le docker-compose.yml d'AGEO

```bash
cd /opt/ageo
nano docker-compose.yml
```

**1. Changer le domaine** dans les labels Traefik (section `app.labels`) :

```yaml
# AVANT
- "traefik.http.routers.ageo.rule=Host(`ageo.votre-domaine.com`)"
# APRÈS
- "traefik.http.routers.ageo.rule=Host(`ageo.mbila-service.com`)"
```

**2. Changer le mot de passe MySQL** dans `mysql.environment` et `app.environment` :

```yaml
# mysql.environment
MYSQL_ROOT_PASSWORD: UnMotDePasseFort123!

# app.environment (doit être identique)
DB_PASSWORD: UnMotDePasseFort123!
```

**3. Générer un JWT_SECRET aléatoire** :

```bash
openssl rand -hex 32
```
Copiez le résultat et remplacez la valeur dans `app.environment` :

```yaml
JWT_SECRET: d874f3bb86debb314eb424af233d01669f041233b416477d560c4132092580af3c87be9e3007a828d413b0b8ad31e18c
```

### 4.2 Construire et démarrer AGEO

```bash
cd /opt/ageo
docker compose up -d --build
```

Cette commande :
1. Compile le frontend React (Vite build)
2. Installe les dépendances backend (npm ci --omit=dev)
3. Démarre MySQL + l'application Node.js
4. Traefik détecte automatiquement l'app et génère le certificat SSL

### 4.3 Vérifier que tout fonctionne

```bash
# Logs de l'app
docker compose logs -f app

# Statut des conteneurs
docker compose ps
```

Vous devriez voir :
```
[AGEO] ✅ Licence valide
[AGEO] Base de données MySQL prête
[AGEO] Application disponible sur http://localhost:3001
[AGEO] Connexion MySQL établie
```

### 4.4 Accéder à l'application

Dans un navigateur : **`https://ageo.mbila-service.com`**

- **Email** : `admin@entreprise.com`
- **Mot de passe** : `admin1234`

> ⚠️ **Changez immédiatement le mot de passe admin** après la première connexion (Paramètres → Sécurité).

> Le certificat SSL est généré automatiquement à la première visite. Si vous voyez une erreur SSL la première fois, attendez 1-2 minutes et rafraîchissez la page.

---

## 5. HTTPS — géré automatiquement par Traefik

**Aucune configuration manuelle nécessaire.**

- **HTTP → HTTPS** : redirection automatique (port 80 → 443)
- **Certificats SSL** : générés automatiquement via Let's Encrypt à la première requête
- **Renouvellement** : automatique (avant expiration, sans intervention)

> Si vous voulez tester sans domaine réel (certificat de test/staging), décommentez la ligne `acme.caserver` dans `/opt/traefik/docker-compose.yml` :
> ```yaml
> - "--certificatesresolvers.letsencrypt.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory"
> ```
> Le navigateur affichera une erreur SSL, mais le certificat sera bien généré (Fake LE Intermediate X1). Une fois validé, recommentez cette ligne, supprimez `/opt/traefik/letsencrypt/acme.json` et redémarrez Traefik.

---

## 6. Ajouter un AUTRE projet sur le même VPS (guide complet)

Traefik permet d'héberger plusieurs applications sur le même VPS, chacune avec son propre sous-domaine et SSL automatique.

### 6.1 Créer l'enregistrement DNS

Chez votre gestionnaire de domaine, ajoutez un nouvel enregistrement A :

| Type | Nom / Hôte | Valeur / Cible | TTL |
|------|------------|----------------|-----|
| A    | `app2`     | `203.0.113.50` | 3600 |

Vérifiez la propagation :
```bash
dig app2.mbila-service.com +short
# Doit retourner : 203.0.113.50
```

### 6.2 Créer le docker-compose.yml du nouveau projet

```bash
mkdir -p /opt/app2
cd /opt/app2
nano docker-compose.yml
```

Contenu (modifiez selon votre app) :

```yaml
services:
  app2:
    build: .                          # ou image: mon-image:latest
    container_name: app2
    restart: unless-stopped
    networks:
      - default
      - traefik-proxy
    labels:
      # Activer Traefik pour ce conteneur
      - "traefik.enable=true"
      # Domaine d'accès
      - "traefik.http.routers.app2.rule=Host(`app2.mbila-service.com`)"
      # Utiliser le port HTTPS
      - "traefik.http.routers.app2.entrypoints=websecure"
      # SSL automatique via Let's Encrypt
      - "traefik.http.routers.app2.tls.certresolver=letsencrypt"
      # Port interne du conteneur (celui sur lequel l'app écoute)
      - "traefik.http.services.app2.loadbalancer.server.port=3000"
      # Middlewares : compression gzip + headers de sécurité
      - "traefik.http.routers.app2.middlewares=gzip@file,security-headers@file"

networks:
  traefik-proxy:
    name: traefik-proxy
    external: true
```

### 6.3 Explication des labels Traefik

| Label | Rôle |
|-------|------|
| `traefik.enable=true` | Active Traefik pour ce conteneur |
| `traefik.http.routers.{nom}.rule=Host(...)` | Domaine qui route vers cette app |
| `traefik.http.routers.{nom}.entrypoints=websecure` | Écoute sur HTTPS (port 443) |
| `traefik.http.routers.{nom}.tls.certresolver=letsencrypt` | Génère le SSL automatiquement |
| `traefik.http.services.{nom}.loadbalancer.server.port=XXXX` | Port interne du conteneur |
| `traefik.http.routers.{nom}.middlewares=gzip@file,security-headers@file` | Active gzip + sécurité |

> **Important** : Le nom `app2` dans les labels doit être **unique** par application. Ne réutilisez pas le même nom que celui d'AGEO (`ageo`).

### 6.4 Démarrer le nouveau projet

```bash
cd /opt/app2
docker compose up -d --build
```

Traefik détecte automatiquement le nouveau conteneur et génère le certificat SSL.

### 6.5 Accéder

```
https://app2.mbila-service.com
```

### 6.6 Schéma de l'architecture

```
Internet
   │
   ▼
Traefik (ports 80 + 443)
   ├── ageo.mbila-service.com    → ageo-app:3001
   ├── app2.mbila-service.com    → app2:3000
   ├── traefik.mbila-service.com → dashboard Traefik
   └── (ajoutez autant d'apps que voulu)
```

---

## 7. Migration depuis l'ancienne configuration (Nginx → Traefik)

Si vous aviez déjà déployé avec la configuration Nginx précédente :

### 7.1 Arrêter l'ancienne stack

```bash
cd /opt/ageo
docker compose down
```

> Les données MySQL et uploads sont conservées (volumes Docker persistants).

### 7.2 Mettre à jour le projet

```bash
cd /opt/ageo
git pull origin main
```

### 7.3 Installer Traefik (voir section 3 ci-dessus)

```bash
docker network create traefik-proxy
mkdir -p /opt/traefik/{dynamic,letsencrypt}
cp /opt/ageo/traefik/docker-compose.yml /opt/traefik/
cp /opt/ageo/traefik/dynamic/dynamic.yml /opt/traefik/dynamic/
nano /opt/traefik/docker-compose.yml   # email + domaine dashboard
cd /opt/traefik && docker compose up -d
```

### 7.4 Configurer et redémarrer AGEO

```bash
cd /opt/ageo
nano docker-compose.yml   # changer le domaine + mots de passe
docker compose up -d --build
```

### 7.5 Vérifier

```bash
docker compose ps
# 3 conteneurs : ageo-mysql, ageo-app, traefik
```

---

## 8. Sécuriser l'installation

### 8.1 Pare-feu UFW

```bash
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw enable
```

> Ne **pas** ouvrir le port 3306 (MySQL) publiquement.

### 8.2 Désactiver la connexion SSH par mot de passe (recommandé)

```bash
# D'abord ajouter votre clé publique SSH
# Puis éditer :
nano /etc/ssh/sshd_config
# Mettre : PasswordAuthentication no
systemctl restart sshd
```

### 8.3 Changer le mot de passe MySQL

```bash
docker exec -it ageo-mysql mysql -u root -pANCIEN_MDP -e "ALTER USER 'root'@'%' IDENTIFIED BY 'NOUVEAU_MDP';"
# Puis mettre à jour DB_PASSWORD dans docker-compose.yml et redémarrer :
docker compose up -d
```

---

## 9. Sauvegardes automatiques

### 9.1 Sauvegarde manuelle

```bash
# Créer le dossier de sauvegarde
mkdir -p /opt/backups

# Exporter la base de données
docker exec ageo-mysql mysqldump -u root -pVOTRE_MDP ageo > /opt/backups/ageo_$(date +%Y-%m-%d_%H%M).sql

# Sauvegarder les uploads
tar -czf /opt/backups/uploads_$(date +%Y-%m-%d).tar.gz /opt/ageo/server/uploads/
```

### 9.2 Sauvegarde automatique (cron)

```bash
crontab -e
```

Ajouter :

```cron
# Sauvegarde quotidienne à 3h du matin
0 3 * * * docker exec ageo-mysql mysqldump -u root -pVOTRE_MDP ageo > /opt/backups/ageo_$(date +\%Y-\%m-\%d).sql && find /opt/backups -name "ageo_*.sql" -mtime +30 -delete
```

---

## 10. Mise à jour de l'application

```bash
cd /opt/ageo
git pull
docker compose up -d --build
```

> Les données MySQL et les uploads sont conservés (volumes Docker persistants).

---

## 11. Commandes utiles

| Action                             | Commande                                                      |
| ---------------------------------- | ------------------------------------------------------------- |
| Voir les logs app                  | `docker compose logs -f app`                                |
| Voir les logs MySQL                | `docker compose logs -f mysql`                              |
| Voir les logs Traefik              | `cd /opt/traefik && docker compose logs -f traefik`        |
| Redémarrer l'app                  | `docker compose restart app`                                |
| Redémarrer Traefik                | `cd /opt/traefik && docker compose restart traefik`        |
| Arrêter AGEO                       | `docker compose down`                                       |
| Arrêter Traefik                   | `cd /opt/traefik && docker compose down`                   |
| Arrêter + supprimer données      | `docker compose down -v`                                    |
| Statut des conteneurs              | `docker compose ps`                                         |
| Accéder au shell du conteneur app | `docker exec -it ageo-app sh`                               |
| Accéder à MySQL                  | `docker exec -it ageo-mysql mysql -u root -pVOTRE_MDP ageo` |
| Dashboard Traefik                 | `https://traefik.mbila-service.com`                         |

---

## 12. En cas de problème

### L'app ne démarre pas

```bash
docker compose logs app
```

Vérifier :

- MySQL est bien démarré : `docker compose ps mysql`
- Les variables d'environnement sont correctes dans `docker-compose.yml`
- Le port 80 n'est pas déjà utilisé : `ss -tlnp | grep :80`
- Le port 443 n'est pas déjà utilisé : `ss -tlnp | grep :443`
- Traefik est bien démarré : `cd /opt/traefik && docker compose ps`
- Le domaine pointe bien vers le VPS : `dig ageo.mbila-service.com`

### Erreur de connexion MySQL

```bash
docker exec ageo-mysql mysql -u root -pVOTRE_MDP -e "SHOW DATABASES;"
```

### Erreur SSL / Certificat non généré

```bash
# Vérifier les logs Traefik pour les erreurs Let's Encrypt
cd /opt/traefik && docker compose logs traefik | grep acme

# Causes possibles :
# 1. Le DNS ne pointe pas encore vers le VPS → vérifiez avec dig
# 2. Les ports 80/443 ne sont pas ouverts dans le pare-feu Hostinger
# 3. Rate limit Let's Encrypt → attendez 1h ou utilisez le staging (voir section 5)
```

### Réinitialiser complètement la base

```bash
docker compose down -v          # supprime les volumes (perte de données !)
docker compose up -d --build    # recrée tout
```

---

## Résumé express

```bash
# 1. SSH
ssh root@203.0.113.50

# 2. Docker
curl -fsSL https://get.docker.com | sh
apt install -y git

# 3. Projet
cd /opt && git clone https://github.com/rochrmt/Ageo.git ageo && cd ageo

# 4. Traefik (reverse proxy + SSL auto)
docker network create traefik-proxy
mkdir -p /opt/traefik/{dynamic,letsencrypt}
cp traefik/docker-compose.yml /opt/traefik/
cp traefik/dynamic/dynamic.yml /opt/traefik/dynamic/
nano /opt/traefik/docker-compose.yml   # email + domaine dashboard
cd /opt/traefik && docker compose up -d

# 5. Configurer AGEO
cd /opt/ageo
nano docker-compose.yml   # domaine + JWT_SECRET + mots de passe

# 6. Démarrer
docker compose up -d --build

# 7. Accéder
https://ageo.mbila-service.com
```
