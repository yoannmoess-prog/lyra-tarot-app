#!/bin/bash

# Script pour vérifier manuellement la logique de détection de tirage du backend

# 1. Définir la question de test contenant un mot-clé de peur
QUESTION="Je crains de rater mon permis de conduire"
echo "Test avec la question : \"$QUESTION\""

# 2. Envoyer la requête à l'endpoint /api/spread
RESPONSE=$(curl -s -X POST http://localhost:8787/api/spread \
   -H "Content-Type: application/json" \
   -d "{\"question\": \"$QUESTION\"}")

# 3. Vérifier la réponse
EXPECTED_SPREAD="spread-truth"
echo "Réponse du serveur : $RESPONSE"

if echo "$RESPONSE" | grep -q "\"spreadId\":\"$EXPECTED_SPREAD\""; then
  echo "✅ SUCCÈS : Le backend a correctement sélectionné '$EXPECTED_SPREAD'."
  exit 0
else
  echo "❌ ÉCHEC : Le backend n'a pas sélectionné le bon tirage. Attendu: '$EXPECTED_SPREAD'."
  exit 1
fi
