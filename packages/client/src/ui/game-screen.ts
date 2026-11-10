import { GAME_CATALOG, formatCredits, SPAWN_STAKE, TICK_MS, type GameId, type Snapshot } from '@arena/shared';
import { CLIENT_GAMES, type ClientGame } from '../games';
import type { GameRenderer } from '../games/renderer';
import { Controls } from '../input/controls';
import { SnapshotBuffer } from '../net/interp';
import type { GameSession } from '../net/session';
import { Stage } from '../render/stage';
import { t } from '../i18n';
import type { Dict } from '../i18n/en';
import { h } from './dom';
import { Hud } from './hud';
import { BreakReminder, Juice } from './juice';
import { KingMarker } from './king';
import { activeChallenge, setActiveChallenge, shareRun } from './share';

/** Hosts one game: stage + renderer + HUD + input, driven by a GameSession. */
export class GameScreen {
  private readonly el = h('div.stage');
  private readonly stage = new Stage();
  private readonly buffer = new SnapshotBuffer();
  private renderer!: GameRenderer;
  private controls!: Controls;
  private hud!: Hud;
  private overlay: HTMLElement | null = null;
  private raf = 0;
  private lastFrame = 0;
  private lastState: Snapshot['you']['state'] | null = null;
  private killer: string | null = null;
  private deathCause: string | null = null;
  private lastStake = 0;
  private myId: number | null = null;
  private readonly accent: string;
  private texts!: ClientGame['texts'];

  constructor(
    private readonly host: HTMLElement,
    private readonly gameId: GameId,
    private readonly session: GameSession,
    private readonly onExit: () => void,
  ) {
    const meta = GAME_CATALOG.find((g) => g.id === gameId)!;
    this.accent = meta.accent;
    this.el.style.setProperty('--accent', meta.accent);
    host.replaceChildren(this.el);
    this.buffer.delayMs = session.interpDelayMs;
    this.hud = null as unknown as Hud;
    void this.start(meta.skills.map((s) => s.name) as [string, string]);
  }

  private async start(skillNames: [string, string]): Promise<void> {
    await this.stage.init(this.el);
    const cg = CLIENT_GAMES[this.gameId];
    if (!cg) throw new Error(`no renderer for ${this.gameId}`);
    this.texts = cg.texts;
    this.renderer = cg.make();
    this.controls = new Controls(this.el);
    this.hud = new Hud(this.controls, skillNames, cg.texts);
    this.el.append(this.hud.root);
    this.juice = new Juice(this.el, this.gameId, this.stage);
    this.king = new KingMarker(this.stage, this.el);
    this.breaks = new BreakReminder(this.el, () => this.exit());

    let inited = false;
    this.session.onSnapshot = (snap, at) => {
      if (!inited) {
        this.renderer.init(this.stage, snap.world);
        inited = true;
      }
      this.buffer.push(snap, at);
      this.renderer.onSnapshot(snap);
      this.juice.onSnapshot(snap);
      this.trackDeath(snap);
      this.hud.update(snap);
    };
    this.showHowTo();
    if (this.session.roomCode) {
      const code = this.session.roomCode;
      const chip = h('button.room-chip', { type: 'button' }, t('roomChip', { code }));
      chip.addEventListener('pointerdown', (e) => e.stopPropagation());
      chip.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${code}#${this.gameId}`);
          chip.textContent = t('linkCopied');
          setTimeout(() => (chip.textContent = t('roomChip', { code })), 2000);
        } catch {
          /* ignore */
        }
      });
      this.el.append(chip);
    }
    this.session.onStatus = (s) => {
      if (s === 'closed') this.showDisconnected();
    };
    this.session.requestSpawn();
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    const dt = Math.min(100, now - this.lastFrame);
    this.lastFrame = now;
    this.session.sendInput(this.controls.read());
    this.session.update(now);
    const sample = this.buffer.sample(now);
    if (sample) {
      const me = sample.ents.find((e) => e.id === sample.snap.you.entityId);
      if (me) this.stage.follow(me.x, me.y, this.renderer.focusSize(me), dt);
      this.renderer.render(sample.ents, sample.snap, now, dt);
      this.king?.update(sample.ents, sample.snap, now);
      if (Math.floor(now / TICK_MS) % 3 === 0) this.hud.drawMinimap(sample.snap, this.accent);
    }
    this.stage.update(dt);
    this.breaks?.update(now);
    this.raf = requestAnimationFrame(this.frame);
  };

  private trackDeath(s: Snapshot): void {
    const you = s.you;
    if (you.state === 'alive') {
      this.lastStake = you.stake;
      this.myId = you.entityId;
    }
    // the entity is already removed when its death snapshot arrives, so match on the last known id
    for (const ev of s.events) {
      if (ev.t === 'kill' && ev.victimId === this.myId) {
        this.killer = ev.killerName;
        this.deathCause = ev.cause;
      }
    }
    if (you.state !== this.lastState) {
      if (you.state === 'dead') this.showDeath(s);
      else if (you.state === 'cashed') this.showCashed();
      else if (you.state === 'alive') this.closeOverlay();
      this.lastState = you.state;
    }
    if (this.overlay && you.state === 'dead') this.updateRespawn(s);
  }

  private respawnBtn: HTMLButtonElement | null = null;
  private juice!: Juice;
  private king: KingMarker | null = null;
  private breaks: BreakReminder | null = null;

  /** "Share & challenge" for the life that just ended (plus the beat-the-challenge moment). */
  private shareButton(): HTMLElement {
    const life = this.juice.last;
    if (!life) return h('div');
    const ch = activeChallenge();
    const beat = ch && ch.g === this.gameId && life.peak > ch.p ? ch : null;
    const btn = h('button.btn-share', {}, t('share'));
    const note = h('p.share-note');
    btn.addEventListener('click', async () => {
      const name = this.myName();
      const r = await shareRun(this.gameId, name, life, beat);
      if (r === 'copied') note.textContent = t('linkCopied');
    });
    const wrap = h('div.share-row', {}, btn, note);
    if (beat) {
      wrap.prepend(h('div.beat', {}, t('youBeat', { name: beat.n })));
      setActiveChallenge(null);
    }
    return wrap;
  }

  /** First visit to a game: three lines on how it works. Dismissed with a tap; the game runs behind it. */
  private showHowTo(): void {
    const key = `howto:${this.gameId}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      return;
    }
    const lines = ([1, 2, 3] as const).map((n) => h('li', {}, t(`how_${this.gameId}_${n}` as keyof Dict)));
    const ok = h('button.btn-play', {}, t('gotIt'));
    const card = h('div.howto', { role: 'dialog' }, h('b', {}, t('howToPlay')), h('ul', {}, ...lines), ok);
    const close = () => {
      card.remove();
      try {
        localStorage.setItem(key, '1');
      } catch {
        /* ignore */
      }
    };
    ok.addEventListener('click', close);
    card.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.append(card);
    setTimeout(close, 12000);
  }

  private myName(): string {
    try {
      return localStorage.getItem('nick') || 'Player';
    } catch {
      return 'Player';
    }
  }

  /** Stats for the life that just ended, with personal-best badges. */
  private lifeStats(): HTMLElement {
    const l = this.juice.last;
    if (!l) return h('div');
    const mm = `${Math.floor(l.seconds / 60)}:${String(l.seconds % 60).padStart(2, '0')}`;
    const cell = (label: string, value: string, best: boolean) =>
      h(`div.stat${best ? '.best' : ''}`, {}, h('b', {}, value), h('span', {}, label), best ? h('i', {}, t('newBest')) : '');
    return h('div.life-stats', {}, cell(t('lifeTime'), mm, l.best.seconds), cell(t('lifeKos'), String(l.kos), l.best.kos), cell(t('lifePeak'), formatCredits(l.peak), l.best.peak));
  }

  private showDeath(s: Snapshot): void {
    const title = this.killer ? t(this.texts.killedBy, { name: this.killer }) : this.deathCause === 'hazard' ? t(this.texts.hazard) : t('youLost');
    this.respawnBtn = h('button.btn-play', {}, t('respawn'));
    this.respawnBtn.addEventListener('click', () => this.respawn());
    this.openOverlay(
      h('h2', {}, title),
      h('p', {}, t('youLost')),
      h('div.big', {}, `-${formatCredits(this.lastStake)}`),
      this.lifeStats(),
      this.shareButton(),
      this.respawnBtn,
      h('div.row', { style: 'margin-top:10px' }, this.menuButton()),
    );
    this.updateRespawn(s);
    this.killer = null;
    this.deathCause = null;
  }

  private updateRespawn(s: Snapshot): void {
    const b = this.respawnBtn;
    if (!b) return;
    const wait = Math.max(0, s.you.respawnAt - s.tick);
    if (s.you.wallet < SPAWN_STAKE) {
      b.textContent = t('freeRefill');
      b.disabled = false;
      b.onclick = () => this.session.refill();
    } else if (wait > 0) {
      b.disabled = true;
      b.textContent = t('respawnIn', { s: (wait / 30).toFixed(1) });
    } else {
      b.disabled = false;
      b.textContent = t('respawn');
      b.onclick = () => this.respawn();
    }
  }

  private showCashed(): void {
    const again = h('button.btn-play', {}, t('playAgain'));
    again.addEventListener('click', () => this.respawn());
    this.openOverlay(h('h2', {}, t('cashedOut')), h('p', {}, t('addedToWallet')), h('div.big', {}, `+${formatCredits(this.lastStake)}`), this.lifeStats(), this.shareButton(), again, h('div.row', { style: 'margin-top:10px' }, this.menuButton()));
  }

  private showDisconnected(): void {
    const back = h('button.btn-play', {}, t('menu'));
    back.addEventListener('click', () => this.exit());
    this.openOverlay(h('h2', {}, t('disconnected')), h('p', {}, t('disconnectedHint')), back);
    this.lastState = null;
  }

  private menuButton(): HTMLButtonElement {
    const b = h('button.btn-ghost', {}, t('menu'));
    b.addEventListener('click', () => this.exit());
    return b;
  }

  private respawn(): void {
    this.session.requestSpawn();
  }

  private openOverlay(...children: HTMLElement[]): void {
    this.closeOverlay();
    this.overlay = h('div.overlay', {}, h('div.card', {}, ...children));
    this.overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.append(this.overlay);
  }

  private closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.respawnBtn = null;
  }

  exit(): void {
    cancelAnimationFrame(this.raf);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    this.controls?.dispose();
    this.hud?.ac.abort();
    this.session.dispose();
    this.renderer?.destroy();
    this.king?.destroy();
    this.stage.destroy();
    this.onExit();
  }
}
