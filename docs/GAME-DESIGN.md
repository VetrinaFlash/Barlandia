# Barlandia — Game Design Master Plan

> Obiettivo del prodotto: **non far "giocare" gli utenti, ma farli tornare ogni sera per stare insieme.**
> Ogni feature qui sotto è valutata su 5 assi: socializzazione · permanenza media · ritorno giornaliero · viralità · monetizzazione etica.
>
> Le feature marcate **[FOND]** poggiano direttamente sulle fondamenta già implementate in questo repo (stanza DO, valuta Chicchi, shop, inventario). La roadmap consigliata è in fondo al documento.

---

## 1. Le 100 funzionalità

### Stanze pubbliche
1. **Aree del locale** [FOND] — Il bar si espande in aree collegate (sala interna, dehors, angolo giochi, pista, spiaggia estiva): ogni area è un Durable Object separato con lo stesso protocollo WS già in produzione; si passa da un'area all'altra toccando le porte.
2. **Capienza con coda "da locale"** — Ogni area ha capienza massima; oltre, si entra in una coda visibile ("sei 3° in fila") con possibilità di chiacchierare in coda: la scarsità crea l'effetto "locale pieno = locale giusto".
3. **Orari del locale** — Aree che aprono solo in certe fasce (la discoteca apre alle 22): sincronizza gli orari di rientro degli utenti e crea appuntamenti naturali.

### Stanze private
4. **Il tuo tavolo riservato** — Ogni utente può affittare (in Chicchi) un tavolo privato nel bar con 4-8 posti: mini-stanza istanziata, arredabile con gli oggetti già in inventario.
5. **Saletta privata su invito** — Stanza privata creabile al volo con link di invito monouso (deep-link → onboarding): chi non è registrato atterra sulla registrazione con il nome dell'amico che lo aspetta.
6. **Permessi granulari** — Il proprietario decide chi entra (tutti / amici / su bussata), chi può spostare i mobili, chi può usare il jukebox.

### Eventi
7. **Palinsesto settimanale fisso** — Stessa sera, stesso evento (vedi EVENTI-365.md): il karaoke del giovedì deve diventare un'abitudine culturale, non una notifica.
8. **Eventi flash "il barista offre"** — 1-2 volte al giorno, in orario semi-casuale, il barista NPC offre un giro: chi è presente riceve un consumabile cosmetico; chi non c'era lo legge in bacheca (FOMO gentile).
9. **Bacheca del locale** — All'ingresso, una bacheca mostra gli eventi delle prossime 48h e le foto (screenshot) dell'evento di ieri.

### Minigiochi
10. **Biliardino 1v1** [FOND] — L'arredo biliardino già in catalogo diventa interattivo: 2 utenti sulle tile adiacenti avviano una partita arcade semplice (pallina, 2 aste) sincronizzata via DO; gli spettatori vedono il punteggio sopra il tavolo.
11. **Freccette a turni** — Minigioco skill-based con timing (barra che oscilla): torneo automatico ogni sera alle 21.
12. **Tombola del bar** — La domenica sera: cartelle in Chicchi, premi in arredi; il numero viene "chiamato" in chat da un NPC ogni 20 secondi, la sala resta piena mezz'ora.
13. **Quiz a squadre** — Domande di cultura pop italiana proiettate nella stanza, si risponde in chat: le squadre sono i tavoli, premio al tavolo vincente (gioco = pretesto per sedersi insieme).

### Oggetti collezionabili
14. **Tazzine del mese** — Ogni mese una tazzina da collezione ottenibile solo partecipando a N eventi di quel mese: collezione visibile nel profilo, ritirata per sempre a fine mese.
15. **Sottobicchieri dei locali** — Ogni area/evento speciale rilascia un sottobicchiere collezionabile: album stile figurine con contatore di completamento.
16. **Oggetti "vissuti"** — Gli arredi tengono il contatore d'uso ("questo jukebox ha suonato 1.204 canzoni"): il valore affettivo prepara il mercato dell'usato della fase trading.

### Economia
17. **Chicchi (valuta gratuita)** [FOND] — Già implementata: guadagno passivo per presenza attiva + log append-only. Resta l'unica valuta spendibile per arredi comuni.
18. **Gettoni (valuta premium)** — Acquistabili con soldi veri, SOLO per cosmetici/estetica/eventi VIP, mai vantaggi: architettura identica a wallets/currency_transactions (già pronta), tabella separata.
19. **Cambio unidirezionale** — Gettoni→Chicchi possibile (tasso fisso), Chicchi→Gettoni MAI: impedisce il farming a fini di cash-out e tiene i Chicchi inflazionabili senza rischio.
20. **Listino dinamico soft** — Prezzi in Chicchi ritoccati ogni stagione in base ai sink/faucet osservati in `currency_transactions` (il log già presente è lo strumento di misura).

### Missioni
21. **Missioni sociali giornaliere** — "Chiacchiera con 3 persone nuove", "siediti a un tavolo pieno", "balla in pista 5 minuti": ricompense piccole, tutte le missioni spingono a interagire, mai a grindare da soli.
22. **Missione del barista** — Una missione narrativa a settimana raccontata dall'NPC barista ("trova chi ha lasciato questo ombrellino..."): si risolve parlando con gli altri utenti.

### Livelli
23. **Livello "Habitué"** — XP solo da presenza attiva ed eventi (mai da spesa): sblocca titoli e piccole aree (lo sgabello riservato al bancone al liv. 20). Cap giornaliero di XP per non premiare il no-life.

### Badge
24. **Badge da bancone** [FOND] — Tabella `badges` + assegnazione da eventi: mostrati accanto al nome in chat (max 2 equipaggiati). I primi 100 iscritti hanno "Cliente della prima ora".
25. **Badge segreti** — Sbloccati da comportamenti sociali non documentati ("ha fatto conoscere due persone che ora sono amiche"): la community li scopre e ne parla fuori dal gioco (viralità).

### Achievement
26. **Achievement di relazione** — "10 serate con la stessa compagnia", "primo brindisi", "ha organizzato un evento con 20+ presenti": celebrano legami, non numeri.
27. **Vetrina achievement nel profilo** — 3 slot in evidenza scelti dall'utente.

### Club VIP
28. **Tessera del Circolo** — Abbonamento mensile: saletta Circolo (area esclusiva ma visibile dalla vetrata — dentro si vede chi c'è), 2x slot arredi al tavolo, colori chat, nessun vantaggio competitivo.
29. **Ospite del VIP** — Ogni VIP può portare 1 ospite non-VIP per sera nel Circolo: il privilegio più desiderato è poter invitare, e converte più di qualsiasi banner.

### Sistema amici
30. **Amici "da bar"** [FOND] — Richiesta/accettazione, lista con presenza live ("Anna è nel dehors"), tap → raggiungila. Tabella friends + evento presence sul DO già predisponibile.
31. **"Offrigli un caffè"** — Micro-regalo in Chicchi (prezzo fisso, animazione tazzina): il modo più economico di dire "ci sei". Log su currency_transactions come transfer con causale.
32. **Compagnie ricorrenti** — Il sistema riconosce gruppi che si ritrovano spesso e propone "la vostra solita saletta è libera stasera alle 21?"

### Sistema coppie
33. **Tavolino per due** — Due utenti possono dichiararsi "coppia di Barlandia" (consensuale, annullabile): sblocca emote di coppia, cornice profilo, anniversario ricordato dal barista NPC.
34. **Speed date del martedì** — Evento strutturato: tavolini a 2 posti, rotazione ogni 5 minuti al suono della campanella, matching solo per chi si è iscritto.

### Sistema gruppi
35. **Compagnie (gruppi ufficiali)** — Nome, stemma, bacheca, tavolo abituale prenotabile: max 25 membri, si fonda in 3 persone al bancone (rito fondativo in-game).

### Sistema lavoro
36. **Turno da barista** — Gli utenti possono fare un "turno" di 30 min dietro il bancone (servire = consegnare consumabili ordinati dagli altri): paga in Chicchi + badge carriera; slot limitati, si prenotano.
37. **DJ resident** — Candidatura per gestire il jukebox della serata (coda brani): ruolo sociale con visibilità, non paga.

### Sistema commercio
38. **Mercatino dell'usato (fase Trading)** — Scambio 1:1 di arredi tra utenti con conferma a doppio lucchetto ed escrow server-side: da costruire SOLO dopo l'audit della valuta (vedi README), con log scambi append-only e cooldown anti-duplicazione.

### Sistema aste
39. **Asta del venerdì** — Un pezzo unico a settimana (arredo con serial #1-of-1) battuto in Chicchi dal banditore NPC in diretta nella sala grande: sink economico + evento sociale insieme.

### Sistema eventi stagionali
40. **Il locale cambia faccia** — 6 stagioni/anno (Carnevale, Primavera, Estate/spiaggia, Sagra d'autunno, Halloween, Natale): re-skin del locale, catalogo shop a tempo, collezionabile stagionale. Riuso totale dell'infrastruttura, solo asset.

### NPC
41. **Bruno il barista** — NPC sempre presente: dà le missioni, annuncia gli eventi, ricorda il tuo drink preferito ("il solito?"), saluta per nome chi rientra dopo 7+ giorni.
42. **Avventori di contorno** — 2-3 NPC seduti nelle ore morte (4-8 del mattino) così il bar non è mai desolato: spariscono quando i veri utenti superano quota 10.

### Intelligenza artificiale
43. **Bruno risponde (LLM)** — Il barista conversa davvero (small talk, consigli su eventi, spiegazioni del gioco) con persona fissa e limiti stretti: primo soccorso per il nuovo utente solo in stanza.
44. **Matchmaking di compagnia** — Suggerimenti "ti potrebbe piacere il tavolo di..." basati su orari e interazioni ricorrenti, mai automatici: sempre proposta, mai azione.

### Moderazione
45. **Registro chat con ban graduati** — Storico chat per stanza (già persistito nel DO), segnalazione in 2 tap, escalation mute→kick serata→ban: moderatori umani "capo sala" con badge visibile.
46. **Filtro parole italiano + rate limit** [FOND] — Il rate-limit chat esiste già nel DO; si aggiunge lista parole vietate e shadow-throttle per gli spammer.
47. **Modalità tranquilla** — L'utente può rendersi invisibile in lista e disattivare inviti per la serata senza uscire.

### Gamification
48. **Il conto della serata** — A fine sessione, ricevuta stilizzata da bar: "2h al bancone · 14 chiacchiere · 3 nuovi volti · +6 Chicchi": condivisibile come immagine (viralità organica).

### Daily reward
49. **Il caffè di benvenuto** — Il primo ingresso del giorno il barista ti offre il caffè: +Chicchi fissi e visibili, zero rullette. Ritirabile solo entrando in stanza (non da menu).

### Sistema referral
50. **"Porta un amico al bar"** — Link personale; l'amico registrato E presente 3 sere → entrambi ricevono arredo esclusivo "tavolo dell'amicizia" (unico modo per averlo).

### Sistema creator
51. **Serate organizzate dagli utenti** — Chiunque (liv. 10+) può proporre un evento in palinsesto nelle sale pubbliche: il locale promuove i migliori organizzatori con badge "Padrone di casa".

### Sistema streaming
52. **Modalità palco** — In sala eventi, chi è "sul palco" ha bolla chat amplificata e visibile a tutta la sala; integrazione futura con audio (vedi 79).

### Sistema influencer
53. **Serata con ospite** — Eventi co-branded con creator italiani (Twitch/TikTok): stanza dedicata, badge dei presenti, replay in bacheca. L'ospite ha strumenti da palco (54).
54. **Kit dell'ospite** — Strumenti evento per influencer: sondaggi in stanza, faretto su un utente, lancio drop cosmetico ai presenti.

### Classifiche
55. **Classifiche SOLO sociali** — Mai "chi è più ricco": "tavolo più ospitale del mese", "compagnia più assidua", "chi ha fatto più presentazioni": reset mensile, premio cosmetico.

### Avatar
56. **Editor avatar** [FOND] — La tabella `avatar_config` esiste già: editor con corpo/capelli/top/bottom/colore, tutto sbloccato via gioco o shop cosmetico.

### Outfit
57. **Guardaroba con completi salvati** — 5 slot outfit; "outfit della serata" suggerito in base all'evento (elegante per il galà, costume per Halloween).

### Emote
58. **Emote da bar** — Brindisi, cin-cin (a due!), applauso, sbadiglio, ballo: le emote a due persone (richiesta+accettazione) sono il moltiplicatore sociale.

### Animazioni
59. **Sedersi e consumare** — Sedersi sugli sgabelli/sedie (l'arredo diventa funzionale) e drink visibile in mano che si consuma: stare seduti insieme È il gioco.

### Mobili
60. **Set componibili** [FOND] — Il catalogo attuale si estende a "set" (3-5 pezzi coordinati): bonus estetico (luce d'ambiente) se il set è completo nella stessa zona.
61. **Mobili funzionali** — Jukebox (coda musicale), dardi (minigioco), lavagnetta (messaggio del tavolo): ogni mobile di fascia alta DEVE fare qualcosa, non solo apparire.

### Decorazioni
62. **Personalizzazione del tavolo** — Chi affitta il tavolo sceglie tovaglia, centrotavola, luce: visibile a tutti, rinnovo settimanale in Chicchi (sink ricorrente indolore).

### Business virtuali
63. **Gestione chiosco** — Un utente/compagnia può gestire per una settimana il chiosco del dehors (sceglie i 3 consumabili in vendita, incassa il 10%): si vince la gestione all'asta (39).

### Affitti
64. **Affitti a tempo, mai proprietà di rendita** — Tavoli e chiosco si affittano a settimana in Chicchi (sink), non si possiedono per sempre: evita ricchezza passiva e accumulo.

### Eventi live
65. **Serate sincronizzate nazionali** — Capodanno, Sanremo, partite della Nazionale: countdown nella stanza, reazioni collettive, arredo commemorativo per i presenti ("io c'ero").

### Karaoke
66. **Karaoke del giovedì** — Testo sincronizzato proiettato in sala, chi è sul palco "canta" (audio opzionale, fase 2 vocale), il pubblico vota con applausi: la serata più social possibile a costo tecnico basso (testo + timing).

### Quiz
67. **Quiz "Lo sai che ore sono?"** — Format fisso di 15 domande la mercoledì sera con conduttore NPC: iscrizione a squadre dal tavolo.

### Tornei
68. **Torneo di biliardino mensile** — Bracket automatico, finale il sabato sera con spettatori attorno al tavolo, coppa esposta al tavolo del vincitore per un mese (decoro temporaneo).

### Escape room
69. **La cantina misteriosa** — Escape room a squadre di 4 (enigmi ambientali + oggetti da combinare), rotazione trimestrale: contenuto premium co-op, si entra solo in gruppo.

### Casinò fittizio (senza soldi reali)
70. **Angolo scopa & briscola** — Carte italiane 1v1/2v2 giocando SOLO Chicchi con cap giornaliero di perdita e zero conversione in premium: il gioco è il pretesto, il tavolo è il punto.

### Sala cinema
71. **Cineforum della domenica** — Sala buia con schermo (contenuti liberi/di pubblico dominio o watch-party sincronizzato), chat in stile "commento dal divano".

### DJ Set
72. **Consolle con coda democratica** — Il jukebox della pista: chiunque propone brani (metadati/preview), la sala vota, il DJ resident (37) ordina la coda.

### Concerti
73. **Live in miniatura** — Artisti emergenti italiani fanno mini-live (audio streaming) sul palco: biglietto in Gettoni a prezzo pop, metà all'artista.

### Festa di compleanno
74. **La torta a sorpresa** — Al compleanno (opt-in), quando l'utente entra il locale si spegne e parte la sorpresa: candeline, coro degli presenti, badge per chi c'era. Nessuno dimentica il proprio compleanno a Barlandia.

### Speed date
75. **(vedi 34)** + **Secondo appuntamento** — Se entrambi votano "mi è piaciuto parlare", il sistema regala un tavolo riservato gratuito valido 7 giorni.

### Chat vocale opzionale
76. **Tavoli vocali** — Audio opt-in SOLO ai tavoli privati e sul palco (mai in sala grande), push-to-talk, moderabile dal proprietario del tavolo.

### Reputazione utenti
77. **Reputazione "buon avventore"** — Score invisibile agli altri (anti-gogna) basato su segnalazioni/mute ricevuti e ospitalità: sblocca privilegi (organizzare eventi) e modula la visibilità dei contenuti.

### Clan
78. **(vedi Compagnie, 35)** + **Derby delle compagnie** — Sfida mensile a punti tra compagnie (presenze agli eventi, tornei, ospitalità): la competizione tra gruppi è il retention loop più potente.

### Obiettivi giornalieri
79. **Tris del giorno** — 3 obiettivi leggeri (1 social, 1 evento, 1 libero), completabili in ~20 min di presenza: completare il tris = bonus Chicchi; niente streak punitive sul tris.

### Battle Pass
80. **"Stagione al Bancone"** — Pass stagionale (8 settimane): binario gratuito + premium (Gettoni), SOLO cosmetici/emote/arredi; XP dal tris del giorno e dagli eventi, MAI dalla spesa. Prezzo pop (vedi monetizzazione).

### Marketplace
81. **Bacheca annunci (fase Trading)** — Vetrina "cerco/offro" testuale PRIMA del trading vero: gli utenti si accordano socialmente, lo scambio si finalizza col sistema escrow (38) quando sarà pronto.

### Retention meccaniche (trasversali)
82. **Streak morbida "settimana da habitué"** — 4 sere su 7 = premio settimanale; la streak non si azzera mai brutalmente (si "raffredda"): rispetto per la vita reale, zero ansia.
83. **Rientro senza colpa** — Dopo 7+ giorni di assenza: "Bruno ti ha tenuto il posto" + riepilogo di cosa è successo; mai punizioni per l'assenza.
84. **Notifiche intelligenti (max 1/giorno)** — Solo eventi rilevanti per TE: "i tuoi amici Anna e Marco sono al bar adesso" batte qualsiasi notifica generica. Cap rigido e orari rispettosi (mai dopo le 23).
85. **Ricorrenze personali** — Il locale ricorda: primo ingresso ("un anno fa entravi qui"), anniversari di coppia/compagnia, con piccolo omaggio.
86. **Premio mensile "foto di gruppo"** — L'ultimo sabato del mese, foto di gruppo ufficiale in sala grande: chi c'è finisce nel quadro appeso nel locale per tutto il mese successivo.

### Viralità (trasversali)
87. **Cartolina da Barlandia** — Screenshot stilizzato del tuo tavolo/serata con cornice e logo, condivisibile in una tap su WhatsApp/Instagram: il contenuto virale è "guarda con chi sono", non "guarda cosa ho vinto".
88. **Invito-evento** — Ogni evento ha link condivisibile con anteprima ricca ("Giovedì karaoke, tavolo di Anna — 3 posti liberi"): l'invito è a un momento, non all'app.
89. **Gemellaggi tra compagnie** — Due compagnie possono gemellarsi e sfidarsi: le sfide tra gruppi reali (classe, ufficio, gruppo Telegram) importano utenti a blocchi.
90. **Vetrina pubblica web** — Pagina pubblica read-only del locale (chi c'è ora, prossimi eventi) embeddabile/linkabile: barlandia.it/stasera come locandina sempre fresca.

### Monetizzazione etica (trasversali)
91. **Gettoni solo estetica** — (vedi 18) Nessun oggetto premium dà vantaggi: la regola è pubblica e scritta nel gioco.
92. **Prezzi pop trasparenti** — Punti prezzo bassi e chiari, niente bundle ingannevoli né valuta "spezzata" per confondere (i Gettoni hanno tagli che corrispondono esattamente ai prezzi del catalogo).
93. **Regalo trasparente** — Qualsiasi acquisto può essere regalato a un amico con biglietto: il regalo è il motore di acquisto più etico che esista.
94. **Zero loot box** — Mai acquisti a esito casuale con denaro reale: le "sorprese" esistono solo gratis (drop eventi).

### Onboarding (bonus fondamentale)
95. **Primo giorno da cliente nuovo** — Percorso guidato dal barista in 5 minuti: muoviti → siediti → parla → personalizza → torna domani per il caffè offerto. Ogni passo è un'interazione reale, non un tutorial screen.
96. **Padrini di sala** — Utenti veterani volontari (badge "Padrino/Madrina di sala") ricevono i nuovi nel loro primo quarto d'ora: l'onboarding migliore è una persona.

### Qualità della vita
97. **Cross-device senza attriti** [FOND] — Sessione cookie 30gg + PWA già pronte: si continua dal telefono ciò che si è iniziato dal PC senza login ripetuti.
98. **Modalità una mano** — Tutta l'UI critica (chat, move, emote rapide) raggiungibile col pollice: già impostata così, va difesa come principio.
99. **Trasparenza economica personale** — Estratto conto Chicchi consultabile (il log `currency_transactions` già esiste): fiducia = retention.
100. **Uscita di scena** — Chiusura account con export dati e "brindisi d'addio" pubblico opzionale: chi esce bene, torna; chi esce male, recensisce male.

---

## 2. Economia virtuale

### Le due valute

| | **Chicchi** (gratuita) [FOND] | **Gettoni** (premium) |
|---|---|---|
| Fonte | Presenza attiva, missioni, eventi, tornei | Solo acquisto reale (o cambio da regali) |
| Spesa | Arredi comuni, affitti, consumabili, aste | Cosmetici premium, Battle Pass, eventi VIP, regali |
| Trasferibile | Micro-regali cappati (31); trading solo oggetti, mai valuta | Mai tra utenti (solo regalo di OGGETTI acquistati) |
| Cambio | ← Gettoni→Chicchi a tasso fisso; **mai il contrario** | — |

### Rarità (solo oggetti, mai potenza)

| Tier | Fonte | Quantità | Esempio |
|---|---|---|---|
| Comune | Shop Chicchi, sempre disponibile | Illimitata | Sgabello, pianta |
| Raro | Shop stagionale, missioni lunghe | Rotazione (esce dal catalogo) | Jukebox anni '50 |
| Epico | Eventi (presenza richiesta), tornei | Solo chi c'era | Tazzina del mese |
| Leggendario | Aste settimanali, derby | Serializzato (#1 di 1, #1-100) | Insegna del locale, coppa |
| Limited | Collab/ricorrenze nazionali | Finestra 24-72h, mai ristampato | Arredo Sanremo 2027 |

Regole dure: i limited **non tornano mai** (fiducia = valore); ogni oggetto non-comune ha **serial number** in tabella (`inventory.serial`) — prerequisito anti-duplicazione per il trading.

### Anti-inflazione: faucet e sink

Faucet (entrata Chicchi) misurabili dal log esistente: presenza (~12/h attivi, cappata), tris del giorno, eventi, welcome bonus.

**Sink senza frustrazione** (tolgono valuta dando in cambio momenti, non potenza):
1. **Affitti settimanali** (tavolo, chiosco): il sink ricorrente principale — si paga per ospitare, cioè per socializzare.
2. **Consumabili sociali**: offrire un giro al tavolo, caffè sospeso a uno sconosciuto (arriva a un utente random al suo login: gentilezza istituzionalizzata).
3. **Aste settimanali**: drenano i grandi saldi dei top earner senza toccare i casual.
4. **Personalizzazioni a tempo** (tovaglia del tavolo, dedica sul jukebox, riga in bacheca).
5. **Iscrizioni a tornei/tombola** (montepremi parzialmente redistribuito: il resto brucia).
6. **Rinnovo estetico stagionale** (ri-colorazione arredi al cambio stagione, opzionale).

### Anti-exploit

- **Unica via di scrittura saldi** [FOND]: già implementata (`creditCurrency`/`purchaseItem`, batch atomici, log append-only, CHECK ≥ 0).
- **Cap giornalieri** su ogni faucet (presenza, missioni, vincite ai tavoli).
- **Presenza "provata"**: prima del trading, il guadagno passivo va ancorato a interazioni reali (chat/move/eventi) e non al solo heartbeat (compromesso dichiarato nel README).
- **Multi-account**: 1 connessione per utente già forzata dal DO; si aggiungono fingerprint soft + cap benefit referral per device/IP.
- **Trading (fase futura)**: escrow server-side a doppia conferma, transazione D1 unica, serial number verificato, cooldown 48h sui limited appena ricevuti, log scambi immutabile.
- **Monitoraggio**: dashboard settimanale su `currency_transactions` (emissione vs distruzione, Gini dei saldi): se l'emissione supera la distruzione per 3 settimane, si alza un sink, MAI si tagliano i saldi.

---

## 3. Sistema retention ("impossibile da abbandonare", senza dark pattern)

| Sistema | Meccanica | Cadenza |
|---|---|---|
| Caffè di benvenuto (49) | +Chicchi fissi al primo ingresso del giorno, dal barista in stanza | Giornaliera |
| Tris del giorno (79) | 3 obiettivi leggeri, 1 social garantito | Giornaliera |
| Streak morbida (82) | 4 sere/7 = premio; si raffredda, non si azzera | Settimanale |
| Palinsesto fisso (7) | Karaoke gio · asta ven · torneo sab · tombola/cinema dom | Settimanale |
| Eventi flash (8) | "Il barista offre" in orario semi-casuale | 1-2/giorno |
| Foto di gruppo (86) | Quadro del mese con chi c'era | Mensile |
| Ricorrenze (85) | Compleanni, anniversari, "un anno qui" | Personale |
| Notifiche intelligenti (84) | Solo amici-presenti ed eventi tuoi; max 1/giorno, mai dopo le 23 | Al bisogno |
| Premi amici/referral (50) | Ricompensa a ENTRAMBI, legata alla presenza (3 sere), non al click | Continua |
| Rientro senza colpa (83) | Recap + posto tenuto, zero punizioni | Al rientro |

Principio: **ogni ritorno deve essere premiato con persone, non solo con numeri** — la notifica migliore è "i tuoi amici sono lì adesso".

---

## 4. Sistema virale

1. **Referral con prova sociale (50)**: premio a entrambi, condizionato a 3 presenze (utente reale, non install).
2. **Invito-evento (88)**: si condivide un momento con posti limitati, non un link generico.
3. **Cartolina della serata (87) e conto della serata (48)**: contenuto condivisibile generato da OGNI sessione.
4. **Sfide tra gruppi reali (89)**: derby e gemellaggi importano community esterne intere.
5. **Badge/titoli/arredi solo-da-invito**: il "tavolo dell'amicizia" esiste solo in coppia con un invitato.
6. **Stanze VIP con vetrata (28)**: l'esclusività visibile (non nascosta) genera desiderio raccontabile.
7. **Vetrina pubblica (90)**: barlandia.it/stasera linkabile ovunque come locandina.
8. **Classifiche sociali mensili (55)**: dare gloria condivisibile a comportamenti ospitali.

---

## 5. Monetizzazione etica (mai pay-to-win)

Stime per il mercato italiano mobile; da validare coi dati reali.

| Elemento | Prezzo ideale | Frequenza | Prob. acquisto (attivi) | Impatto |
|---|---|---|---|---|
| Tessera Circolo VIP (28) | 4,99 €/mese | Mensile | 3-5% | Status + saletta; zero vantaggi |
| Battle Pass stagionale (80) | 6,99 € / stagione (8 sett.) | 6/anno | 8-12% | Obiettivo di lungo periodo, solo cosmetici |
| Bundle stagione (pass + outfit) | 9,99 € | 6/anno | 3-4% | Convenienza trasparente, contenuto visibile |
| Oggetti limited (94→limited gratis, premium solo non-random) | 1,99-4,99 € | 24-72h, ~1/mese | 5-8% | Collezionismo; mai ristampe |
| Decorazioni premium tavolo | 0,99-2,99 € | Catalogo continuo | 10-15% (long tail) | Espressione personale visibile agli ospiti |
| Effetti chat (colore, entrata scenica) | 0,99-1,99 € | Continuo | 5-8% | Visibilità sociale leggera |
| Emoji/emote premium (set) | 1,99 € /set | 1 set/mese | 6-10% | Le emote a 2 spingono l'amico a volerle |
| Outfit completi | 2,99-5,99 € | 2-3/mese | 8-12% | Core dell'identità avatar |
| Animazioni (balli, brindisi speciali) | 1,99-3,99 € | 1-2/mese | 5-8% | Performativa: si vede in pista |
| Mascotte/Pet da tavolo | 3,99-6,99 € | 1/stagione | 4-6% | Compagnia visibile, reagisce agli amici |
| Casa/tavolo premium (skin saletta) | 4,99-7,99 € | 1/stagione | 3-5% | Ospitalità di prestigio |
| Mobili esclusivi premium | 2,99-5,99 € | 2-3/mese | 5-8% | Arredo che "fa qualcosa" (61) |
| Eventi VIP (concerti 73, escape 69) | 1,99-3,99 € /biglietto | 1-2/mese | 5-10% | Paghi un'esperienza, non un potere |
| Gettoni (taglio base) | 4,99 € = taglio esatto | — | — | Tagli = prezzi catalogo, zero resti |

Regole: prezzi pieni e chiari (92), tutto regalabile (93), zero loot box (94), spesa mensile media target BASSA e ampia (tanti da 5€, nessuna balena spremuta: cap di spesa mensile soft con avviso gentile).

---

## 6. Cosa implementare da subito (roadmap sulle fondamenta esistenti)

Le fondamenta di questo repo coprono: stanza DO realtime, auth, Chicchi con log, shop atomico, piazzamento arredi, PWA.

**Sprint 1 — "La serata tipo" (retention di base) — ✅ implementato**
1. Caffè di benvenuto giornaliero (49) — `awardDailyBonus`, reason `caffe_giornaliero`, guardia atomica 1/giorno via `daily_bonus_claims`.
2. Tris del giorno (79) — tabella `daily_goals`, 3 obiettivi: chat (3 messaggi), presenza (2 tick del guadagno passivo), emote (1). Premio unico a soglie raggiunte.
3. Sedersi sugli sgabelli (59) — stato `seatedOn` nell'attachment del DO, tap su arredo categoria `seduta`, occupazione esclusiva, alzata automatica quando ci si muove.
4. Emote base (58) — messaggio WS `emote` (wave/cheers/dance/clap), validato e rate-limited come la chat. La versione "a due" (richiesta/conferma tra utenti) resta da fare in uno sprint successivo: qui sono emote singole senza handshake.

Dettagli implementativi e compromessi in README, sezione "Sprint 1".

**Sprint 2 — "Le persone" (social graph) — ✅ implementato (parziale)**
5. Amici con presenza (30) — richiesta/accetta/rimuovi per username, presenza calcolata lato client dalla lista utenti già ricevuta via WebSocket (nessuna nuova infrastruttura: c'è un'unica stanza, "online" == "connesso al DO"). **"Offrigli un caffè" (31) NON implementato**: è un trasferimento di valuta P2P, esplicitamente fuori scope insieme al resto del trading fino alla fase di audit dedicata (vedi handoff originale) — anche in forma di "regalo" unidirezionale tocca lo stesso codice sensibile e merita lo stesso scrutinio.
6. Profilo con badge (24) e primi 3 badge: primi_100 (registrazione), prima_serata (primo tris del giorno completato), primo_brindisi (prima emote cheers). Assegnazione idempotente via `awardBadge` (INSERT OR IGNORE), mai valuta coinvolta.
7. Editor avatar (56) — solo colore per ora (6 schemi già esistenti in `AVATAR_COLOR_SCHEMES`); `avatar_config` supporta anche body/hair/top/bottom ma servirebbero asset e logica di disegno che non esistono ancora nel motore procedurale.

**Sprint 3 — "L'appuntamento" (eventi) — ✅ implementato (parziale)**
8. Bacheca (9) — mostra l'evento di oggi dal palinsesto fisso, stessa logica di `docs/EVENTI-365.md` ricalcolata a runtime per la data reale (`eventoDelGiorno` in `packages/shared/src/eventi.ts`). **Il "primo format" giocabile (karaoke/quiz, item 66/67) NON è implementato**: è un minigioco vero e proprio, e i minigiochi sono esplicitamente fuori scope nell'handoff originale di Fase 1 — la bacheca oggi è solo informativa (mostra cosa "succederebbe" stasera), non ospita ancora un format interattivo.
9. **Notifica intelligente (84) NON implementata**: richiede un'infrastruttura Web Push (VAPID keys, service worker con push handler, storage delle subscription, gestione dei permessi) che non esiste ancora e merita un giro dedicato — specialmente per le differenze di supporto tra iOS/Android/desktop, che vanno testate con cura e non improvvisate.
10. Cartolina della serata (87) — riepilogo di oggi (minuti di presenza stimati, tris del giorno, saldo, badge guadagnati oggi, evento della serata) in una card in stile "cartolina". Nessuna esportazione automatica in immagine: l'utente fa uno screenshot per condividerla — scelta deliberata per evitare di introdurre una libreria di rendering canvas-to-image solo per questo.

**Sprint 4 — "L'abitudine" (progressione) — ✅ implementato**
11. Livello "Habitué" (23) — XP solo da presenza attiva ed eventi (tick di presenza, tris del giorno completato, badge guadagnati), MAI dalla spesa; cap giornaliero per non premiare chi resta collegato H24. 7 livelli con titolo a tema bar, pillola in HUD, dettaglio con barra di progresso nel profilo. Dettagli e compromesso dichiarato in README, sezione "Sprint 4".

**Sprint 5 — "Il posto di lavoro" (vestiario, identità, mestiere) — ✅ implementato**
12. Editor avatar esteso (56) — vestiario (maglia/gilet/papillon/grembiule) oltre al colore, riusando la colonna `top` già presente in `avatar_config`.
13. Livello visibile sopra l'avatar (estensione di 23) — non solo in HUD/profilo: ogni utente vede il livello di tutti gli altri, sempre, sopra il nome.
14. Turno da barista (36) — postazione di lavoro fissa dove timbrare per guadagnare Chicchi a un ritmo maggiore della presenza passiva; occupazione esclusiva, turno massimo 15 minuti, nessuno scambio tra utenti. Dettagli e compromessi dichiarati in README, sezione "Sprint 5".

**Sprint 6 — "Il gruppo" (compagnie) — ✅ implementato (parziale)**
15. Compagnie (35) — gruppi con nome, stemma, motto, fino a 25 membri; inviti per username con accetta/rifiuta come il sistema amici. **Semplificazioni dichiarate**: niente rito fondativo a tre persone al bancone (si fonda da soli), niente tavolo abituale prenotabile (dipende da stanze private non ancora costruite), stemma non visibile sopra l'avatar in stanza. Dettagli in README, sezione "Sprint 6".

**Poi**: seconda area del locale (1), stagione 1 con catalogo a rotazione (40), rito fondativo delle compagnie, derby tra compagnie (78) — e SOLO dopo l'audit valuta: Gettoni (18), trading con escrow (38), aste (39).

> Nota: il calendario completo dei 365 eventi è in `docs/EVENTI-365.md` (generato da `scripts/genera-eventi.mjs`, modificabile e rigenerabile).
