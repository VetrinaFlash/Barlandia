/**
 * Palinsesto settimanale fisso + ricorrenze italiane — versione a
 * runtime (per la "bacheca"/"cartolina") della stessa logica usata da
 * `scripts/genera-eventi.mjs` per generare `docs/EVENTI-365.md`.
 *
 * Duplicazione deliberata: lo script resta JavaScript puro (nessuna
 * dipendenza da build step, si lancia con `node` e basta, per
 * rigenerare la doc offline); questo modulo è la versione TypeScript
 * usata dall'app. Se cambi il palinsesto in uno dei due posti,
 * aggiorna anche l'altro.
 *
 * "Oggi" è ancorato a UTC (come daily_goals/daily_bonus_claims), non
 * al fuso orario locale del client o del runtime del Worker.
 */

export interface EventoGiorno {
  nome: string;
  formato: string;
  obiettivo: string;
}

const BASE: readonly [string, string, string][] = [
  ['Tombola del bar + Cineforum della domenica', 'Tombola · Cinema', 'chiudere la settimana insieme, ritmo lento'],
  ['Caffè del lunedì: quiz di riscaldamento', 'Quiz soft', 'far ripartire la settimana senza pressione'],
  ['Speed date & nuove conoscenze', 'Speed date', 'creare legami nuovi a metà serata'],
  ['«Lo sai che ore sono?» — quiz a squadre', 'Quiz', 'far sedere le squadre agli stessi tavoli'],
  ['Karaoke del giovedì', 'Karaoke', 'la serata-rito: palco, pubblico, applausi'],
  ['Asta del venerdì + DJ set', 'Asta · DJ set', 'evento-vetrina con pezzo unico e pista'],
  ['Serata a tema + torneo', 'Festa · Torneo', 'il sabato è la festa grande della settimana'],
];

const TEMI_SABATO: readonly string[] = [
  "Festa anni '90", 'Notte italiana (hit nostrane)', 'Festa anni 2000', 'Serata latina',
  'Disco night', 'Rock al bancone', 'Cantautori sotto le stelle', 'Revival estate',
];
const TORNEI: readonly string[] = [
  'torneo di biliardino', 'torneo di freccette', 'torneo di scopa', 'torneo di briscola',
];

/** Override per data fissa (mese-giorno, es. Natale, Ferragosto). */
const SPECIALI: Record<string, readonly [string, string, string]> = {
  '1-1': ['Brindisi di Capodanno: il primo caffè dell’anno', 'Evento live', 'aprire l’anno tutti insieme, arredo “io c’ero”'],
  '1-6': ['La Befana al bar: calza per tutti i presenti', 'Evento stagionale', 'regalo di presenza, richiamo famiglie'],
  '1-17': ['Sant’Antonio: falò del dehors', 'Evento stagionale', 'tradizione popolare, foto di gruppo'],
  '2-14': ['San Valentino: tavolini per due', 'Coppie', 'emote di coppia, secondo appuntamento in regalo'],
  '3-8': ['Festa della donna: mimosa per tutte', 'Evento', 'omaggio cosmetico, palco alle utenti'],
  '3-19': ['Festa del papà: brindisi con Bruno', 'Evento', 'ricorrenza calda, missione dedicata'],
  '4-1': ['Pesce d’aprile: il bar al contrario', 'Evento segreto', 'scherzo visivo (stanza specchiata), viralità'],
  '4-25': ['25 aprile: Bella Ciao al jukebox', 'Evento live', 'memoria condivisa, playlist a tema'],
  '5-1': ['Concertone del Primo Maggio', 'Concerto', 'live in miniatura, biglietto pop'],
  '6-2': ['Festa della Repubblica: tricolore al bancone', 'Evento', 'decoro a tempo, quiz sull’Italia'],
  '6-21': ['Festa della musica: open mic', 'Palco aperto', 'chiunque sul palco per 3 minuti'],
  '7-15': ['Notte bianca di mezza estate', 'Evento live', 'orari estesi, area spiaggia aperta'],
  '8-10': ['Notte di San Lorenzo: stelle dal dehors', 'Evento', 'cielo animato, desideri in bacheca'],
  '8-15': ['Ferragosto in spiaggia', 'Festa', 'picco estivo, collezionabile limited'],
  '10-31': ['Halloween: il bar stregato', 'Festa stagionale', 'costumi, caccia al fantasma del locale'],
  '11-1': ['Ognissanti: cioccolata calda per tutti', 'Evento soft', 'serata lenta post-Halloween'],
  '12-8': ['Si accende l’albero del bar', 'Evento stagionale', 'inizio stagione natalizia, addobbi'],
  '12-24': ['Vigilia: panettone e tombolata', 'Festa', 'appuntamento con la famiglia di Barlandia'],
  '12-25': ['Natale al bar: regalo sotto l’albero', 'Evento', 'regalo di presenza, saluti registrati'],
  '12-26': ['Santo Stefano: maratona giochi', 'Tornei', 'digestione ludica, tutti i minigiochi'],
  '12-31': ['San Silvestro: countdown in sala grande', 'Evento live', 'la notte più affollata dell’anno'],
};

/**
 * Settimane speciali (range mese-giorno → mese-giorno): prefisso al
 * nome dell'evento base. NOTA: Pasqua/Carnevale sono a data fissa
 * (calendario 2027 illustrativo), non calcolate con l'algoritmo della
 * Pasqua mobile — approssimazione accettata per una feature di colore,
 * da rivedere se in futuro serve precisione sugli anni reali.
 */
const SETTIMANE: readonly { da: [number, number]; a: [number, number]; tag: string; obiettivo: string }[] = [
  { da: [2, 2], a: [2, 6], tag: 'Settimana di Sanremo: ', obiettivo: 'commento live in sala, televoto del bar' },
  { da: [2, 8], a: [2, 9], tag: 'Carnevale: ', obiettivo: 'maschere per tutti, sfilata in pista' },
  { da: [3, 26], a: [3, 28], tag: 'Weekend di Pasqua: ', obiettivo: 'caccia alle uova tra i tavoli' },
  { da: [5, 10], a: [5, 15], tag: 'Eurovision week: ', obiettivo: 'watch-party e classifica del bar' },
  { da: [11, 26], a: [11, 26], tag: 'Black Friday al contrario: ', obiettivo: 'lo shop REGALA un oggetto a chi è presente' },
];

function inRange(m: number, d: number, [m1, d1]: [number, number], [m2, d2]: [number, number]): boolean {
  const v = m * 100 + d;
  return v >= m1 * 100 + d1 && v <= m2 * 100 + d2;
}

function giorniNelMeseUTC(anno: number, meseZeroBased: number): number {
  return new Date(Date.UTC(anno, meseZeroBased + 1, 0)).getUTCDate();
}

function weekdayUTC(anno: number, meseZeroBased: number, giorno: number): number {
  return new Date(Date.UTC(anno, meseZeroBased, giorno)).getUTCDay();
}

/**
 * Evento del giorno per una data reale (UTC). Le rotazioni del sabato
 * (tema + torneo) dipendono da quanti sabati sono già passati
 * dall'inizio dell'anno: le ricalcoliamo iterando da gennaio, come fa
 * lo script che genera docs/EVENTI-365.md — costo trascurabile (al
 * più 365 iterazioni).
 */
export function eventoDelGiorno(date: Date): EventoGiorno {
  const anno = date.getUTCFullYear();
  const meseTarget = date.getUTCMonth();
  const giornoTarget = date.getUTCDate();

  let sabato = 0;
  let torneo = 0;
  let risultato: EventoGiorno | null = null;

  for (let m = 0; m <= meseTarget; m++) {
    const giorniNelMese = giorniNelMeseUTC(anno, m);
    const ultimoGiorno = m === meseTarget ? giornoTarget : giorniNelMese;
    for (let d = 1; d <= ultimoGiorno; d++) {
      const dow = weekdayUTC(anno, m, d);
      let [nome, formato, obiettivo] = BASE[dow]!;

      if (dow === 6) {
        nome = `${TEMI_SABATO[sabato % TEMI_SABATO.length]} + ${TORNEI[torneo % TORNEI.length]}`;
        sabato++;
        if (d > 21) torneo++;
      }
      if (dow === 6 && d + 7 > giorniNelMese) {
        nome += ' · Foto di gruppo del mese';
        obiettivo = 'chi c’è finisce nel quadro del locale per un mese';
      }
      for (const s of SETTIMANE) {
        if (inRange(m + 1, d, s.da, s.a)) {
          nome = s.tag + nome;
          obiettivo = s.obiettivo;
        }
      }
      const sp = SPECIALI[`${m + 1}-${d}`];
      if (sp) [nome, formato, obiettivo] = sp;

      risultato = { nome, formato, obiettivo };
    }
  }
  return risultato!;
}
