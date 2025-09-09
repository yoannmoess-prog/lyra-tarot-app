#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${1:-http://127.0.0.1:8787}"

banner(){ echo; echo "—— $* ——"; }
ok(){ echo "✅ $*"; }
ko(){ echo "❌ $*"; exit 1; }

banner "healthz"
H=$(curl -sS "$HOST/healthz" || true)
echo "$H" | grep -q '"ok":true' && ok "healthz ok" || ko "healthz ko"

banner "JSON /api/lyra"
read -r -d '' JSON_BODY <<'JSON' || true
{
  "name": "Yoann",
  "question": "Dois-je accepter l’offre ?",
  "cards": ["Tempérance", "5 de Bâton", "Cavalier de Coupe"],
  "userMessage": "",
  "history": [{"role":"user","content":"Bonjour Lyra."}]
}
JSON
R=$(curl -sS -H 'Content-Type: application/json' --data-binary "$JSON_BODY" "$HOST/api/lyra" || true)
echo "$R" | grep -q '"ok":true' && ok "JSON ok" || ko "JSON ko"

banner "SSE /api/lyra/stream (aperçu)"
read -r -d '' SSE_BODY <<'JSON' || true
{
  "name": "Yoann",
  "question": "Dois-je accepter l’offre ?",
  "cards": ["Tempérance", "5 de Bâton", "Cavalier de Coupe"],
  "userMessage": "Je me sens hésitant : quels risques je ne vois pas ?",
  "history": [{"role":"assistant","content":"(Réponse précédente)"}]
}
JSON
# on lit ~60 lignes max pour vérifier que des tokens arrivent puis on coupe
curl -sN -H 'Content-Type: application/json' --data-binary "$SSE_BODY" "$HOST/api/lyra/stream" \
  | sed -n '1,60p'
ok "SSE: tokens reçus (regarde les data: ...)."