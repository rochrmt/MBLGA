# ============================================================
#  Traefik — Guide d'installation sur le VPS
#  Emplacement : /opt/traefik/
# ============================================================

# 1. Créer le dossier
mkdir -p /opt/traefik/dynamic
mkdir -p /opt/traefik/letsencrypt

# 2. Copier les fichiers
#    - docker-compose.yml     → /opt/traefik/docker-compose.yml
#    - dynamic/dynamic.yml    → /opt/traefik/dynamic/dynamic.yml

# 3. Éditer l'email pour Let's Encrypt
nano /opt/traefik/docker-compose.yml
#    Remplacer: votre@email.com par ton vrai email
#    Remplacer: traefik.votre-domaine.com par ton sous-domaine

# 4. Créer le réseau Docker (une seule fois)
docker network create traefik-proxy

# 5. Démarrer Traefik
cd /opt/traefik
docker compose up -d

# 6. Vérifier
docker compose logs -f traefik
# Dashboard : http://IP_DU_VPS:8080 (temporaire, avant SSL)

# ── Pour chaque projet (ex: AGEO) ──────────────────────────
# Le projet doit :
# 1. Être sur le réseau traefik-proxy
# 2. Avoir les labels Traefik (voir docker-compose.yml du projet)
# 3. Avoir un domaine/sous-domaine pointant vers le VPS
