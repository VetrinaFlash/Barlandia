# ☕ Barlandia

Social game mobile-first in italiano, ispirato a Habbo Hotel ma ambientato in un **bar/locale** (niente corridoi né stanze d'albergo). Questo repo contiene la **Fase 1** (fondamenta multiplayer: stanza unica, tap-to-move, chat realtime, auth, PWA) e la **Fase 2 parziale** (valuta "Chicchi" con guadagno passivo + shop di arredi con piazzamento realtime).

**Fuori scope in questa fase** (previsto in fasi successive): trading tra utenti, valuta a pagamento, rarità/drop, più ambienti, minigiochi, amici/badge.

**Stack**: Next.js 15 (Cloudflare Pages via next-on-pages) · Cloudflare Workers · Durable Objects (WebSocket Hibernation) · D1 · PixiJS 8.

---

## Struttura del repo

```
apps/web         App Next.js (UI, auth, API shop/valuta) → Cloudflare Pages
apps/realtime    Worker + RoomDO (Durable Object della stanza) → Cloudflare Workers
packages/shared  Protocollo WS, layout stanza, pathfinding, token, password, logica valuta
migrations/      Migration D1 (schema completo Fase 1+2 + seed catalogo shop)
```

Il naming del progetto è sempre `barlandia` (worker `barlandia-realtime`, DB D1 `barlandia`, DO `room:barlandia`).

## Architettura in breve

```
client (PixiJS + React)
   │  HTTPS (cookie di sessione firmato HMAC)
   ▼
Cloudflare Pages (Next.js edge API)  ──────────► D1 (users, wallets, shop, inventory, tx)
   │  GET /api/rt-token → token firmato 60s          ▲
   ▼                                                 │
Worker barlandia-realtime ── verifica token ──► RoomDO (hibernation WS)
                                                 posizioni · chat · arredi · tick valuta
```

- **Il client non parla mai direttamente col DO**: apre il WebSocket sul worker `barlandia-realtime` presentando un token HMAC a vita breve (60s) rilasciato dall'app web solo a sessione valida. Il worker verifica firma/scadenza/scope e controlla l'header `Origin` prima dell'upgrade.
- **RoomDO** usa la **WebSocket Hibernation API**: lo stato per-connessione vive nell'attachment serializzato del socket, chat e arredi vivono in storage/D1; la memoria è solo cache ricostruibile. Con bar tranquillo il DO può essere scaricato senza chiudere le connessioni (costi contenuti).
- **Ogni input è validato server-side**: coordinate (bounds + layout + arredi), lunghezza chat, rate-limit su move/chat, ownership degli arredi, prezzi letti SOLO da D1.
- Una sola connessione per utente: un secondo join (altra tab, riconnessione mobile) chiude il socket precedente con codice 4000.

## Direzione artistica

Scelta: **caffè italiano vintage** — crema/sabbia per il pavimento a scacchi, legno espresso e ottone per il bancone, accenti terracotta/salvia, insegne al neon caldo. Il logo/mascotte (tazzina sorridente sullo sgabello, `apps/web/public/brand/`) è già su questa palette, quindi tutto il locale la segue.

Perché non un tileset CC0: dal sandbox di build i download da kenney.nl/itch.io non erano raggiungibili, quindi gli asset sono **placeholder procedurali** (vettoriali, disegnati con PixiJS Graphics) coerenti con la palette — vedi `apps/web/src/game/sprites.ts` e `palette.ts`. Per passare a un tileset CC0 (consigliato: un pack "interior" di Kenney ri-arredato a bar) basta sostituire le funzioni di disegno con Sprite/texture mantenendo gli stessi `sprite_key` del catalogo: il resto del gioco non cambia. Cambiare stile = cambiare `palette.ts` + `sprites.ts`, nient'altro.

## Setup locale

Prerequisiti: Node 22+, npm 10+.

```bash
npm install

# secrets di sviluppo (già pronti come esempio)
cp apps/web/.dev.vars.example apps/web/.dev.vars
cp apps/realtime/.dev.vars.example apps/realtime/.dev.vars
#   → SESSION_SECRET DEVE essere identico nei due file

# schema + seed shop sul D1 locale (condiviso tra le due app)
npm run db:migrate:local

# terminale 1: worker realtime su :8788
npm run dev:realtime

# terminale 2: app web su :3000
npm run dev:web
```

Apri http://localhost:3000, registrati e sei nel bar. Per vedere il multiplayer apri una seconda finestra in incognito con un altro account.

> Le due app condividono lo stesso D1 locale tramite la directory di persistenza `.wrangler/state` (il worker con `--persist-to`, Next tramite `setupDevPlatform({ persist })` in `next.config.mjs`). Se l'app web non vede le tabelle, hai saltato `npm run db:migrate:local`.

### Test

```bash
npm test    # vitest-pool-workers: gira nel runtime Workers reale (workerd)
```

I test coprono i deliverable chiave: **2 client WebSocket simultanei** (join reciproco, move broadcast con rifiuto delle tile bloccate, chat, user_left, sostituzione connessione duplicata), acquisto **atomico** (successo, saldo insufficiente senza scritture parziali, item inesistente), credito valuta con log, piazzamento arredi con verifica ownership in tempo reale.

## Deploy su Cloudflare

Ci sono due pezzi da deployare separatamente: l'app web (**Cloudflare Pages**, si collega a Git e da lì in poi ogni push fa auto-deploy) e il worker realtime (**Cloudflare Workers**, auto-deploy via la GitHub Action già inclusa in `.github/workflows/`). Vanno fatti in quest'ordine perché il worker deve esistere prima che l'app web possa puntarci.

### 0. Setup one-time (dal tuo terminale, con `wrangler login` fatto)

Il database D1 si chiama **`barlandia`** ed è già creato (dashboard Cloudflare → Workers & Pages → D1); il suo `database_id` è già incollato in entrambi i `wrangler.toml`. Se in futuro lo ricrei da zero:

```bash
npx wrangler login                  # apre il browser, autorizza l'account Cloudflare
npx wrangler d1 create barlandia    # stampa un database_id: aggiornalo nei due wrangler.toml
```

Applica lo schema al database remoto (va rifatto solo quando cambi le migration):

```bash
npm run db:migrate:remote                # applica migrations/*.sql al D1 di produzione
```

Genera un secret lungo e casuale per le sessioni (**deve essere identico** su worker e Pages):

```bash
openssl rand -base64 48                  # copia l'output, ti serve nei prossimi due comandi
```

### 1. Worker realtime — deploy manuale iniziale + auto-deploy da CI

Il primo deploy va fatto a mano (il worker deve esistere prima che GitHub Actions possa aggiornarlo):

```bash
cd apps/realtime
npx wrangler secret put SESSION_SECRET   # incolla il secret generato sopra
npx wrangler deploy
cd ../..
```

Aggiorna `ALLOWED_ORIGINS` in `apps/realtime/wrangler.toml` con i domini reali (es. `https://barlandia.it,https://www.barlandia.it`) e ricorda che ogni modifica a `wrangler.toml`/variabili non-secret richiede un nuovo deploy per essere applicata.

**Per l'auto-deploy da push** (workflow già pronto in `.github/workflows/deploy-realtime.yml`): su GitHub, vai in *Settings → Secrets and variables → Actions* del repo e aggiungi:

| Secret | Da dove prenderlo |
|---|---|
| `CLOUDFLARE_API_TOKEN` | dashboard Cloudflare → *My Profile → API Tokens → Create Token* → template "Edit Cloudflare Workers" (limita ad account e worker se possibile) |
| `CLOUDFLARE_ACCOUNT_ID` | dashboard Cloudflare, sidebar destra di qualunque pagina del tuo account |

Il workflow gira su push a `main` che tocchi `apps/realtime/`, `packages/shared/` o `migrations/` (se il tuo branch di produzione ha un altro nome, cambialo in cima al file). C'è anche `migrate-d1.yml`, **solo manuale** (Actions → *Migra D1 (produzione)* → *Run workflow*): usalo quando cambi lo schema, mai in automatico su ogni push.

### 2. App web — Cloudflare Pages con Git integration (l'auto-deploy che ti serve)

Dalla dashboard Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** → seleziona questo repository. Nella configurazione build:

| Campo | Valore |
|---|---|
| Production branch | il tuo branch di produzione (es. `main`) |
| Root directory | `apps/web` |
| Build command | `npx @cloudflare/next-on-pages@1` |
| Build output directory | `.vercel/output/static` |

Cloudflare rileva automaticamente lo `npm workspace` alla radice del repo e installa da lì prima di buildare `apps/web` — non serve altro. Dopo il primo deploy, in *Settings* del progetto Pages:

- **Environment variables**: aggiungi `REALTIME_WS_URL` = `wss://barlandia-realtime.<tuo-account>.workers.dev` (o il dominio custom del worker, es. `wss://rt.barlandia.it`, se lo configuri).
- **Secrets**: aggiungi `SESSION_SECRET` = **lo stesso identico valore** messo nel worker al passo 1.
- Se non vedi il binding D1 già preso da `wrangler.toml`, aggiungilo a mano in *Settings → Functions → D1 database bindings*: binding name `DB` → database `barlandia`.

Da qui in poi **ogni push al branch di produzione fa auto-deploy** dell'app web. Le altre branch generano automaticamente un preview URL.

### 3. Domini

Collega `barlandia.it` al progetto Pages (*Custom domains*) e, se vuoi un dominio pulito invece di `*.workers.dev`, aggiungi una route/dominio custom al worker (es. `rt.barlandia.it`) — poi aggiorna `REALTIME_WS_URL` di conseguenza e ridispiega l'app web.

La PWA è installabile out-of-the-box (manifest + service worker minimale + icone dalla mascotte; su iOS: Condividi → Aggiungi a Home).

## Valuta e shop — invarianti e note di audit

Questa è la parte da auditare prima di introdurre il trading (fase futura).

**Invarianti** (implementate in `packages/shared/src/currency.ts`, unico punto del codice che tocca `wallets.balance`):

1. Ogni variazione di saldo scrive una riga in `currency_transactions` **nella stessa transazione** (`db.batch`, atomico in D1). Il log è append-only: mai UPDATE/DELETE.
2. `wallets.balance` ha `CHECK (balance >= 0)` a livello di schema.
3. L'acquisto è una catena di 3 statement nello stesso batch, concatenate con `changes()` di SQLite: `UPDATE wallets ... WHERE balance >= prezzo` → `INSERT tx ... WHERE changes() > 0` → `INSERT inventory ... WHERE changes() > 0`. Saldo insufficiente ⇒ zero scritture (testato). Prezzo sempre letto da `shop_items`, mai dal client.
4. Guadagno passivo: alarm del DO ogni 5 min, +1 Chicco a chi ha dato segni di vita negli ultimi 2 min (heartbeat inviato dal client solo con tab visibile; move/chat contano come attività). Bonus benvenuto: +50 alla registrazione. Un utente = una connessione ⇒ niente doppio accredito multi-tab.
5. L'indice unico parziale `(placed_x, placed_y) WHERE is_placed = 1` impedisce due arredi sulla stessa tile anche a livello di schema.

**Compromessi dichiarati (da rivedere, in ordine di priorità):**

- **Heartbeat client-driven**: un client modificato può mandare heartbeat con tab in background e farmare ~12 Chicchi/ora. Accettabile ora (valuta senza valore reale e non scambiabile); **da irrobustire PRIMA del trading** (es. attività "provata" da interazioni reali, cap giornaliero, rilevamento pattern).
- **PBKDF2 a 100k iterazioni** (WebCrypto, edge-safe): sul piano free di Workers (10 ms CPU) login/registrazione possono sforare il limite. Le iterazioni sono codificate nell'hash, quindi si possono abbassare senza invalidare gli hash esistenti. Su piano paid nessun problema.
- **Sessione stateless (cookie HMAC 30gg)**: niente revoca lato server (il logout cancella solo il cookie). Per la Fase 3 valutare tabella sessioni o rotazione del secret.
- **`creditCurrency` fa balance-read separata dopo il batch**: il valore ritornato può essere leggermente stantio sotto concorrenza estrema; il saldo su D1 resta comunque corretto (l'UPDATE è relativo, non assoluto).
- **Anteprime shop a emoji** invece del render dello sprite: puro risparmio di tempo UI, gli sprite veri si vedono nella stanza.
- **Riconciliazione posizioni** via `state_sync` a ogni tick valuta (5 min): sufficiente ora; con più utenti conviene un sync più frequente o su richiesta.

## Protocollo WebSocket (riassunto)

Client→server: `move {targetX,targetY}` · `chat {text}` · `heartbeat` · `place_item {inventoryId,x,y}` · `pickup_item {inventoryId}`
Server→client: `welcome {self,users,chat,placements,balance}` · `user_joined/left` · `user_moved` · `chat {entry}` · `state_sync {users}` · `item_placed/removed` · `currency_earned {amount,balance}` · `error {code,message}`

Definizioni e parsing difensivo in `packages/shared/src/protocol.ts`.
