/**
 * Genera docs/EVENTI-365.md: un evento per ogni giorno dell'anno.
 *
 * Logica: palinsesto settimanale fisso (l'abitudine è la feature) +
 * override per ricorrenze italiane e momenti speciali. Anno di
 * riferimento: 2027 (non bisestile). Rigenera con:
 *   node scripts/genera-eventi.mjs
 */
import { writeFileSync } from 'node:fs';

const ANNO = 2027;
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

// Palinsesto settimanale base (0 = domenica)
const BASE = [
  ['Tombola del bar + Cineforum della domenica', 'Tombola · Cinema', 'chiudere la settimana insieme, ritmo lento'],
  ['Caffè del lunedì: quiz di riscaldamento', 'Quiz soft', 'far ripartire la settimana senza pressione'],
  ['Speed date & nuove conoscenze', 'Speed date', 'creare legami nuovi a metà serata'],
  ['«Lo sai che ore sono?» — quiz a squadre', 'Quiz', 'far sedere le squadre agli stessi tavoli'],
  ['Karaoke del giovedì', 'Karaoke', 'la serata-rito: palco, pubblico, applausi'],
  ['Asta del venerdì + DJ set', 'Asta · DJ set', 'evento-vetrina con pezzo unico e pista'],
  ['Serata a tema + torneo', 'Festa · Torneo', 'il sabato è la festa grande della settimana'],
];

// Temi che ruotano sui sabati (festa) e sui tornei
const TEMI_SABATO = [
  "Festa anni '90", 'Notte italiana (hit nostrane)', "Festa anni 2000", 'Serata latina',
  'Disco night', 'Rock al bancone', 'Cantautori sotto le stelle', 'Revival estate',
];
const TORNEI = ['torneo di biliardino', 'torneo di freccette', 'torneo di scopa', 'torneo di briscola'];

// Override per data fissa: 'M-D': [nome, formato, obiettivo]
const SPECIALI = {
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

// Settimane speciali (range M-D → M-D): prefisso al nome dell'evento base
const SETTIMANE = [
  { da: [2, 2], a: [2, 6], tag: 'Settimana di Sanremo: ', obiettivo: 'commento live in sala, televoto del bar' },
  { da: [2, 8], a: [2, 9], tag: 'Carnevale: ', obiettivo: 'maschere per tutti, sfilata in pista' },
  { da: [3, 26], a: [3, 28], tag: 'Weekend di Pasqua: ', obiettivo: 'caccia alle uova tra i tavoli' },
  { da: [5, 10], a: [5, 15], tag: 'Eurovision week: ', obiettivo: 'watch-party e classifica del bar' },
  { da: [11, 26], a: [11, 26], tag: 'Black Friday al contrario: ', obiettivo: 'lo shop REGALA un oggetto a chi è presente' },
];

function inRange(m, d, [m1, d1], [m2, d2]) {
  const v = m * 100 + d;
  return v >= m1 * 100 + d1 && v <= m2 * 100 + d2;
}

let out = `# Barlandia — Calendario eventi (365 giorni, anno tipo ${ANNO})

> Generato da \`scripts/genera-eventi.mjs\` — modifica lo script e rigenera.
> Regola d'oro: il palinsesto settimanale è FISSO (l'abitudine è la feature);
> le ricorrenze italiane lo sovrascrivono. Ogni evento dichiara il suo
> obiettivo di permanenza/socialità.

`;

let sabato = 0;
let torneo = 0;
let counter = 0;

for (let m = 0; m < 12; m++) {
  out += `\n## ${MESI[m]}\n\n| Giorno | Data | Evento | Formato | Obiettivo |\n|---|---|---|---|---|\n`;
  const giorniNelMese = new Date(ANNO, m + 1, 0).getDate();
  for (let d = 1; d <= giorniNelMese; d++) {
    counter++;
    const dow = new Date(ANNO, m, d).getDay();
    let [nome, formato, obiettivo] = BASE[dow];

    // rotazioni del sabato
    if (dow === 6) {
      nome = `${TEMI_SABATO[sabato % TEMI_SABATO.length]} + ${TORNEI[torneo % TORNEI.length]}`;
      sabato++;
      if (d > 21) torneo++; // finale mensile: cambia gioco al mese
    }
    // ultimo sabato del mese: foto di gruppo
    if (dow === 6 && d + 7 > giorniNelMese) {
      nome += ' · Foto di gruppo del mese';
      obiettivo = 'chi c’è finisce nel quadro del locale per un mese';
    }

    // settimane speciali
    for (const s of SETTIMANE) {
      if (inRange(m + 1, d, s.da, s.a)) {
        nome = s.tag + nome;
        obiettivo = s.obiettivo;
      }
    }
    // giorni speciali (override totale)
    const sp = SPECIALI[`${m + 1}-${d}`];
    if (sp) [nome, formato, obiettivo] = sp;

    out += `| ${GIORNI[dow]} | ${d} ${MESI[m].toLowerCase()} | ${nome} | ${formato} | ${obiettivo} |\n`;
  }
}

out += `\n---\n\n*Totale: ${counter} giorni.*\n`;
writeFileSync(new URL('../docs/EVENTI-365.md', import.meta.url), out);
console.log(`generati ${counter} eventi in docs/EVENTI-365.md`);
