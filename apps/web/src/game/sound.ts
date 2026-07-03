/**
 * Effetti sonori sintetizzati via Web Audio API — nessun asset esterno
 * (scaricare pack audio CC0 non è possibile dal sandbox di build, vedi
 * README). Toni brevi generati al volo con oscillatori + inviluppo,
 * nello stesso spirito "placeholder ma coerente" della grafica
 * procedurale in sprites.ts.
 *
 * L'AudioContext si crea SOLO al primo gesto dell'utente (policy
 * autoplay dei browser): `ensureAudio()` va chiamata da un handler di
 * click/tap, non all'avvio della pagina.
 */

const MUTE_KEY = 'barlandia_muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function isMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MUTE_KEY) === '1';
}

export function setMuted(muted: boolean): void {
  window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : 1;
}

/** Da chiamare dentro un gesture handler (click/tap) prima di suonare. */
function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = isMuted() ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Singolo tono con inviluppo attack/decay morbido. */
function tone(freq: number, duration: number, opts: { type?: OscillatorType; gain?: number; delay?: number } = {}): void {
  const audio = ensureAudio();
  if (!audio || !master) return;
  const { type = 'sine', gain = 0.16, delay = 0 } = opts;
  const t0 = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Sequenza di note (per accordi/arpeggi ascendenti). */
function sequence(
  notes: { freq: number; delay: number; duration?: number; gain?: number; type?: OscillatorType }[],
): void {
  for (const n of notes) tone(n.freq, n.duration ?? 0.16, { delay: n.delay, gain: n.gain, type: n.type });
}

export const sound = {
  chatSent: () => tone(660, 0.08, { gain: 0.1 }),
  chatReceived: () => tone(520, 0.09, { gain: 0.09 }),
  coinEarned: () =>
    sequence([
      { freq: 784, delay: 0 }, // G5
      { freq: 1046, delay: 0.07 }, // C6
    ]),
  purchase: () =>
    sequence([
      { freq: 523, delay: 0, gain: 0.14 },
      { freq: 659, delay: 0.06, gain: 0.14 },
      { freq: 784, delay: 0.12, gain: 0.14 },
    ]),
  badgeEarned: () =>
    sequence([
      { freq: 523, delay: 0 },
      { freq: 659, delay: 0.09 },
      { freq: 784, delay: 0.18 },
      { freq: 1046, delay: 0.27, duration: 0.28 },
    ]),
  emote: () => tone(440, 0.1, { type: 'triangle', gain: 0.12 }),
  sit: () => tone(180, 0.12, { type: 'sine', gain: 0.1 }),
  clockIn: () =>
    sequence([
      { freq: 349, delay: 0, type: 'square', gain: 0.1 },
      { freq: 523, delay: 0.08, type: 'square', gain: 0.1 },
    ]),
  clockOut: () =>
    sequence([
      { freq: 523, delay: 0, type: 'square', gain: 0.1 },
      { freq: 349, delay: 0.08, type: 'square', gain: 0.1 },
    ]),
  levelUp: () =>
    sequence([
      { freq: 392, delay: 0, gain: 0.14 },
      { freq: 523, delay: 0.1, gain: 0.14 },
      { freq: 659, delay: 0.2, gain: 0.14 },
      { freq: 784, delay: 0.3, gain: 0.16, duration: 0.35 },
    ]),
  errorBeep: () =>
    sequence([
      { freq: 220, delay: 0, type: 'square', gain: 0.06 },
      { freq: 196, delay: 0.09, type: 'square', gain: 0.06 },
    ]),
};
