/**
 * Player progression: XP, levels, daily streak, daily missions and unlockable
 * colours. Stored on the device. Rewards are XP and cosmetics only: nothing
 * here ever touches play credits (those live in the ledger).
 */
export type MissionId = 'kos' | 'bank' | 'survive' | 'games' | 'king' | 'streak' | 'big';

export interface Mission {
  id: MissionId;
  goal: number;
  value: number;
  done: boolean;
}

export interface Progress {
  xp: number;
  lastDay: string;
  streak: number;
  missionsDay: string;
  missions: Mission[];
  /** index into PLAYER_COLORS */
  color: number;
  /** games played today (for the "play N games" mission) */
  games: string[];
}

export type ProgressEvent =
  | { t: 'ko' }
  | { t: 'king' }
  | { t: 'cashout'; amount: number }
  | { t: 'life'; seconds: number; game: string }
  | { t: 'streak'; n: number };

export const MISSION_XP = 120;
/** Level needed for each colour (index = PLAYER_COLORS index). */
export const COLOR_UNLOCK = [1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 15];

const POOL: { id: MissionId; goal: number }[] = [
  { id: 'kos', goal: 5 },
  { id: 'bank', goal: 500 },
  { id: 'survive', goal: 60 },
  { id: 'games', goal: 3 },
  { id: 'king', goal: 1 },
  { id: 'streak', goal: 3 },
  { id: 'big', goal: 300 },
];

export const levelFor = (xp: number): number => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
export const xpForLevel = (level: number): number => 50 * (level - 1) ** 2;

export const dayString = (d = new Date()): string => d.toISOString().slice(0, 10);
const dayBefore = (day: string): string => dayString(new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000));

/** Three missions for a date; the same for everyone that day. */
export function dailyMissions(day: string): Mission[] {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const pool = [...POOL];
  const out: Mission[] = [];
  for (let i = 0; i < 3; i++) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const pick = pool.splice(h % pool.length, 1)[0]!;
    out.push({ ...pick, value: 0, done: false });
  }
  return out;
}

export function freshProgress(): Progress {
  return { xp: 0, lastDay: '', streak: 0, missionsDay: '', missions: [], color: 0, games: [] };
}

/** Call when the player shows up: updates the streak and rolls new missions. Returns streak bonus XP. */
export function touchDay(p: Progress, today: string): number {
  let bonus = 0;
  if (p.lastDay !== today) {
    p.streak = p.lastDay === dayBefore(today) ? p.streak + 1 : 1;
    p.lastDay = today;
    bonus = Math.min(p.streak, 7) * 20;
    p.xp += bonus;
  }
  if (p.missionsDay !== today) {
    p.missionsDay = today;
    p.missions = dailyMissions(today);
    p.games = [];
  }
  return bonus;
}

/** Feed a gameplay event; returns the missions it completed (each pays MISSION_XP). */
export function applyEvent(p: Progress, ev: ProgressEvent): Mission[] {
  const done: Mission[] = [];
  if (ev.t === 'life' && !p.games.includes(ev.game)) p.games.push(ev.game);
  for (const m of p.missions) {
    if (m.done) continue;
    switch (m.id) {
      case 'kos':
        if (ev.t === 'ko') m.value++;
        break;
      case 'king':
        if (ev.t === 'king') m.value++;
        break;
      case 'bank':
        if (ev.t === 'cashout') m.value += ev.amount;
        break;
      case 'big':
        if (ev.t === 'cashout') m.value = Math.max(m.value, ev.amount);
        break;
      case 'survive':
        if (ev.t === 'life') m.value = Math.max(m.value, ev.seconds);
        break;
      case 'games':
        m.value = p.games.length;
        break;
      case 'streak':
        if (ev.t === 'streak') m.value = Math.max(m.value, ev.n);
        break;
    }
    if (m.value >= m.goal) {
      m.value = m.goal;
      m.done = true;
      p.xp += MISSION_XP;
      done.push(m);
    }
  }
  return done;
}

/** XP for one life. */
export const lifeXp = (seconds: number, kos: number, cashed: number): number =>
  Math.round(Math.min(60, seconds / 3) + kos * 20 + Math.min(200, cashed / 20));

export const colorUnlocked = (p: Progress, index: number): boolean => levelFor(p.xp) >= (COLOR_UNLOCK[index] ?? 99);

// ---- storage (device only) ---------------------------------------------------

let cache: Progress | null = null;

export function loadProgress(): Progress {
  if (cache) return cache;
  let p = freshProgress();
  try {
    const raw = localStorage.getItem('progress');
    if (raw) p = { ...p, ...(JSON.parse(raw) as Partial<Progress>) };
  } catch {
    /* storage unavailable: progress lasts for this visit only */
  }
  if (!Array.isArray(p.missions)) p.missions = [];
  if (!Array.isArray(p.games)) p.games = [];
  if (!colorUnlocked(p, p.color)) p.color = 0;
  touchDay(p, dayString());
  cache = p;
  saveProgress();
  return p;
}

export function saveProgress(): void {
  if (!cache) return;
  try {
    localStorage.setItem('progress', JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}
