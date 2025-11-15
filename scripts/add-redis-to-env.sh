#!/bin/bash

# Script pour ajouter les variables Redis à .env si elles n'existent pas déjà

ENV_FILE="/root/idem/.env"

# Vérifier si le fichier .env existe
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Erreur: Le fichier .env n'existe pas"
    exit 1
fi

# Vérifier si REDIS_PASSWORD existe déjà
if grep -q "REDIS_PASSWORD=" "$ENV_FILE"; then
    echo "✅ Les variables Redis existent déjà dans .env"
    exit 0
fi

# Générer un mot de passe sécurisé pour Redis
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Ajouter les variables Redis à la fin du fichier .env
cat >> "$ENV_FILE" << EOF

# Redis Configuration - Production
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_HOST=redis-prod
REDIS_PORT=6379
EOF

echo "✅ Variables Redis ajoutées à .env avec succès"
echo "🔐 Mot de passe Redis généré: ${REDIS_PASSWORD}"
echo ""
echo "📝 Variables ajoutées:"
echo "  - REDIS_PASSWORD"
echo "  - REDIS_HOST"
echo "  - REDIS_PORT"
