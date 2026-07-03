# ☕ Barlandia

Social game mobile-first in italiano, ispirato a Habbo Hotel ma ambientato in un **bar/locale** (niente corridoi né stanze d'albergo). Questo repo contiene la **Fase 1** (fondamenta multiplayer: stanza unica, tap-to-move, chat realtime, auth, PWA), la **Fase 2 parziale** (valuta "Chicchi" con guadagno passivo + shop di arredi con piazzamento realtime) e gli **Sprint 1-3** della roadmap di game design (`docs/GAME-DESIGN.md`, Sprint 3 parziale): bonus giornaliero, tris del giorno, sedersi sugli arredi, emote, amici, badge, editor avatar (solo colore), bacheca eventi, cartolina della serata.

**Fuori scope in questa fase** (previsto in fasi successive): **trading tra utenti in ogni forma** (inclusi regali di valuta P2P come "offrigli un caffè" — vedi sezione Sprint 2), valuta a pagamento, rarità/drop, più ambienti, **minigiochi** (incluso un format giocabile per la bacheca — vedi sezione Sprint 3), **notifiche push**.

**Stack**: Next.js 15 (Cloudflare Workers via OpenNext) · Durable Objects (WebSocket Hibernation) · D1 · PixiJS 8.

> **Nota storica**: la prima versione di questo repo deployava l'app web su Cloudflare Pages con `@cloudflare/next-on-pages`. È stata migrata a **Cloudflare Workers via `@opennextjs/cloudflare`** perché next-on-pages è deprecato e il suo peer-range blocca Next.js a `<=15.5.2` — versione affetta da una RCE pre-autenticazione critica (**CVE-2025-66478**, CVSS 10.0) che colpisce esattamente le app App Router come questa. Dettagli in fondo alla sezione Deploy.

---

## Struttura del repo

```
apps/web         App Next.js (UI, auth, API shop/valuta) → Cloudflare Workers (OpenNext)
apps/realtime    Worker + RoomDO (Durable Object della stanza) → Cloudflare Workers
packages/shared  Protocollo WS, layout stanza, pathfinding, token, password, logica valuta
migrations/      Migration D1 (schema Fase 1+2 + seed shop + tabelle Sprint 1-2)
```

Entrambe le app sono Worker Cloudflare distinti (`barlandia` per il web, `barlandia-realtime` per il realtime), deployati separatamente ma nello stesso account e sullo stesso D1.

Il naming del progetto è sempre `barlandia` (worker `barlandia-realtime`, DB D1 `barlandia`, DO `room:barlandia`).

## Architettura in breve

```
client (PixiJS + React)
   │  HTTPS (cookie di sessione firmato HMAC)
   ▼
Worker "barlandia" — Next.js via OpenNext ────────► D1 (users, wallets, shop, inventory, tx)
   │  GET /api/rt-token → token firmato 60s          ▲
   ▼                                                 │
Worker "barlandia-realtime" ── verifica token ──► RoomDO (hibernation WS)
                                                 posizioni · chat · arredi · tick valuta
```

- **Il client non parla mai direttamente col DO**: apre il WebSocket sul worker `barlandia-realtime` presentando un token HMAC a vita breve (60s) rilasciato dall'app web solo a sessione valida. Il worker verifica firma/scadenza/scope e controlla l'header `Origin` prima dell'upgrade.
- **RoomDO** usa la **WebSocket Hibernation API**: lo stato per-connessione vive nell'attachment serializzato del socket, chat e arredi vivono in storage/D1; la memoria è solo cache ricostruibile. Con bar tranquillo il DO può essere scaricato senza chiudere le connessioni (costi contenuti).
- **Ogni input è validato server-side**: coordinate (bounds + layout + arredi), lunghezza chat, rate-limit su move/chat, ownership degli arredi, prezzi letti SOLO da D1.
- Una sola connessione per utente: un secondo join (altra tab, riconnessione mobile) chiude il socket precedente con codice 4000.

## Direzione artistica

Scelta: **caffè italiano vintage** — crema/sabbia per il pavimento a scacchi, legno espresso e ottone per il bancone, accenti terracotta/salvia, insegne al neon caldo. Il logo/mascotte (tazzina sorridente sullo sgabello, `apps/web/public/brand/`) è già su questa palette, quindi tutto il locale la segue.

Perché non un tileset CC0: dal sandbox di build i download da kenney.nl/itch.io non erano raggiungibili, quindi gli asset sono **placeholder procedurali** (vettoriali, disegnati con PixiJS Graphics) coerenti con la palette — vedi `apps/web/src/game/sprites.ts` e `palette.ts`. Per passare a un tileset CC0 (consigliato: un pack "interior" di Kenney ri-arredato a bar) basta sostituire le funzioni di disegno con Sprite/texture mantenendo gli stessi `sprite_key` del catalogo: il resto del gioco non cambia. Cambiare stile = cambiare `palette.ts` + `sprites.ts`, nient'altro.

## Sprint 1 (game design) — bonus giornaliero, tris del giorno, sedersi, emote

Prima incrementale della roadmap in `docs/GAME-DESIGN.md`, costruita sopra le fondamenta di Fase 1+2 senza toccarne le invarianti (stessa `currency.ts` come unico punto di scrittura su `wallets.balance`).

- **Bonus giornaliero** (`daily_bonus_claims`): +5 Chicchi al primo ingresso di ogni giorno (UTC), accreditato nel `welcome` del RoomDO. Atomico via `INSERT OR IGNORE` sulla chiave `(user_id, claim_date)` — niente doppio accredito da tab multiple o riconnessioni ravvicinate.
- **Tris del giorno** (`daily_goals`): 3 obiettivi leggeri — 3 messaggi in chat, 2 tick di guadagno passivo (~10 min di presenza attiva), 1 emote. Premio di +10 Chicchi una tantum al giorno, riscosso con un `UPDATE ... WHERE reward_claimed = 0 AND <soglie>` atomico (mai read-then-write). Il client mostra il progresso in una pillola HUD (🎯 n/3).
- **Sedersi**: tap su un arredo di categoria `seduta` (es. sgabello) entro 1 tile di distanza → l'avatar si siede lì, posto esclusivo (un occupante alla volta), si alza automaticamente se cammina altrove o se l'arredo viene rimosso da sotto di lui. Placeholder visivo: silhouette più bassa (nessun redesign dello sprite).
- **Emote**: 4 emote base (👋🥂💃👏) senza richiesta/conferma — quella è prevista in uno sprint successivo insieme al social graph. Rate-limited come la chat, broadcast a tutta la stanza, contano per il tris del giorno.

**Compromesso dichiarato**: `awardDailyBonus`/`bumpDailyGoal` ritornano esplicitamente `{ amount, balance }` separati proprio perché `creditCurrency` ritorna il saldo totale, non il delta — un bug reale emerso in fase di test (il client mostrava il saldo intero come "importo del bonus") prima di essere corretto. Se in futuro si aggiungono altri accrediti automatici, tenere questa distinzione.

## Sprint 2 (game design) — amici, badge, editor avatar

Seconda incrementale della roadmap. **Deliberatamente incompleto**: "offrigli un caffè tra amici" (che pure è nella roadmap) non è implementato perché è un trasferimento di valuta P2P — la stessa categoria di operazione (trading) che l'handoff originale mette esplicitamente fuori scope fino a una fase di audit dedicata, anche quando si presenta come "regalo" unidirezionale invece che scambio bidirezionale.

- **Amici** (`friendships`, riga unica per coppia con ordinamento canonico `user_a < user_b`): richiesta per username, accetta/rifiuta, rimuovi. La presenza ("chi è online") **non usa nessuna infrastruttura nuova**: è calcolata lato client dalla lista utenti già ricevuta via WebSocket (`welcome`/`user_joined`/`user_left`/`state_sync`) — dato che c'è una sola stanza globale, "online" coincide esattamente con "connesso al Durable Object", che ogni client vede già.
- **Badge** (`badges` + `user_badges`, assegnazione idempotente via `awardBadge`/INSERT OR IGNORE): `primi_100` alla registrazione (best-effort su `COUNT(*)`, non serve precisione assoluta sotto registrazioni concorrenti per un badge cosmetico), `prima_serata` al primo tris del giorno completato, `primo_brindisi` alla prima emote `cheers`. Mai valuta coinvolta.
- **Editor avatar**: solo colore per ora, sui 6 schemi già esistenti (`AVATAR_COLOR_SCHEMES`). Il colore è firmato nel cookie di sessione (evita una query D1 a ogni richiesta): `PATCH /api/avatar` riemette il cookie con il nuovo valore, e il client forza una riconnessione WebSocket subito dopo così il cambiamento è visibile agli altri utenti senza dover aspettare un nuovo login. **Compromesso dichiarato**: la riconnessione causa una breve sparizione/riapparizione dell'avatar per gli altri utenti (non c'è un messaggio WS dedicato "aggiorna solo il colore") — accettabile per un'azione rara come cambiare colore, da rivedere se in futuro l'editor si espande a più parti dell'avatar.

## Sprint 3 (game design, parziale) — bacheca ed eventi, cartolina della serata

Terza incrementale, **la più incompleta delle tre**: due dei tre item della roadmap originale non sono implementati, per due motivi diversi ma entrambi deliberati.

- **Bacheca** (`GET /api/bacheca`): mostra l'evento di "stasera" secondo il palinsesto settimanale fisso già scritto in `docs/EVENTI-365.md`. La logica è **duplicata di proposito** in `packages/shared/src/eventi.ts` (`eventoDelGiorno`): lo script `scripts/genera-eventi.mjs` resta JavaScript puro senza dipendenze di build per generare la doc offline, mentre il modulo condiviso è la versione TypeScript usata a runtime per calcolare l'evento di una data reale — le rotazioni del sabato (tema + torneo) si ricalcolano iterando dall'inizio dell'anno, esattamente come fa lo script, quindi le due implementazioni devono restare sincronizzate se si cambia il palinsesto. Testato confrontando `eventoDelGiorno` con righe note della doc generata (vedi `apps/realtime/test/eventi.spec.ts`). **Compromesso dichiarato**: Pasqua/Carnevale sono a data fissa (copiate dal calendario illustrativo 2027), non calcolate con l'algoritmo della Pasqua mobile — approssimazione accettata per una feature di colore.
- **Cartolina della serata** (`GET /api/recap`): riepilogo di oggi aggregando dati già tracciati altrove (tris del giorno, saldo, badge guadagnati oggi, evento della serata) — nessuna tabella nuova. I minuti di presenza sono una stima (tick di guadagno passivo × intervallo), non un cronometro esatto. Nessuna esportazione automatica in immagine: l'utente fa uno screenshot per condividerla, scelta deliberata per non introdurre una libreria di rendering canvas-to-image solo per questo.
- **Non implementato: un format giocabile per la bacheca** (karaoke/quiz). È un minigioco vero e proprio — esplicitamente fuori scope nell'handoff originale di Fase 1, la stessa linea che ha già escluso il trading. La bacheca oggi è solo informativa.
- **Non implementato: la notifica intelligente** ("i tuoi amici sono al bar"). Richiede un'infrastruttura Web Push (VAPID, service worker con push handler, storage delle subscription) che non esiste, con differenze di supporto reali tra iOS/Android/desktop da testare con cura — merita un giro dedicato invece di un'implementazione affrettata.

## Sprint 4 (game design) — livelli "Habitué"

Quarta incrementale (voce 23 di `docs/GAME-DESIGN.md`): un sistema di progressione che racconta "quanto sei stato al bar", non quanto hai speso.

- **XP solo da presenza ed eventi, mai dalla spesa** (`packages/shared/src/levels.ts`): stesso tick di presenza attiva che accredita i Chicchi (+4 XP), completamento del tris del giorno (+20 XP), ogni badge guadagnato (+15 XP). Comprare arredi non dà mai XP: un livello alto certifica presenza reale, non portafoglio.
- **Cap giornaliero** (`daily_xp_gains`, 120 XP/giorno): senza un tetto, chi resta collegato H24 supererebbe chi si presenta ogni sera per un'oretta — l'opposto di quello che un livello "Habitué" dovrebbe premiare.
- **7 livelli con titolo a tema bar** (Nuovo Avventore → Leggenda di Barlandia), soglie cumulative in `levelForXp`. Pillola 🏅 in HUD, dettaglio con barra di progresso nel profilo.
- **Compromesso dichiarato**: `awardXp` fa un breve *read-then-write* (legge il residuo di oggi e lo XP corrente, poi scrive in batch) invece di un singolo UPDATE atomico come `creditCurrency` — qui non c'è valuta in gioco, quindi una corsa tra due tick ravvicinati farebbe guadagnare al più qualche XP di troppo in un sistema puramente cosmetico. Stesso livello di tolleranza già accettato per il badge `primi_100`.

## Rifinitura post-lancio — bug reale, grafica, suoni

Dopo il primo deploy in produzione: segnalato un bug concreto ("compro un arredo e non è quello che ottengo piazzato") più un giudizio generale su grafica/audio scarni.

- **Bug fix: anteprima shop ≠ arredo reale**. Lo shop/inventario mostravano un'emoji generica scollegata dal disegno vero (`SPRITE_EMOJI`, es. 🍷 per un tavolino tondo) — da qui la percezione "compro X, ottengo Y". Corretto strutturalmente in `apps/web/src/game/preview.ts`: l'anteprima è ora un PNG renderizzato dalla **stessa** funzione `drawFurniture()` usata per disegnare l'arredo nella stanza (via un'`Application` PixiJS headless condivisa + `renderer.extract.base64()`, cacheata per `sprite_key`), quindi shop e stanza non possono più divergere per costruzione. Nota tecnica: le richieste concorrenti per lo stesso `sprite_key` sono deduplicate con una mappa `inFlight`, necessaria per via del doppio mount di React StrictMode in sviluppo (senza dedup, la richiesta "buona" restava in coda dietro tutte le altre invece di risolversi insieme alla prima).
- **Grafica**: contorni sottili su tutte le forme dell'avatar (leggibilità migliore su sfondo chiaro), due mensole bottiglie e un quadro a parete come arredo fisso della stanza (`drawBottleShelf`/`drawWallFrame` in `sprites.ts`) per rompere la sensazione di stanza vuota.
- **Suoni**: effetti sintetizzati via Web Audio (`apps/web/src/game/sound.ts`) — nessun asset esterno scaricato (stesso vincolo di sandbox già documentato per la grafica). Toni brevi generati con oscillatori + inviluppo per chat inviata/ricevuta, Chicchi guadagnati, acquisto, badge, emote, sedersi, errore. L'`AudioContext` si crea solo al primo gesto dell'utente (policy autoplay dei browser). Toggle 🔊/🔇 in HUD, stato persistito in `localStorage`.

## Rifinitura #2 — bug reale sul tris del giorno, obiettivi, illuminazione

Secondo giro di segnalazioni ("gli obiettivi non funzionano"). Investigato prima di modificare codice: il backend era corretto (`chat_count` in D1 arrivava correttamente a 3 dopo 3 messaggi, verificato in locale via query dirette), ma la UI aveva due problemi reali:

- **Bug: la pillola "🎯 n/3" era un `<div>` statico**, non un pulsante — su mobile il tap non apriva nulla (il dettaglio esisteva solo come `title`, un tooltip che il touch non mostra mai). Corretto rendendola un `<button>` che apre una nuova sheet.
- **Bug di percezione: la frazione mostrava solo obiettivi COMPLETI**, non il progresso di ciascuno — chi mandava 1-2 messaggi (su un target di 3) vedeva "0/3" fisso e concludeva, ragionevolmente, che il contatore fosse rotto. Corretto con la nuova `GoalsSheet` (`apps/web/src/app/bar/sheets.tsx`): una barra di progresso per ciascuno dei 3 obiettivi (chat/presenza/emote), aggiornata in tempo reale perché legge lo stesso stato `dailyGoals` già ricevuto via WebSocket in `page.tsx` (nessuna nuova fetch).
- **Grafica**: lampada a sospensione centrale con alone caldo sul pavimento sottostante (`drawPendantLamp`/`drawFloorGlow` in `sprites.ts`) — l'alone è approssimato con cerchi concentrici a opacità decrescente invece di un gradiente radiale nativo, più semplice e sufficiente per l'effetto cercato.

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

> Le due app condividono lo stesso D1 locale tramite la directory di persistenza `.wrangler/state` (il worker con `--persist-to`, Next tramite `initOpenNextCloudflareForDev({ persist })` in `next.config.mjs`). Se l'app web non vede le tabelle, hai saltato `npm run db:migrate:local` — e se cambi `database_id` nei `wrangler.jsonc`/`wrangler.toml` **devi rilanciare** `npm run db:migrate:local`, perché la persistenza locale di Miniflare è indicizzata per `database_id`: un ID nuovo punta a un database locale vuoto anche se il nome è lo stesso.
>
> Per validare la build finale (quella che gira davvero su Cloudflare, non `next dev`): `cd apps/web && npm run preview` compila con OpenNext e la serve con `wrangler dev` — utile prima di un deploy importante, ma ricorda che gira su una porta diversa da 3000, quindi non è nell'`ALLOWED_ORIGINS` di default del worker realtime (aggiungila temporaneamente se ti serve testare il WebSocket da lì).

### Test

```bash
npm test    # vitest-pool-workers: gira nel runtime Workers reale (workerd)
```

I test coprono i deliverable chiave: **2 client WebSocket simultanei** (join reciproco, move broadcast con rifiuto delle tile bloccate, chat, user_left, sostituzione connessione duplicata), acquisto **atomico** (successo, saldo insufficiente senza scritture parziali, item inesistente), credito valuta con log, piazzamento arredi con verifica ownership in tempo reale.

## Deploy su Cloudflare

Ci sono due Worker distinti da deployare (`barlandia` per il web, `barlandia-realtime` per il realtime). Per l'auto-deploy su push hai **due meccanismi equivalenti**, scegli uno per ciascun Worker:

- **Workers Builds** (consigliato): Git integration nativa di Cloudflare per i Worker — dashboard, niente secret su GitHub, stessa UX di Pages ma per Worker veri. **Questo è probabilmente quello che ti aspettavi collegando il repo**: se hai creato un progetto **Pages**, non è questo — Pages è un prodotto diverso che non sa più buildare l'app da quando è passata a OpenNext (fallisce cercando `export const runtime = 'edge'`, che ora non c'è più). Vedi sotto come creare invece un Worker con Git integration.
- **GitHub Actions** (alternativa, già pronta in `.github/workflows/`): utile se preferisci CI esplicita nel repo o se il tuo piano/account non espone ancora Workers Builds.

Deploya prima il realtime, poi il web (il web ha bisogno dell'URL del realtime).

> Se avevi creato un progetto **Pages** per questo repo: eliminalo (Pages non è più il prodotto giusto, da quando l'app è passata a OpenNext continuerebbe a fallire ogni build).

### 0. Setup one-time (dal tuo terminale, con `wrangler login` fatto)

Il database D1 si chiama **`barlandia`** ed è già creato (dashboard Cloudflare → Workers & Pages → D1); il suo `database_id` è già incollato in `apps/realtime/wrangler.toml` e `apps/web/wrangler.jsonc`. Se in futuro lo ricrei da zero:

```bash
npx wrangler login                  # apre il browser, autorizza l'account Cloudflare
npx wrangler d1 create barlandia    # stampa un database_id: aggiornalo in ENTRAMBI i file di config
```

Applica lo schema al database remoto (va rifatto solo quando cambi le migration):

```bash
npm run db:migrate:remote                # applica migrations/*.sql al D1 di produzione
```

Genera un secret lungo e casuale per le sessioni (**deve essere identico** sui due Worker):

```bash
openssl rand -base64 48                  # copia l'output, ti serve nei prossimi due comandi
```

### 1. Worker realtime — deploy manuale iniziale (serve sempre, comunque tu poi automatizzi)

```bash
cd apps/realtime
npx wrangler secret put SESSION_SECRET   # incolla il secret generato sopra
npx wrangler deploy
cd ../..
```

Aggiorna `ALLOWED_ORIGINS` in `apps/realtime/wrangler.toml` con i domini reali (es. `https://barlandia.it,https://www.barlandia.it`) e rideploya se lo cambi dopo.

### 2. App web — deploy manuale iniziale

Prima aggiorna `REALTIME_WS_URL` in `apps/web/wrangler.jsonc` con l'URL vero del worker appena deployato (es. `wss://barlandia-realtime.<tuo-account>.workers.dev`), poi:

```bash
cd apps/web
npx wrangler secret put SESSION_SECRET   # STESSO valore messo nel worker realtime
npm run deploy                            # build OpenNext + wrangler deploy
cd ../..
```

### 3a. Auto-deploy su push — Workers Builds (dashboard, consigliata)

Per **ciascuno** dei due Worker: dashboard Cloudflare → *Workers & Pages* → apri il worker (`barlandia` o `barlandia-realtime`, già esistono dal deploy manuale sopra) → *Settings → Builds → Connect to Git* → seleziona questo repository e il branch di produzione. Configurazione:

| Campo | Worker `barlandia` (web) | Worker `barlandia-realtime` |
|---|---|---|
| Root directory | `apps/web` | `apps/realtime` |
| Build command | `npm run cf:build` | *(vuoto, non serve build)* |
| Deploy command | `npx wrangler deploy` (default) | `npx wrangler deploy` (default) |

Cloudflare installa le dipendenze dalla radice del monorepo automaticamente (rileva gli `npm workspaces`). Da qui in poi ogni push al branch collegato fa auto-deploy di quel Worker, con commit status/PR comment su GitHub — non serve nessun secret su GitHub, Cloudflare ha già le credenziali essendo la sua stessa dashboard.

### 3b. Auto-deploy su push — GitHub Actions (alternativa)

Workflow già pronti in `.github/workflows/deploy-web.yml` e `deploy-realtime.yml`. Su GitHub, in *Settings → Secrets and variables → Actions* del repo, aggiungi:

| Secret | Da dove prenderlo |
|---|---|
| `CLOUDFLARE_API_TOKEN` | dashboard Cloudflare → *My Profile → API Tokens → Create Token* → template "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | dashboard Cloudflare, sidebar destra di qualunque pagina del tuo account |

Girano su push a `main` che tocchi le rispettive app (se il tuo branch di produzione ha un altro nome, cambialo in cima ai file). Non attivare **entrambe** le opzioni per lo stesso Worker: farebbero due deploy ridondanti a ogni push (innocuo ma inutile) — scegline una.

C'è anche `migrate-d1.yml`, **solo manuale** (Actions → *Migra D1 (produzione)* → *Run workflow*): usalo quando cambi lo schema, mai in automatico su ogni push, qualunque opzione tu scelga sopra.

### 4. Domini

Sulla dashboard Cloudflare, apri il worker **`barlandia`** → *Settings → Domains & Routes → Add* → dominio personalizzato `barlandia.it` (e `www.barlandia.it` se vuoi). Se vuoi un dominio pulito anche per il realtime invece di `*.workers.dev` (es. `rt.barlandia.it`), fai lo stesso sul worker `barlandia-realtime` e aggiorna `REALTIME_WS_URL` di conseguenza, poi rideploya l'app web.

La PWA è installabile out-of-the-box (manifest + service worker minimale + icone dalla mascotte; su iOS: Condividi → Aggiungi a Home).

### Nota di sicurezza: perché non Cloudflare Pages + next-on-pages

La prima versione di questo repo usava `@cloudflare/next-on-pages` per deployare su Cloudflare Pages. Durante la messa in produzione è emerso che:

1. `@cloudflare/next-on-pages` è **deprecato** (Cloudflare stessa raccomanda l'adattatore OpenNext) e il suo `package.json` fissa `peerDependencies.next` a `>=14.3.0 && <=15.5.2`.
2. **Next.js 15.5.2 è vulnerabile a CVE-2025-66478**: RCE pre-autenticazione, CVSS 10.0, nel protocollo React Server Components, sfruttabile con una singola richiesta HTTP malformata (multipart/form-data via header `Next-Action`). Colpisce esattamente le app **App Router** come questa; il fix richiede `>=15.5.7`.
3. Non esiste quindi **nessuna versione** che soddisfi contemporaneamente "compatibile con next-on-pages" e "patchata" — sono due vincoli mutuamente esclusivi (`<=15.5.2` vs `>=15.5.7`).

Per questo l'app è stata migrata a **`@opennextjs/cloudflare`**, che deploya su Cloudflare Workers (non più Pages) e supporta Next.js aggiornato. Versione installata: **15.5.20** (patchata contro questa e altre advisory più recenti — verificato con `npm audit` che nessun range vulnerabile della famiglia `next` include questa versione). Il cambio ha richiesto anche di rimuovere `export const runtime = 'edge'` dalle route (OpenNext esegue Next in modalità Node.js-compatibile su Workers via `nodejs_compat`, non nell'edge runtime che serviva a next-on-pages).

**Compromesso dichiarato**: la cache incrementale di Next (ISR) non è configurata (nessun binding R2/KV in `wrangler.jsonc`) perché nessuna pagina di questa fase usa `revalidate` — `/login` e `/bar` sono statiche senza dati lato server. Se in futuro si aggiunge ISR, va configurato un binding R2 e l'override in `apps/web/open-next.config.ts` (vedi commento nel file).

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

Client→server: `move {targetX,targetY}` · `chat {text}` · `heartbeat` · `place_item {inventoryId,x,y}` · `pickup_item {inventoryId}` · `sit {inventoryId}` · `stand` · `emote {emote}`
Server→client: `welcome {self,users,chat,placements,balance,dailyGoals,dailyBonusAwarded}` · `user_joined/left` · `user_moved` · `chat {entry}` · `state_sync {users}` · `item_placed/removed` · `currency_earned {amount,balance}` · `user_sat/stood` · `emote {userId,emote}` · `daily_goals_update {goals,rewardAwarded,balance}` · `badge_earned {badgeId,name,icon}` · `error {code,message}`

API HTTP (Next.js, non WS): `/api/friends` (GET lista, POST richiesta), `/api/friends/respond`, `/api/friends/remove`, `/api/profile` (badge posseduti), `/api/avatar` (PATCH colore), `/api/bacheca` (evento di oggi), `/api/recap` (cartolina della serata).

Definizioni e parsing difensivo in `packages/shared/src/protocol.ts`.
