/**
 * Everything time-based lives here so the edit can be re-timed in one place.
 * Times are in SECONDS; the composition runs at 60 fps.
 */
export const FPS = 60;
export const DURATION_S = 60;
export const f = (sec: number) => Math.round(sec * FPS);

export const SCENES = {
  hook: { from: 0, to: 5 },
  universe: { from: 5, to: 12 },
  enter: { from: 12, to: 21 },
  eliminate: { from: 21, to: 32 },
  cashout: { from: 32, to: 41 },
  compete: { from: 41, to: 50 },
  reveal: { from: 50, to: 60 },
} as const;

/**
 * Voice-over: public/vo/voiceover.mp3 (ElevenLabs, 39.4 s). It was split at its
 * natural pauses (found with ffmpeg silencedetect) and each phrase is placed at
 * a scene start. `src` = seconds inside the file, `at` = seconds in the video.
 * Listen in Remotion Studio (npm run studio) and adjust `at` if a line lands
 * on the wrong scene.
 */
export const VO_CUES: { src: [number, number]; at: number; label: string }[] = [
  { src: [0.0, 3.62], at: 0.55, label: 'phrase 1 (hook)' },
  { src: [4.2, 11.8], at: 5.25, label: 'phrase 2 (universe)' },
  { src: [11.95, 14.15], at: 13.4, label: 'phrase 3 (enter)' },
  { src: [14.25, 22.65], at: 21.35, label: 'phrase 4 (eliminate)' },
  { src: [22.95, 29.95], at: 32.35, label: 'phrase 5 (cash out)' },
  { src: [29.98, 39.39], at: 41.25, label: 'phrase 6 (compete / CTA)' },
];

/** Sound effects (public/audio/sfx/<name>.wav). */
export const SFX: { name: string; at: number; volume?: number }[] = [
  { name: 'logo-hit', at: 0.32, volume: 0.9 },
  { name: 'whoosh', at: 4.7, volume: 0.6 },
  { name: 'neon-zap', at: 5.3, volume: 0.5 },
  { name: 'neon-zap', at: 6.85, volume: 0.45 },
  ...[8.35, 8.85, 9.35, 9.85, 10.35, 10.85].map((at) => ({ name: 'whoosh', at, volume: 0.35 })),
  { name: 'whoosh', at: 11.6, volume: 0.6 },
  { name: 'coin', at: 13.1, volume: 0.8 },
  { name: 'whoosh', at: 13.3, volume: 0.5 },
  { name: 'coin', at: 14.3, volume: 0.8 },
  // KO moments in the eliminate scene are aligned to the captured footage (see scenes)
  // countdown ticks and the cash-out chime are aligned to the footage (see Promo.tsx)
  { name: 'whoosh', at: 40.6, volume: 0.6 },
  { name: 'whoosh', at: 42.2, volume: 0.4 },
  { name: 'coin', at: 44.6, volume: 0.6 },
  { name: 'explosion', at: 50.0, volume: 0.9 },
  { name: 'final-reveal', at: 50.0, volume: 0.8 },
  { name: 'neon-zap', at: 55.1, volume: 0.5 },
];

/** Music bed volume, ducked under the voice. */
export const MUSIC = { full: 0.9, ducked: 0.38, rampS: 0.25 };
