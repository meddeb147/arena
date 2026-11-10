/**
 * Meme-style sound effects, all synthesized with the Web Audio API at runtime
 * (no samples, no copyrighted clips). Starts on the first user gesture, as
 * browsers require.
 */
import { settings, saveSettings } from '../settings';

export type SoundName =
  | 'airhorn'
  | 'trombone'
  | 'bruh'
  | 'boom'
  | 'coin'
  | 'boing'
  | 'zap'
  | 'punch'
  | 'smash'
  | 'thunder'
  | 'gulp'
  | 'pop'
  | 'tick'
  | 'whoosh'
  | 'heal'
  | 'streak'
  | 'bumper'
  | 'golden'
  | 'shot'
  | 'clang'
  | 'click';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const lastPlayed = new Map<SoundName, number>();
/** minimum ms between two plays of the same sound, so crowds don't turn into noise */
const THROTTLE: Partial<Record<SoundName, number>> = { shot: 60, clang: 90, punch: 70, pop: 60, bumper: 90, gulp: 80, tick: 200, golden: 120, zap: 80, boing: 60 };

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  applyVolume();
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Browsers only allow audio after a gesture: call from any click/keydown. */
export function unlockAudio(): void {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}

export function applyVolume(): void {
  if (master && ctx) master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, ctx.currentTime, 0.02);
}

export function toggleMute(): boolean {
  settings.muted = !settings.muted;
  saveSettings();
  applyVolume();
  return settings.muted;
}

// ---- building blocks -------------------------------------------------------

function osc(type: OscillatorType, freq: number, t: number): OscillatorNode {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  return o;
}
function gain(v: number, t: number): GainNode {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(v, t);
  return g;
}
function filter(type: BiquadFilterType, f: number, q = 1): BiquadFilterNode {
  const b = ctx!.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}
function noise(t: number, dur: number): AudioBufferSourceNode {
  const n = ctx!.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  n.start(t, Math.random() * 0.5);
  n.stop(t + dur);
  return n;
}
/** attack/decay envelope on a gain node */
function env(g: GainNode, t: number, peak: number, a: number, d: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

// ---- the sounds ------------------------------------------------------------

type Out = AudioNode;

/** The classic three-blast party horn: BWAA-BWA-BWAAAA. */
function airhorn(out: Out, t: number): void {
  const blasts: [number, number][] = [[0, 0.22], [0.27, 0.12], [0.43, 0.55]];
  for (const [o, len] of blasts) {
    const g = gain(0.0001, t + o);
    g.gain.setValueAtTime(0.0001, t + o);
    g.gain.linearRampToValueAtTime(0.5, t + o + 0.02);
    g.gain.setValueAtTime(0.5, t + o + len - 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t + o + len);
    const bp = filter('bandpass', 1300, 0.9);
    for (const det of [0, 7, -6, 12]) {
      const s = osc('sawtooth', 466 * (1 + det / 1000), t + o);
      s.frequency.setValueAtTime(440, t + o);
      s.frequency.linearRampToValueAtTime(470 + det, t + o + 0.04);
      s.connect(bp);
      s.start(t + o);
      s.stop(t + o + len + 0.02);
    }
    bp.connect(g).connect(out);
  }
}

/** Sad trombone: wah, wah, wah, waaaah (with a wobble on the last). */
function trombone(out: Out, t: number): void {
  const notes = [293.7, 277.2, 261.6, 246.9];
  notes.forEach((f, i) => {
    const st = t + i * 0.38;
    const len = i === 3 ? 1.1 : 0.32;
    const s = osc('sawtooth', f, st);
    const lp = filter('lowpass', 600, 4);
    lp.frequency.setValueAtTime(350, st);
    lp.frequency.linearRampToValueAtTime(1400, st + 0.08);
    lp.frequency.linearRampToValueAtTime(500, st + len);
    if (i === 3) {
      const lfo = osc('sine', 6, st);
      const depth = gain(8, st);
      lfo.connect(depth).connect(s.frequency);
      lfo.start(st);
      lfo.stop(st + len);
      s.frequency.linearRampToValueAtTime(f * 0.94, st + len);
    }
    const g = gain(0.0001, st);
    g.gain.linearRampToValueAtTime(0.35, st + 0.04);
    g.gain.setValueAtTime(0.35, st + len - 0.08);
    g.gain.linearRampToValueAtTime(0.0001, st + len);
    s.connect(lp).connect(g).connect(out);
    s.start(st);
    s.stop(st + len + 0.02);
  });
}

/** A low "bruh": a buzzy voice through two vowel formants ("uh"), with a lip-pop onset. */
function bruh(out: Out, t: number): void {
  const len = 0.42;
  const src = osc('sawtooth', 118, t);
  src.frequency.linearRampToValueAtTime(96, t + len);
  const f1 = filter('bandpass', 620, 6);
  const f2 = filter('bandpass', 1180, 8);
  const g = gain(0.0001, t);
  g.gain.linearRampToValueAtTime(0.9, t + 0.03);
  g.gain.setValueAtTime(0.9, t + len - 0.1);
  g.gain.linearRampToValueAtTime(0.0001, t + len);
  src.connect(f1).connect(g);
  src.connect(f2).connect(g);
  g.connect(out);
  src.start(t);
  src.stop(t + len);
  const b = noise(t, 0.04);
  const bg = gain(0.0001, t);
  env(bg, t, 0.4, 0.002, 0.03);
  b.connect(filter('lowpass', 900)).connect(bg).connect(out);
}

function boom(out: Out, t: number, size = 1): void {
  const s = osc('sine', 120, t);
  s.frequency.exponentialRampToValueAtTime(32, t + 0.6 * size);
  const g = gain(0.0001, t);
  env(g, t, 0.9, 0.005, 0.5 * size);
  s.connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.9 * size);
  const n = noise(t, 0.8 * size);
  const lp = filter('lowpass', 2400);
  lp.frequency.exponentialRampToValueAtTime(120, t + 0.6 * size);
  const ng = gain(0.0001, t);
  env(ng, t, 0.6, 0.005, 0.45 * size);
  n.connect(lp).connect(ng).connect(out);
}

function coin(out: Out, t: number): void {
  [988, 1319].forEach((f, i) => {
    const s = osc('square', f, t + i * 0.08);
    const g = gain(0.0001, t);
    env(g, t + i * 0.08, 0.16, 0.004, i ? 0.35 : 0.08);
    s.connect(g).connect(out);
    s.start(t + i * 0.08);
    s.stop(t + i * 0.08 + 0.45);
  });
}

/** Cartoon spring: a pitch that wobbles and settles. */
function boing(out: Out, t: number): void {
  const s = osc('sine', 180, t);
  const len = 0.45;
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    s.frequency.setValueAtTime(260 + Math.sin(k * 26) * 140 * (1 - k) + k * 120, t + k * len);
  }
  const g = gain(0.0001, t);
  env(g, t, 0.35, 0.005, len);
  s.connect(g).connect(out);
  s.start(t);
  s.stop(t + len + 0.05);
}

function zap(out: Out, t: number): void {
  const s = osc('sawtooth', 2200, t);
  s.frequency.exponentialRampToValueAtTime(140, t + 0.22);
  const g = gain(0.0001, t);
  env(g, t, 0.22, 0.004, 0.2);
  s.connect(filter('bandpass', 1800, 2)).connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.3);
  const n = noise(t, 0.15);
  const ng = gain(0.0001, t);
  env(ng, t, 0.15, 0.002, 0.12);
  n.connect(filter('highpass', 3000)).connect(ng).connect(out);
}

function punch(out: Out, t: number, heavy = false): void {
  const n = noise(t, 0.15);
  const ng = gain(0.0001, t);
  env(ng, t, heavy ? 0.7 : 0.35, 0.002, heavy ? 0.12 : 0.06);
  n.connect(filter('lowpass', heavy ? 1600 : 2600)).connect(ng).connect(out);
  const s = osc('sine', heavy ? 140 : 190, t);
  s.frequency.exponentialRampToValueAtTime(50, t + 0.12);
  const g = gain(0.0001, t);
  env(g, t, heavy ? 0.8 : 0.4, 0.002, heavy ? 0.16 : 0.08);
  s.connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.2);
}

function thunder(out: Out, t: number): void {
  const crack = noise(t, 0.25);
  const cg = gain(0.0001, t);
  env(cg, t, 0.7, 0.002, 0.12);
  crack.connect(filter('highpass', 1500)).connect(cg).connect(out);
  boom(out, t + 0.02, 1.4);
}

function gulp(out: Out, t: number): void {
  const s = osc('sine', 220, t);
  s.frequency.exponentialRampToValueAtTime(520, t + 0.12);
  const g = gain(0.0001, t);
  env(g, t, 0.3, 0.01, 0.12);
  s.connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.2);
}

function pop(out: Out, t: number): void {
  const s = osc('sine', 900, t);
  s.frequency.exponentialRampToValueAtTime(300, t + 0.06);
  const g = gain(0.0001, t);
  env(g, t, 0.18, 0.002, 0.06);
  s.connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.1);
}

function tick(out: Out, t: number): void {
  const s = osc('square', 1500, t);
  const g = gain(0.0001, t);
  env(g, t, 0.12, 0.002, 0.04);
  s.connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.06);
}

function whoosh(out: Out, t: number): void {
  const n = noise(t, 0.4);
  const bp = filter('bandpass', 400, 1.5);
  bp.frequency.exponentialRampToValueAtTime(3500, t + 0.3);
  const g = gain(0.0001, t);
  env(g, t, 0.3, 0.15, 0.2);
  n.connect(bp).connect(g).connect(out);
}

function chime(out: Out, t: number, notes: number[], step = 0.07, vol = 0.18, type: OscillatorType = 'triangle'): void {
  notes.forEach((f, i) => {
    const s = osc(type, f, t + i * step);
    const g = gain(0.0001, t);
    env(g, t + i * step, vol, 0.005, 0.35);
    s.connect(g).connect(out);
    s.start(t + i * step);
    s.stop(t + i * step + 0.45);
  });
}

const PLAYERS: Record<SoundName, (out: Out, t: number) => void> = {
  airhorn,
  trombone,
  bruh,
  boom: (o, t) => boom(o, t, 1),
  coin,
  boing,
  zap,
  punch: (o, t) => punch(o, t, false),
  smash: (o, t) => punch(o, t, true),
  thunder,
  gulp,
  pop,
  tick,
  whoosh,
  heal: (o, t) => chime(o, t, [660, 880, 1320], 0.06, 0.14),
  streak: (o, t) => chime(o, t, [523, 659, 784, 1047, 1319], 0.06, 0.2, 'square'),
  bumper: (o, t) => {
    chime(o, t, [1046], 0, 0.16, 'square');
    boing(o, t);
  },
  golden: (o, t) => chime(o, t, [1568, 2093], 0.05, 0.12),
  click: (o, t) => tick(o, t),
  // laser pew: a fast downward square sweep
  shot: (o, t) => {
    const s = osc('square', 1400, t);
    s.frequency.exponentialRampToValueAtTime(220, t + 0.12);
    const g = gain(0.0001, t);
    env(g, t, 0.16, 0.003, 0.1);
    s.connect(filter('lowpass', 3000)).connect(g).connect(o);
    s.start(t);
    s.stop(t + 0.16);
  },
  // metal on metal: inharmonic partials ringing out
  clang: (o, t) => {
    for (const [f, v] of [[523, 0.2], [1307, 0.12], [2210, 0.08], [3150, 0.05]] as const) {
      const s = osc('sine', f, t);
      const g = gain(0.0001, t);
      env(g, t, v, 0.002, 0.35);
      s.connect(g).connect(o);
      s.start(t);
      s.stop(t + 0.45);
    }
  },
};

/** Play a sound. `vol` 0..1 (e.g. distance attenuation), `delay` in seconds. */
export function play(name: SoundName, vol = 1, delay = 0): void {
  if (settings.muted || vol <= 0.02) return;
  const c = ensure();
  if (!c || !master || c.state !== 'running') return;
  const now = performance.now();
  const gap = THROTTLE[name];
  if (gap && now - (lastPlayed.get(name) ?? 0) < gap) return;
  lastPlayed.set(name, now);
  const g = c.createGain();
  g.gain.value = Math.min(1, vol);
  g.connect(master);
  PLAYERS[name](g, c.currentTime + 0.01 + delay);
  setTimeout(() => g.disconnect(), (delay + 3) * 1000);
}
