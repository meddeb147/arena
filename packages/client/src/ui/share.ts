import { GAME_CATALOG, cleanName, formatCredits, type GameId } from '@arena/shared';
import { t } from '../i18n';
import type { LifeStats } from './juice';

/** A score someone challenged you to beat (carried in the link as ?c=…). */
export interface Challenge {
  g: GameId;
  n: string;
  /** peak stake (units) */
  p: number;
  /** knockouts */
  k: number;
  /** seconds alive */
  s: number;
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function challengeUrl(c: Challenge): string {
  return `${location.origin}${location.pathname}?c=${b64(JSON.stringify(c))}#${c.g}`;
}

/** Read and validate a challenge from the page URL (never trust it). */
export function readChallenge(): Challenge | null {
  const raw = new URLSearchParams(location.search).get('c');
  if (!raw || raw.length > 400) return null;
  try {
    const o = JSON.parse(unb64(raw)) as Partial<Challenge>;
    const game = GAME_CATALOG.find((g) => g.id === o.g && g.available);
    const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
    if (!game) return null;
    const n = cleanName(o.n);
    if (!n) return null;
    return { g: game.id, n, p: int(o.p, 1e7), k: int(o.k, 1e4), s: int(o.s, 1e5) };
  } catch {
    return null;
  }
}

/** The active challenge for this browser tab (so a later life can be compared to it). */
export function activeChallenge(): Challenge | null {
  try {
    const raw = sessionStorage.getItem('challenge');
    return raw ? (JSON.parse(raw) as Challenge) : null;
  } catch {
    return null;
  }
}
export function setActiveChallenge(c: Challenge | null): void {
  try {
    if (c) sessionStorage.setItem('challenge', JSON.stringify(c));
    else sessionStorage.removeItem('challenge');
  } catch {
    /* ignore */
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** 1200x630 share card (also a good link-preview size). */
export async function renderCard(game: GameId, name: string, life: LifeStats, beat: Challenge | null): Promise<Blob | null> {
  const meta = GAME_CATALOG.find((g) => g.id === game)!;
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 630;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  await document.fonts.load('64px Bungee').catch(() => undefined);
  const display = '"Bungee", Impact, sans-serif';
  const ui = '"Nunito", system-ui, sans-serif';
  // background
  const bg = ctx.createLinearGradient(0, 0, 1200, 630);
  bg.addColorStop(0, '#171433');
  bg.addColorStop(1, '#262159');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 630);
  const glow = ctx.createRadialGradient(950, 120, 10, 950, 120, 520);
  glow.addColorStop(0, meta.accent + '66');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 630);
  ctx.strokeStyle = meta.accent + '55';
  ctx.lineWidth = 2;
  for (let x = 0; x < 1200; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 430);
    ctx.lineTo(600 + (x - 600) * 2.5, 630);
    ctx.stroke();
  }
  // logo
  const logo = ctx.createLinearGradient(60, 0, 520, 0);
  logo.addColorStop(0, '#ff4f7b');
  logo.addColorStop(1, '#ffb84f');
  ctx.fillStyle = logo;
  ctx.font = `48px ${display}`;
  ctx.fillText('STAKE ARENA', 60, 100);
  ctx.fillStyle = meta.accent;
  ctx.font = `40px ${display}`;
  ctx.fillText(meta.name.toUpperCase(), 60, 160);
  // the brag
  ctx.fillStyle = '#f3efff';
  ctx.font = `64px ${display}`;
  ctx.fillText(name.slice(0, 16), 60, 260);
  const stats: [string, string][] = [
    [t('lifePeak'), formatCredits(life.peak)],
    [t('lifeKos'), String(life.kos)],
    [t('lifeTime'), mmss(life.seconds)],
  ];
  stats.forEach(([label, value], i) => {
    const x = 60 + i * 300;
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.roundRect(x, 300, 270, 150, 24);
    ctx.fill();
    ctx.fillStyle = i === 0 ? '#ffb84f' : '#f3efff';
    ctx.font = `62px ${display}`;
    ctx.fillText(value, x + 24, 390);
    ctx.fillStyle = '#9b94c9';
    ctx.font = `800 26px ${ui}`;
    ctx.fillText(label, x + 26, 430);
  });
  ctx.fillStyle = '#f3efff';
  ctx.font = `40px ${display}`;
  ctx.fillText(beat ? t('cardBeat', { name: beat.n }) : t('cardCanYou'), 60, 530);
  ctx.fillStyle = '#4fd2ff';
  ctx.font = `900 30px ${ui}`;
  ctx.fillText(location.host + location.pathname.replace(/\/$/, ''), 60, 578);
  ctx.fillStyle = '#9b94c9';
  ctx.font = `800 20px ${ui}`;
  ctx.fillText(t('disclaimer'), 60, 610);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

/**
 * Share a run: native share sheet with the card image where supported
 * (phones), otherwise copy the challenge link and save the image.
 */
export async function shareRun(game: GameId, name: string, life: LifeStats, beat: Challenge | null): Promise<'shared' | 'copied' | 'failed'> {
  const meta = GAME_CATALOG.find((g) => g.id === game)!;
  const url = challengeUrl({ g: game, n: name, p: life.peak, k: life.kos, s: life.seconds });
  const text = t('shareText', { game: meta.name, peak: formatCredits(life.peak), kos: life.kos });
  const blob = await renderCard(game, name, life, beat);
  const file = blob ? new File([blob], `stake-arena-${game}.png`, { type: 'image/png' }) : null;
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${text} ${url}` });
      return 'shared';
    }
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text, url });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
  } catch {
    /* clipboard may be blocked; the image download still happens */
  }
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stake-arena-${game}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  return 'copied';
}
