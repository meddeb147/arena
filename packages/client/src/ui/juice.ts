import { formatCredits, type GameEvent, type GameId, type Snapshot } from '@arena/shared';
import { play, type SoundName } from '../audio/sfx';
import { t } from '../i18n';
import type { Dict } from '../i18n/en';
import type { Stage } from '../render/stage';
import { h } from './dom';

/** Cosmetic fx event -> sound. */
const FX_SOUND: Record<string, SoundName> = {
  hit: 'punch',
  smash: 'smash',
  slam: 'smash',
  zap: 'zap',
  block: 'zap',
  orb: 'heal',
  bolt: 'thunder',
  golden: 'golden',
  drop: 'pop',
  kick: 'punch',
  land: 'punch',
  blast: 'boom',
  pass: 'boing',
  assign: 'zap',
  potato: 'boom',
  stomp: 'boing',
  pound: 'smash',
  spring: 'boing',
  bonk: 'pop',
  double: 'whoosh',
  lava: 'bruh',
  spiked: 'zap',
  bump: 'punch',
};

const STREAK_KEYS: (keyof Dict)[] = ['streak2', 'streak3', 'streak4', 'streak5', 'streak6'];

export interface LifeStats {
  seconds: number;
  kos: number;
  peak: number;
  best: { seconds: boolean; kos: boolean; peak: boolean };
}

interface Bests {
  seconds: number;
  kos: number;
  peak: number;
}

/**
 * Game feel: sounds for every event (attenuated by distance), kill-streak
 * banners, per-life stats and personal bests. Purely client-side; it never
 * affects the simulation.
 */
export class Juice {
  private myId: number | null = null;
  private streak = 0;
  private lifeStart = 0;
  private kos = 0;
  private peak = 0;
  private lastCashStep = 0;
  private wasAlive = false;
  private banner: HTMLElement;
  private bannerTimer = 0;
  last: LifeStats | null = null;

  constructor(private readonly root: HTMLElement, private readonly gameId: GameId, private readonly stage: Stage) {
    this.banner = h('div.streak', { 'aria-live': 'polite' });
    root.append(this.banner);
  }

  private vol(x: number, y: number): number {
    const d = Math.hypot(x - this.stage.camX, y - this.stage.camY);
    return Math.max(0, 1 - d / 1500);
  }

  onSnapshot(s: Snapshot): void {
    const you = s.you;
    const alive = you.state === 'alive';
    if (alive && you.entityId !== null) {
      if (!this.wasAlive) {
        this.lifeStart = performance.now();
        this.kos = 0;
        this.peak = 0;
        this.streak = 0;
      }
      this.myId = you.entityId;
      this.peak = Math.max(this.peak, you.stake);
    }
    // cash-out countdown: one tick per second held
    const step = alive ? Math.floor(you.cashout * 3) : 0;
    if (alive && you.cashout > 0 && step !== this.lastCashStep && step < 3) play('tick', 0.9);
    this.lastCashStep = step;

    for (const ev of s.events) this.event(ev);

    if (this.wasAlive && !alive) this.endLife();
    this.wasAlive = alive;
  }

  private event(ev: GameEvent): void {
    const me = this.myId;
    switch (ev.t) {
      case 'kill':
        if (ev.killerId !== null && ev.killerId === me) {
          this.kos++;
          this.streak++;
          play('airhorn', 0.9);
          if (ev.bounty) {
            this.showBanner(t('kingSlain', { n: formatCredits(ev.bounty) }));
            play('streak', 1, 0.3);
            play('coin', 1, 0.5);
          }
          if (this.gameId === 'blob' || this.gameId === 'coil') play('gulp', 0.8, 0.05);
          if (this.streak >= 2) this.showStreak();
        } else if (ev.victimId === me) {
          if (ev.cause === 'player') play('trombone', 0.9);
          else {
            play('bruh', 1);
            play('boom', 0.8, 0.38);
          }
        } else play('pop', this.vol(ev.x, ev.y) * 0.7);
        break;
      case 'cashout':
        if (ev.id === me) {
          play('coin', 1);
          play('coin', 0.8, 0.18);
          play('streak', 0.5, 0.3);
        }
        break;
      case 'skill': {
        const v = ev.id === me ? 0.8 : this.vol(ev.x, ev.y) * 0.4;
        play(ev.slot === 0 ? 'boing' : 'zap', v);
        break;
      }
      case 'king':
        if (ev.id === me) {
          this.showBanner(t('youAreKing'));
          play('streak', 0.9);
        }
        break;
      case 'spawn':
        if (ev.id === me) play('whoosh', 0.6);
        break;
      case 'fx': {
        const name = FX_SOUND[ev.kind];
        if (!name) break;
        const mine = ev.id !== undefined && ev.id === me;
        play(name, mine ? 1 : this.vol(ev.x, ev.y) * (ev.kind === 'bump' || ev.kind === 'hit' ? 0.5 : 0.85));
        break;
      }
    }
  }

  private showStreak(): void {
    const key = STREAK_KEYS[Math.min(this.streak, 6) - 2]!;
    this.showBanner(t(key));
    play('streak', 0.8, 0.5);
  }

  private showBanner(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 1600);
  }

  private endLife(): void {
    const seconds = Math.round((performance.now() - this.lifeStart) / 1000);
    const bests = this.loadBests();
    const best = { seconds: seconds > bests.seconds && seconds >= 10, kos: this.kos > bests.kos, peak: this.peak > bests.peak && this.peak > 100 };
    this.last = { seconds, kos: this.kos, peak: this.peak, best };
    this.saveBests({ seconds: Math.max(bests.seconds, seconds), kos: Math.max(bests.kos, this.kos), peak: Math.max(bests.peak, this.peak) });
    this.streak = 0;
  }

  private loadBests(): Bests {
    try {
      const raw = localStorage.getItem(`best:${this.gameId}`);
      if (raw) return { seconds: 0, kos: 0, peak: 0, ...(JSON.parse(raw) as Partial<Bests>) };
    } catch {
      /* ignore */
    }
    return { seconds: 0, kos: 0, peak: 0 };
  }

  private saveBests(b: Bests): void {
    try {
      localStorage.setItem(`best:${this.gameId}`, JSON.stringify(b));
    } catch {
      /* ignore */
    }
  }
}

/** Gentle reminder after every 30 minutes of play (no dark patterns: easy to act on). */
export class BreakReminder {
  private playedMs = 0;
  private last = performance.now();
  private nextAt = 30 * 60 * 1000;
  private el: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement, private readonly onBreak: () => void) {
    try {
      this.playedMs = Number(sessionStorage.getItem('playedMs') ?? 0) || 0;
      this.nextAt = Math.max(30 * 60 * 1000, Math.ceil((this.playedMs + 1) / (30 * 60 * 1000)) * 30 * 60 * 1000);
    } catch {
      /* ignore */
    }
  }

  update(now: number): void {
    const dt = Math.min(1000, now - this.last);
    this.last = now;
    if (document.hidden) return;
    this.playedMs += dt;
    if (Math.floor(this.playedMs / 5000) !== Math.floor((this.playedMs - dt) / 5000)) {
      try {
        sessionStorage.setItem('playedMs', String(Math.round(this.playedMs)));
      } catch {
        /* ignore */
      }
    }
    if (this.playedMs >= this.nextAt && !this.el) {
      this.nextAt += 30 * 60 * 1000;
      this.show();
    }
  }

  private show(): void {
    const mins = Math.round(this.playedMs / 60000);
    const stop = h('button.btn-play', {}, t('takeBreakBtn'));
    const keep = h('button.btn-ghost', {}, t('keepPlaying'));
    this.el = h('div.break-toast', { role: 'dialog' }, h('b', {}, t('breakTitle', { m: mins })), h('p', {}, t('takeBreak')), h('div.row', {}, keep, stop));
    stop.addEventListener('click', () => {
      this.hide();
      this.onBreak();
    });
    keep.addEventListener('click', () => this.hide());
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.append(this.el);
  }

  private hide(): void {
    this.el?.remove();
    this.el = null;
  }
}
