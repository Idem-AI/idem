#!/bin/bash

# Script pour mettre à jour les scopes du provider Google dans Casdoor

CASDOOR_URL="http://localhost:8000"
PROVIDER_OWNER="idem"
PROVIDER_NAME="idem-google"

echo "📥 Récupération du provider actuel..."
PROVIDER_DATA=$(curl -s "${CASDOOR_URL}/api/get-provider?id=${PROVIDER_OWNER}/${PROVIDER_NAME}")

# Extraire les données du provider
PROVIDER=$(echo "$PROVIDER_DATA" | jq '.data')

if [ "$PROVIDER" == "null" ]; then
    echo "❌ Erreur: Provider non trouvé"
    exit 1
fi

echo "✅ Provider trouvé: $(echo "$PROVIDER" | jq -r '.displayName')"
echo "📝 Scopes actuels: $(echo "$PROVIDER" | jq -r '.scopes')"

# Mettre à jour les scopes
UPDATED_PROVIDER=$(echo "$PROVIDER" | jq '.scopes = "profile email"')

echo ""
echo "🔄 Mise à jour du provider avec les scopes 'profile email'..."

# Sauvegarder dans un fichier temporaire
echo "$UPDATED_PROVIDER" > /tmp/provider_update.json

# Afficher les données qui seront envoyées (sans le secret)
echo "$UPDATED_PROVIDER" | jq 'del(.clientSecret)' | head -20

echo ""
echo "⚠️  IMPORTANT: L'API Casdoor nécessite une authentification pour mettre à jour les providers."
echo "Vous devez vous connecter à l'interface web Casdoor et aller dans:"
echo "  Providers → idem-google → Modifier le champ 'Scopes' → Mettre 'profile email' → Save"
echo ""
echo "Ou bien, utilisez cette commande curl avec un token d'authentification:"
echo ""
echo "curl -X POST '${CASDOOR_URL}/api/update-provider' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \\"
echo "  -d @/tmp/provider_update.json"
