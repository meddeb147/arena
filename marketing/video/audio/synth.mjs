// Original music and sound effects for the Stake Arena promo, synthesized
// from scratch (no samples, no third-party audio): fully royalty-free.
//   node audio/synth.mjs  ->  public/audio/music.wav + public/audio/sfx/*.wav
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');

// ---------- tiny DSP toolkit ----------
let seed = 1234567;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const buf = (sec) => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/** state-variable filter (lowpass / bandpass / highpass) */
function svf() {
  let lp = 0, bp = 0;
  return (x, cutoff, q = 0.7, mode = 'lp') => {
    const qq = Math.max(q, 0.55);
    // Chamberlin SVF is only stable while f < 2 - 1/q: clamp with margin
    const f = Math.min(2 * Math.sin((Math.PI * Math.min(cutoff, SR / 6)) / SR), (2 - 1 / qq) * 0.85);
    const hp = x - lp - bp / qq;
    bp += f * hp;
    lp += f * bp;
    return mode === 'lp' ? lp : mode === 'bp' ? bp : hp;
  };
}
function add(dst, src, at, gain = 1, pan = 0) {
  const s = Math.floor(at * SR);
  const gl = gain * Math.min(1, 1 - pan);
  const gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < src[0].length && s + i < dst[0].length; i++) {
    if (s + i < 0) continue;
    dst[0][s + i] += src[0][i] * gl;
    dst[1][s + i] += src[1][i] * gr;
  }
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// ---------- instruments ----------
function kick(len = 0.5, punch = 1) {
  const b = buf(len);
  let ph = 0;
  for (let i = 0; i < b[0].length; i++) {
    const t = i / SR;
    const f = 45 + 160 * Math.exp(-t / 0.035) * punch;
    ph += (2 * Math.PI * f) / SR;
    const v = Math.tanh(Math.sin(ph) * 2.2) * env(t, 0.002, 0.16) + rand() * 0.25 * Math.exp(-t / 0.004);
    b[0][i] = b[1][i] = v;
  }
  return b;
}
function clap() {
  const b = buf(0.4);
  const f = svf();
  for (let i = 0; i < b[0].length; i++) {
    const t = i / SR;
    const bursts = [0, 0.011, 0.022].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) / 0.007) : 0), 0) * 0.6 + Math.exp(-t / 0.09) * 0.5;
    const v = f(rand(), 1300, 1.2, 'bp') * bursts * 2.2;
    b[0][i] = v;
    b[1][i] = v;
  }
  return b;
}
function hat(open = false) {
  const b = buf(open ? 0.3 : 0.06);
  const f = svf();
  for (let i = 0; i < b[0].length; i++) {
    const t = i / SR;
    const v = f(rand(), 9000, 0.6, 'hp') * Math.exp(-t / (open ? 0.09 : 0.018)) * 0.5;
    b[0][i] = v;
    b[1][i] = v;
  }
  return b;
}
/** detuned saw voice through a lowpass */
function saw(note, len, { cutoff = 1200, res = 1, attack = 0.005, decay = 0.3, sustain = 0.6, release = 0.15, detune = 0.12, voices = 3, sweep = 0 } = {}) {
  const b = buf(len + release);
  const f1 = svf(), f2 = svf();
  const phases = Array.from({ length: voices }, () => Math.random());
  for (let i = 0; i < b[0].length; i++) {
    const t = i / SR;
    let L = 0, R = 0;
    for (let v = 0; v < voices; v++) {
      const det = (v - (voices - 1) / 2) * detune;
      phases[v] = (phases[v] + mtof(note + det) / SR) % 1;
      const s = phases[v] * 2 - 1;
      if (v % 2) L += s; else R += s;
      if (voices === 1) L = R = s;
    }
    let a = t < attack ? t / attack : sustain + (1 - sustain) * Math.exp(-(t - attack) / decay);
    if (t > len) a *= Math.exp(-(t - len) / (release / 4));
    const c = cutoff * (1 + sweep * Math.exp(-t / 0.15));
    b[0][i] = f1(L, c, res) * a * 0.5;
    b[1][i] = f2(R, c, res) * a * 0.5;
  }
  return b;
}
function sine(freq, len, decay, gain = 1, bend = 0) {
  const b = buf(len);
  let ph = 0;
  for (let i = 0; i < b[0].length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * freq * (1 + bend * Math.exp(-t / 0.05))) / SR;
    const v = Math.sin(ph) * env(t, 0.003, decay) * gain;
    b[0][i] = b[1][i] = v;
  }
  return b;
}
function noiseSweep(len, from, to, gain = 0.5, mode = 'bp', rise = true) {
  const b = buf(len);
  const f1 = svf(), f2 = svf();
  for (let i = 0; i < b[0].length; i++) {
    const t = i / SR;
    const k = t / len;
    const c = from * (to / from) ** k;
    const a = rise ? k ** 2 : (1 - k) ** 2;
    b[0][i] = f1(rand(), c, 2, mode) * a * gain;
    b[1][i] = f2(rand(), c * 1.03, 2, mode) * a * gain;
  }
  return b;
}
function impact(len = 2.5, gain = 1) {
  const b = buf(len);
  add(b, kick(1.2, 1.4), 0, 1.3 * gain);
  add(b, sine(38, len, 0.9, 0.9 * gain, 1.5), 0);
  const n = noiseSweep(1.2, 5000, 120, 0.9 * gain, 'lp', false);
  add(b, n, 0);
  return b;
}

// ---------- music ----------
const BPM = 128;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LEN = 60.5;
const m = buf(LEN);
const bus = { drums: buf(LEN), bass: buf(LEN), synth: buf(LEN), fx: buf(LEN) };

// A minor: Am - F - C - G   (i - VI - III - VII)
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const ROOTS = [33, 29, 36, 31];
/** section intensity by time (0 silent .. 3 full) matching the storyboard */
const intensity = (t) => (t < 5 ? 0.5 : t < 12 ? 2.5 : t < 21 ? 2 : t < 32 ? 3 : t < 41 ? 1 : t < 50 ? 2.5 : t < 57 ? 3 : 0);

// intro: logo impact + riser into the drop at 5 s
add(bus.fx, impact(3), 0.25, 1.1);
add(bus.fx, noiseSweep(3.6, 300, 9000, 0.35), 1.4);
add(bus.synth, saw(45, 4.6, { cutoff: 500, sustain: 0.8, decay: 2, release: 0.5, voices: 5, detune: 0.18 }), 0.4, 0.5);

const start = 5;
for (let bar = 0; start + bar * BAR < 57.5; bar++) {
  const t0 = start + bar * BAR;
  const lvl = intensity(t0 + 0.01);
  const chord = CHORDS[bar % 4];
  const root = ROOTS[bar % 4];
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    if (tb > 57.5) break;
    const L = intensity(tb);
    if (L >= 2 || (L >= 1 && b % 2 === 0)) add(bus.drums, kick(), tb, 0.95);
    if (L >= 2 && (b === 1 || b === 3)) add(bus.drums, clap(), tb, 0.55);
    if (L >= 1.5) for (const o of [0.5]) add(bus.drums, hat(b === 3 && o === 0.5), tb + o * BEAT, 0.35, 0.3);
    if (L >= 2.5) add(bus.drums, hat(), tb + 0.25 * BEAT, 0.18, -0.3), add(bus.drums, hat(), tb + 0.75 * BEAT, 0.18, -0.3);
    // offbeat bass (sidechained feel)
    if (L >= 1) add(bus.bass, saw(root, BEAT * 0.42, { cutoff: L >= 2.5 ? 900 : 450, res: 1.3, decay: 0.12, sustain: 0.4, voices: 2, detune: 0.05, sweep: 1.5 }), tb + BEAT / 2, 0.75);
  }
  // pad
  for (const n of chord) add(bus.synth, saw(n, BAR * 0.98, { cutoff: lvl >= 2.5 ? 2600 : 1200, attack: 0.08, decay: 0.8, sustain: 0.7, release: 0.4, voices: 4, detune: 0.15 }), t0, lvl >= 1 ? 0.16 : 0.1, 0);
  // arp lead (16ths)
  if (lvl >= 2) {
    for (let k = 0; k < 16; k++) {
      const n = chord[k % 3] + 12 + (k % 8 >= 6 ? 12 : 0);
      add(bus.synth, saw(n, BEAT / 4 * 0.6, { cutoff: 3200, res: 1.6, decay: 0.06, sustain: 0.2, voices: 1, sweep: 1 }), t0 + (k * BEAT) / 4, 0.12, k % 2 ? 0.35 : -0.35);
    }
  }
}
// tension heartbeat in the cash-out breakdown (32-41 s)
for (let tb = 32; tb < 41; tb += 0.8) add(bus.drums, kick(0.4, 0.5), tb, 0.6), add(bus.drums, kick(0.4, 0.5), tb + 0.22, 0.35);
add(bus.fx, noiseSweep(9, 200, 4000, 0.18), 32);
// rebuild riser into the leaderboard (41 s) and the finale (50 s)
add(bus.fx, noiseSweep(2.5, 400, 10000, 0.35), 38.5);
add(bus.fx, impact(2.5, 0.8), 41);
add(bus.fx, noiseSweep(3.2, 300, 11000, 0.4), 46.8);
add(bus.fx, impact(4, 1.2), 50);
// final sting and tail
add(bus.synth, saw(45, 3, { cutoff: 1500, sustain: 0.9, decay: 3, release: 2, voices: 6, detune: 0.2 }), 57.2, 0.5);
add(bus.fx, impact(3.5, 1), 57.2);

// mix: duck everything but the kick under each kick (sidechain pump)
const duck = new Float32Array(m[0].length).fill(1);
for (let bar = 0; start + bar * BAR < 57.5; bar++) for (let b = 0; b < 4; b++) {
  const tb = start + bar * BAR + b * BEAT;
  if (intensity(tb) < 2) continue;
  const s0 = Math.floor(tb * SR);
  for (let i = 0; i < BEAT * SR * 0.9 && s0 + i < duck.length; i++) duck[s0 + i] = Math.min(duck[s0 + i], 0.35 + 0.65 * Math.min(1, i / (SR * 0.18)));
}
for (let i = 0; i < m[0].length; i++) {
  for (const ch of [0, 1]) m[ch][i] = bus.drums[ch][i] * 0.9 + (bus.bass[ch][i] * 0.9 + bus.synth[ch][i]) * duck[i] + bus.fx[ch][i] * 0.8;
}
// set the level from the loud sections' RMS, then only a gentle soft clip on peaks
{
  let sum = 0;
  let n = 0;
  for (let i = Math.floor(5 * SR); i < Math.floor(57 * SR); i += 7) {
    sum += m[0][i] * m[0][i];
    n++;
  }
  const g = 0.2 / Math.sqrt(sum / n);
  for (const ch of [0, 1]) for (let i = 0; i < m[ch].length; i++) m[ch][i] = Math.tanh(m[ch][i] * g * 1.1) / 1.1;
}

// ---------- sound effects ----------
function sfxSet() {
  const S = {};
  S['logo-hit'] = impact(2.5, 1);
  const zap = buf(0.5);
  { const f = svf(); let ph = 0; for (let i = 0; i < zap[0].length; i++) { const t = i / SR; ph += (2 * Math.PI * (1800 - 1500 * t / 0.5)) / SR; const v = (Math.sign(Math.sin(ph)) * 0.3 + f(rand(), 3000, 3, 'bp') * 0.8) * Math.exp(-t / 0.12); zap[0][i] = v; zap[1][i] = v; } }
  S['neon-zap'] = zap;
  const coin = buf(0.8);
  add(coin, sine(1567, 0.8, 0.12, 0.5), 0); add(coin, sine(2093, 0.8, 0.35, 0.5), 0.07); add(coin, sine(4186, 0.8, 0.2, 0.15), 0.07);
  S['coin'] = coin;
  const ko = buf(1.2);
  add(ko, kick(0.6, 1.6), 0, 1.2); add(ko, noiseSweep(0.35, 4000, 300, 0.9, 'lp', false), 0); add(ko, sine(90, 1, 0.3, 0.6, 2), 0);
  S['elimination'] = ko;
  S['explosion'] = impact(2.2, 1);
  const cash = buf(1.4);
  [72, 76, 79, 84].forEach((n, k) => add(cash, sine(mtof(n), 1.2, 0.35, 0.35), k * 0.07));
  add(cash, sine(mtof(96), 1.2, 0.6, 0.1), 0.28);
  S['cashout'] = cash;
  S['tick'] = sine(1400, 0.15, 0.03, 0.6);
  S['whoosh'] = noiseSweep(0.6, 400, 6000, 0.6, 'bp', true);
  const reveal = buf(4);
  add(reveal, impact(4, 1.2), 0); [57, 64, 69, 72, 76].forEach((n) => add(reveal, saw(n, 2.5, { cutoff: 3000, decay: 1.5, sustain: 0.5, release: 1, voices: 3 }), 0, 0.12));
  S['final-reveal'] = reveal;
  return S;
}

// ---------- write WAV ----------
function wav(path, b, gain = 1) {
  let peak = 0;
  for (const ch of b) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  const norm = peak > 0 ? (0.89 / peak) * gain : 1;
  const n = b[0].length;
  const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) for (const ch of [0, 1]) data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(b[ch][i] * norm * 32767))), 44 + i * 4 + ch * 2);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log('wrote', path);
}
wav(join(OUT, 'music.wav'), m);
for (const [name, b] of Object.entries(sfxSet())) wav(join(OUT, 'sfx', `${name}.wav`), b, 0.9);
