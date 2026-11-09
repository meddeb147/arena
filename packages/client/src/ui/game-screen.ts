import { GAME_CATALOG, formatCredits, SPAWN_STAKE, TICK_MS, type GameId, type Snapshot } from '@arena/shared';
import { RENDERERS } from '../games';
import type { GameRenderer } from '../games/renderer';
import { Controls } from '../input/controls';
import { SnapshotBuffer } from '../net/interp';
import type { GameSession } from '../net/session';
import { Stage } from '../render/stage';
import { t } from '../i18n';
import { h } from './dom';
import { Hud } from './hud';

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
    this.hud = null as unknown as Hud;
    void this.start(meta.skills.map((s) => s.name) as [string, string]);
  }

  private async start(skillNames: [string, string]): Promise<void> {
    await this.stage.init(this.el);
    const make = RENDERERS[this.gameId];
    if (!make) throw new Error(`no renderer for ${this.gameId}`);
    this.renderer = make();
    this.controls = new Controls(this.el);
    this.hud = new Hud(this.controls, skillNames);
    this.el.append(this.hud.root);

    let inited = false;
    this.session.onSnapshot = (snap, at) => {
      if (!inited) {
        this.renderer.init(this.stage, snap.world);
        inited = true;
      }
      this.buffer.push(snap, at);
      this.renderer.onSnapshot(snap);
      this.trackDeath(snap);
      this.hud.update(snap);
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
      if (Math.floor(now / TICK_MS) % 3 === 0) this.hud.drawMinimap(sample.snap, this.accent);
    }
    this.stage.update(dt);
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

  private showDeath(s: Snapshot): void {
    const title = this.killer ? t('eatenBy', { name: this.killer }) : this.deathCause === 'hazard' ? t('poppedByTrap') : t('youLost');
    this.respawnBtn = h('button.btn-play', {}, t('respawn'));
    this.respawnBtn.addEventListener('click', () => this.respawn());
    this.openOverlay(
      h('h2', {}, title),
      h('p', {}, t('youLost')),
      h('div.big', {}, `-${formatCredits(this.lastStake)}`),
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
    this.openOverlay(h('h2', {}, t('cashedOut')), h('p', {}, t('addedToWallet')), h('div.big', {}, `+${formatCredits(this.lastStake)}`), again, h('div.row', { style: 'margin-top:10px' }, this.menuButton()));
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
    this.controls?.dispose();
    this.session.dispose();
    this.renderer?.destroy();
    this.stage.destroy();
    this.onExit();
  }
}
