# Placez vos certificats SSL ici
#
# Pour activer HTTPS :
# 1. Obtenez vos certificats (Let's Encrypt, ou votre fournisseur)
# 2. Copiez-les ici :
#    - fullchain.pem  (certificat + chaîne)
#    - privkey.pem   (clé privée)
# 3. Décommentez le bloc HTTPS dans nginx/nginx.conf
# 4. Décommentez la redirection HTTPS dans nginx/nginx.conf
# 5. Redémarrez : docker compose restart nginx
#
# ── Avec Let's Encrypt (gratuit) ──
# Sur le VPS, installez certbot :
#   apt install certbot
#   certbot certonly --standalone -d votre-domaine.com
#   cp /etc/letsencrypt/live/votre-domaine.com/fullchain.pem .
#   cp /etc/letsencrypt/live/votre-domaine.com/privkey.pem .
#
# ── Avec OpenSSL (auto-signé, pour test) ──
#   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
#     -keyout privkey.pem -out fullchain.pem \
#     -subj "/CN=localhost"
