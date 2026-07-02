#!/usr/bin/env bash
# Deploy di produzione di Barlandia in un solo comando.
#
# Va eseguito dal TUO terminale (serve una rete vera verso
# api.cloudflare.com — non funziona da ambienti sandbox isolati).
#
# Uso:
#   ./scripts/deploy.sh
#
# Fa, in ordine: login (se serve), install, migration D1 remote,
# deploy worker realtime, aggiorna REALTIME_WS_URL nel repo, deploy
# app web. Il SESSION_SECRET viene generato una volta e riusato
# identico su entrambi i worker (obbligatorio: firmano/verificano
# gli stessi token).

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Verifica login Cloudflare..."
if ! npx wrangler whoami >/dev/null 2>&1; then
  npx wrangler login
fi

echo "==> Installo le dipendenze..."
npm install

echo "==> Applico le migration D1 di produzione (barlandia)..."
npm run db:migrate:remote

SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -base64 48)}"
echo "==> SESSION_SECRET generato (salvalo da qualche parte, non verrà mostrato di nuovo):"
echo "    $SESSION_SECRET"

echo "==> Deploy worker realtime (apps/realtime)..."
cd apps/realtime
printf '%s' "$SESSION_SECRET" | npx wrangler secret put SESSION_SECRET
DEPLOY_OUT="$(npx wrangler deploy 2>&1)"
echo "$DEPLOY_OUT"
REALTIME_URL="$(printf '%s' "$DEPLOY_OUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1 || true)"
cd ../..

if [ -z "$REALTIME_URL" ]; then
  echo "!! Non sono riuscito a leggere l'URL dall'output di 'wrangler deploy' sopra."
  read -r -p "Incolla l'URL del worker realtime (https://...workers.dev): " REALTIME_URL
fi
REALTIME_WS_URL="wss://${REALTIME_URL#https://}"
echo "==> REALTIME_WS_URL: $REALTIME_WS_URL"

echo "==> Aggiorno apps/web/wrangler.jsonc con l'URL reale..."
python3 - "$REALTIME_WS_URL" <<'PYEOF'
import re, sys
path = "apps/web/wrangler.jsonc"
url = sys.argv[1]
with open(path) as f:
    content = f.read()
new_content = re.sub(r'"REALTIME_WS_URL":\s*"[^"]*"', f'"REALTIME_WS_URL": "{url}"', content)
if new_content == content:
    print("!! ATTENZIONE: non ho trovato REALTIME_WS_URL da sostituire, controlla il file a mano.")
with open(path, "w") as f:
    f.write(new_content)
PYEOF

echo "==> Deploy app web (build OpenNext + wrangler deploy, apps/web)..."
cd apps/web
printf '%s' "$SESSION_SECRET" | npx wrangler secret put SESSION_SECRET
npm run deploy
cd ../..

echo ""
echo "=========================================="
echo "Deploy completato."
echo "Ricordati di:"
echo "  1) aggiornare ALLOWED_ORIGINS in apps/realtime/wrangler.toml con i domini reali (barlandia.it, ecc.) e rilanciare questo script (o solo 'cd apps/realtime && npx wrangler deploy')"
echo "  2) fare commit + push di apps/web/wrangler.jsonc (REALTIME_WS_URL ora punta al worker vero):"
echo "       git add apps/web/wrangler.jsonc && git commit -m 'Aggiorna REALTIME_WS_URL con l'\''URL di produzione' && git push"
echo "  3) collegare i domini custom da dashboard Cloudflare (vedi README, sezione Deploy > Domini)"
echo "=========================================="
