import { formatCredits, PLAY_CREDITS_DISCLAIMER, type GameEvent, type Snapshot } from '@arena/shared';
import { t } from '../i18n';
import type { Controls } from '../input/controls';
import type { ClientGame } from '../games';
import { settings } from '../settings';
import { play, toggleMute } from '../audio/sfx';
import { h } from './dom';

/** DOM heads-up display. Updates are diffed to avoid layout thrash at 60 FPS. */
export class Hud {
  readonly root = h('div.hud');
  private wallet = h('b');
  private stake = h('b');
  private kills = h('b');
  private lb = h('ol');
  private feed = h('div.hud-feed');
  readonly minimap = h('canvas.minimap.panel');
  private skills: HTMLButtonElement[] = [];
  private cash: HTMLButtonElement;
  private last = { wallet: -1, stake: -1, kills: -1, lb: '' };
  private readyPrev: [boolean, boolean] = [true, true];
  readonly ac = new AbortController();

  constructor(controls: Controls, skillNames: [string, string], private readonly texts: ClientGame['texts']) {
    const row = (label: string, val: HTMLElement, cls = '') => h(`div.row${cls}`, {}, h('span', {}, label), val);
    this.root.append(
      h('div.hud-wallet.panel', {}, row(t('stake'), this.stake, '.stake'), row(t('wallet'), this.wallet), row(t('kills'), this.kills)),
      h('div.hud-lb.panel', {}, h('h4', {}, t('leaderboard')), this.lb),
      this.feed,
      this.minimap,
      h('div.hud-disclaimer', {}, t('disclaimer')),
    );
    this.minimap.width = 220;
    this.minimap.height = 220;

    const controlsEl = h('div.controls');
    const keys = ['Space', 'E'];
    skillNames.forEach((name, i) => {
      const b = h('button.skill', { 'data-slot': String(i), 'aria-label': name }, name, h('span.key', {}, keys[i]!));
      this.bindHold(b, (on) => (controls.buttons[i === 0 ? 'skill1' : 'skill2'] = on));
      this.skills.push(b);
      controlsEl.append(b);
    });
    this.cash = h('button.cashout', { 'aria-label': t('cashout') }, t('cashout'));
    this.bindHold(this.cash, (on) => (controls.buttons.cashout = on));
    controlsEl.append(this.cash);
    this.root.append(controlsEl);
    this.root.title = PLAY_CREDITS_DISCLAIMER;

    // sound toggle (also the M key)
    const mute = h('button.mute', { 'aria-label': t('sound') });
    const paint = () => {
      mute.textContent = settings.muted ? '🔇' : '🔊';
      mute.setAttribute('aria-pressed', String(!settings.muted));
    };
    paint();
    const flip = () => {
      toggleMute();
      paint();
      play('click', 0.6);
    };
    mute.addEventListener('pointerdown', (e) => e.stopPropagation());
    mute.addEventListener('click', flip);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !(e.target instanceof HTMLInputElement)) flip();
    }, { signal: this.ac.signal });
    this.root.append(mute);
  }

  private bindHold(el: HTMLElement, set: (on: boolean) => void): void {
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      el.classList.add('on');
      set(true);
    });
    const off = () => {
      el.classList.remove('on');
      set(false);
    };
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
  }

  update(s: Snapshot): void {
    const y = s.you;
    if (y.wallet !== this.last.wallet) this.wallet.textContent = formatCredits((this.last.wallet = y.wallet));
    if (y.stake !== this.last.stake) this.stake.textContent = formatCredits((this.last.stake = y.stake));
    if (y.kills !== this.last.kills) this.kills.textContent = String((this.last.kills = y.kills));

    const lbKey = s.lb.map((r) => `${r.id}:${r.stake}`).join(',') + `|${y.entityId}`;
    if (lbKey !== this.last.lb) {
      this.last.lb = lbKey;
      this.lb.replaceChildren(
        ...s.lb.map((r, i) =>
          h(`li${r.id === y.entityId ? '.me' : ''}`, {}, h('span', {}, `${i + 1}.`), h('span.n', {}, r.name), h('span.s', {}, formatCredits(r.stake))),
        ),
      );
    }

    for (let i = 0; i < 2; i++) {
      const max = y.cooldownMax[i]!;
      const cd = y.cooldowns[i]!;
      const b = this.skills[i]!;
      b.style.setProperty('--p', max > 0 ? (cd / max).toFixed(3) : '0');
      const ready = cd === 0;
      if (ready && !this.readyPrev[i]) {
        b.classList.remove('ready');
        void b.offsetWidth; // restart animation
        b.classList.add('ready');
      }
      this.readyPrev[i as 0 | 1] = ready;
    }
    this.cash.style.setProperty('--p', y.cashout.toFixed(3));
    this.cash.textContent = y.cashout > 0 ? t('cashingOut') : t('cashout');
    this.root.classList.toggle('dead', y.state !== 'alive');

    for (const ev of s.events) this.pushFeed(ev);
  }

  private pushFeed(ev: GameEvent): void {
    let el: HTMLElement | null = null;
    if (ev.t === 'kill') {
      const text = ev.killerName ? t(this.texts.feedKill, { killer: ev.killerName, victim: ev.victimName }) : t(this.texts.feedHazard, { victim: ev.victimName });
      el = h('div.panel', {}, h('span.k', {}, '☠ '), text, ev.amount ? h('span.amt', {}, ` +${formatCredits(ev.amount)}`) : '');
    } else if (ev.t === 'cashout') {
      el = h('div.panel', {}, '💰 ', t('cashFeed', { name: ev.name }), h('span.amt', {}, ` ${formatCredits(ev.amount)}`));
    }
    if (!el) return;
    this.feed.prepend(el);
    while (this.feed.childElementCount > 4) this.feed.lastElementChild?.remove();
    setTimeout(() => el?.remove(), 4500);
  }

  /** Minimap: world bounds, you, and nearby players. */
  drawMinimap(s: Snapshot, accent: string): void {
    const c = this.minimap.getContext('2d');
    if (!c) return;
    const W = this.minimap.width;
    c.clearRect(0, 0, W, W);
    c.fillStyle = '#ffffff10';
    c.fillRect(0, 0, W, W);
    const k = W / Math.max(s.world.w, s.world.h);
    for (const e of s.ents) {
      if (e.n === undefined) continue;
      const me = e.id === s.you.entityId;
      c.fillStyle = me ? accent : '#ffffff70';
      c.beginPath();
      c.arc(e.x * k, e.y * k, Math.max(me ? 6 : 3, e.r * k), 0, Math.PI * 2);
      c.fill();
    }
  }
}
