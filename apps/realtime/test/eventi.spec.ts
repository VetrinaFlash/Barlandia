/**
 * eventoDelGiorno deve produrre esattamente le stesse righe della doc
 * generata da scripts/genera-eventi.mjs (anno di riferimento 2027) —
 * le due implementazioni sono duplicate di proposito (vedi
 * packages/shared/src/eventi.ts) e non devono divergere.
 */
import { describe, expect, it } from 'vitest';
import { eventoDelGiorno } from '@barlandia/shared';

function utc(mese1based: number, giorno: number): Date {
  return new Date(Date.UTC(2027, mese1based - 1, giorno));
}

describe('eventoDelGiorno', () => {
  it('giorno speciale a data fissa: Capodanno', () => {
    expect(eventoDelGiorno(utc(1, 1))).toEqual({
      nome: 'Brindisi di Capodanno: il primo caffè dell’anno',
      formato: 'Evento live',
      obiettivo: 'aprire l’anno tutti insieme, arredo “io c’ero”',
    });
  });

  it('primo sabato dell’anno: tema e torneo di base', () => {
    expect(eventoDelGiorno(utc(1, 2))).toEqual({
      nome: "Festa anni '90 + torneo di biliardino",
      formato: 'Festa · Torneo',
      obiettivo: 'il sabato è la festa grande della settimana',
    });
  });

  it('palinsesto settimanale fisso: lunedì = quiz di riscaldamento', () => {
    expect(eventoDelGiorno(utc(1, 4))).toEqual({
      nome: 'Caffè del lunedì: quiz di riscaldamento',
      formato: 'Quiz soft',
      obiettivo: 'far ripartire la settimana senza pressione',
    });
  });

  it('quarto sabato (d>21): il torneo non è ancora cambiato', () => {
    expect(eventoDelGiorno(utc(1, 23))).toEqual({
      nome: 'Serata latina + torneo di biliardino',
      formato: 'Festa · Torneo',
      obiettivo: 'il sabato è la festa grande della settimana',
    });
  });

  it('ultimo sabato del mese: foto di gruppo + torneo ruotato', () => {
    expect(eventoDelGiorno(utc(1, 30))).toEqual({
      nome: 'Disco night + torneo di freccette · Foto di gruppo del mese',
      formato: 'Festa · Torneo',
      obiettivo: 'chi c’è finisce nel quadro del locale per un mese',
    });
  });

  it('ricorrenza a metà anno: Ferragosto', () => {
    expect(eventoDelGiorno(utc(8, 15))).toEqual({
      nome: 'Ferragosto in spiaggia',
      formato: 'Festa',
      obiettivo: 'picco estivo, collezionabile limited',
    });
  });

  it('ricorrenza a fine anno: Natale (sovrascrive il sabato)', () => {
    expect(eventoDelGiorno(utc(12, 25))).toEqual({
      nome: 'Natale al bar: regalo sotto l’albero',
      formato: 'Evento',
      obiettivo: 'regalo di presenza, saluti registrati',
    });
  });
});
