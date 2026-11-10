import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { SUMO_CX, SUMO_CY, SumoKind } from '@arena/engine';
import { EntFlag, formatCredits, type EntitySnap, type Snapshot } from '@arena/shared';
import type { Stage } from '../../render/stage';
import { PALETTE, shade } from '../../render/color';
import type { GameRenderer } from '../renderer';

interface FighterView {
  root: Container;
  shadow: Sprite;
  body: Graphics;
  ring: Graphics;
  name: Text;
  stake: Text;
  lastStake: number;
  color: number;
  seen: number;
}

/** Sumo Smash: a glowing mat over the abyss, chubby wrestlers, pinball bumpers. */
export class SumoRenderer implements GameRenderer {
  readonly gameId = 'sumo' as const;
  private stage!: Stage;
  private mat = new Graphics();
  private waves = new Graphics();
  private bumperLayer = new Container();
  private fighterLayer = new Container();
  private fighters = new Map<number, FighterView>();
  private bumpers = new Map<number, { g: Graphics; flash: number; seen: number }>();
  private shock: { r: number; life: number } | null = null;
  private frame = 0;
  private youId: number | null = null;
  private radius = 1000;

  init(stage: Stage, world: { w: number; h: number }): void {
    this.stage = stage;
    const g = new Graphics();
    g.rect(-2000, -2000, world.w + 4000, world.h + 4000).fill(0x050c1c);
    // the abyss: concentric dark rings
    for (let r = 1500; r > 0; r -= 120) g.circle(SUMO_CX, SUMO_CY, r).stroke({ width: 3, color: 0x0d1d3a, alpha: 1 });
    stage.layerBg.addChild(g);
    this.fighterLayer.sortableChildren = true;
    stage.layerMain.addChild(this.mat, this.waves, this.bumperLayer, this.fighterLayer);
  }

  focusSize(): number {
    return 90;
  }

  onSnapshot(snap: Snapshot): void {
    if (snap.you.entityId !== null) this.youId = snap.you.entityId;
    const S = this.stage;
    for (const ev of snap.events) {
      if (ev.t === 'fx') {
        if (ev.kind === 'snap') {
          this.shock = { r: 120, life: 1 };
          S.shake(9);
          continue;
        }
        if (Math.hypot(ev.x - S.camX, ev.y - S.camY) > 1400) continue;
        const mine = ev.id === this.youId;
        if (ev.kind === 'smash') {
          S.burst(ev.x, ev.y, 0xffffff, 12, 380, 6);
          S.burst(ev.x, ev.y, PALETTE.sky, 10, 280, 7);
          S.shake(mine ? 8 : 4);
        } else if (ev.kind === 'bump') S.burst(ev.x, ev.y, 0xffffff, 4, 160, 4);
        else if (ev.kind === 'bumper') {
          S.burst(ev.x, ev.y, PALETTE.amber, 10, 300, 5);
          for (const b of this.bumpers.values()) if (Math.hypot(b.g.x - ev.x, b.g.y - ev.y) < 80) b.flash = 1;
        } else if (ev.kind === 'fall') S.burst(ev.x, ev.y, PALETTE.violet, 16, 200, 6);
      } else if (ev.t === 'kill') {
        if (ev.killerId !== null && ev.killerId === this.youId) {
          S.floatText(ev.x, ev.y - 30, `+${formatCredits(ev.amount)}`, PALETTE.amber);
          S.shake(10);
        } else if (ev.victimId === this.youId) S.shake(18);
      } else if (ev.t === 'cashout') {
        S.burst(ev.x, ev.y, PALETTE.mint, 30, 300, 7);
        if (ev.id === this.youId) S.floatText(ev.x, ev.y - 30, `+${formatCredits(ev.amount)}`, PALETTE.mint, 42);
      }
    }
  }

  render(ents: EntitySnap[], _snap: Snapshot, time: number, dtMs: number): void {
    const f = ++this.frame;
    const t = time / 1000;
    for (const e of ents) {
      if (e.k === SumoKind.Platform) this.drawMat(e, t);
      else if (e.k === SumoKind.Bumper) {
        let b = this.bumpers.get(e.id);
        if (!b) {
          b = { g: new Graphics(), flash: 0, seen: f };
          this.bumperLayer.addChild(b.g);
          this.bumpers.set(e.id, b);
        }
        b.seen = f;
        b.g.position.set(e.x, e.y);
        b.g.rotation = t * 2;
        b.flash = Math.max(0, b.flash - dtMs / 300);
        const g = b.g;
        g.clear();
        g.circle(0, 0, e.r + 10).fill({ color: PALETTE.amber, alpha: 0.18 + b.flash * 0.5 });
        g.circle(0, 0, e.r).fill(b.flash > 0 ? 0xffffff : 0x2a1b52).stroke({ width: 6, color: PALETTE.amber });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          g.moveTo(Math.cos(a) * e.r * 0.3, Math.sin(a) * e.r * 0.3).lineTo(Math.cos(a) * e.r * 0.85, Math.sin(a) * e.r * 0.85);
        }
        g.stroke({ width: 6, color: PALETTE.pink, cap: 'round' });
        g.circle(0, 0, e.r * 0.25).fill(PALETTE.amber);
      } else if (e.k === SumoKind.Fighter) {
        let v = this.fighters.get(e.id);
        if (!v) {
          v = this.makeFighter(e);
          this.fighterLayer.addChild(v.root);
          this.fighters.set(e.id, v);
        }
        v.seen = f;
        this.drawFighter(v, e, t);
      }
    }
    for (const [id, b] of this.bumpers) if (b.seen !== f) { b.g.destroy(); this.bumpers.delete(id); }
    for (const [id, v] of this.fighters) if (v.seen !== f) { v.root.destroy({ children: true }); this.fighters.delete(id); }

    // snap-back shockwave
    this.waves.clear();
    if (this.shock) {
      this.shock.r += dtMs * 1.6;
      this.shock.life -= dtMs / 700;
      if (this.shock.life <= 0) this.shock = null;
      else this.waves.circle(SUMO_CX, SUMO_CY, this.shock.r).stroke({ width: 26 * this.shock.life, color: PALETTE.sky, alpha: this.shock.life });
    }
  }

  private drawMat(e: EntitySnap, t: number): void {
    this.radius = e.r;
    const phase = e.p ?? 0;
    // the rim turns hot as the mat gets small
    const danger = phase >= 1 ? 1 : Math.max(0, (phase - 0.6) / 0.4);
    const pulse = 0.6 + 0.4 * Math.sin(t * (4 + danger * 10));
    const rim = danger > 0.3 ? PALETTE.pink : PALETTE.sky;
    const g = this.mat;
    g.clear();
    g.circle(SUMO_CX, SUMO_CY + 26, e.r).fill({ color: 0x000000, alpha: 0.5 });
    g.circle(SUMO_CX, SUMO_CY, e.r).fill(0x1b3a6b);
    g.circle(SUMO_CX, SUMO_CY, e.r * 0.82).fill(0x21467f);
    g.circle(SUMO_CX, SUMO_CY, e.r * 0.35).stroke({ width: 6, color: 0x2f5a9a });
    // starting lines, like a real ring
    g.rect(SUMO_CX - 70, SUMO_CY - 50, 10, 100).fill(0xf3efff);
    g.rect(SUMO_CX + 60, SUMO_CY - 50, 10, 100).fill(0xf3efff);
    g.circle(SUMO_CX, SUMO_CY, e.r).stroke({ width: 40, color: rim, alpha: 0.18 * pulse });
    g.circle(SUMO_CX, SUMO_CY, e.r).stroke({ width: 12, color: rim, alpha: 0.95 });
    g.circle(SUMO_CX, SUMO_CY, e.r - 14).stroke({ width: 4, color: PALETTE.amber, alpha: 0.8 });
  }

  private makeFighter(e: EntitySnap): FighterView {
    const T = this.stage.textures;
    const shadow = new Sprite(T.circle);
    shadow.anchor.set(0.5);
    shadow.tint = 0x000000;
    shadow.alpha = 0.35;
    const body = new Graphics();
    const ring = new Graphics();
    const style = { fontFamily: 'Nunito, sans-serif', fontWeight: '900' as const, fill: 0xffffff, stroke: { color: 0x050c1c, width: 5 } };
    const name = new Text({ text: e.n ?? '', style: { ...style, fontSize: 22 }, resolution: 2 });
    name.anchor.set(0.5, 1);
    const stake = new Text({ text: '', style: { ...style, fontSize: 18, fill: PALETTE.amber }, resolution: 2 });
    stake.anchor.set(0.5, 1);
    const root = new Container();
    root.addChild(shadow, body, ring, name, stake);
    return { root, shadow, body, ring, name, stake, lastStake: -1, color: e.c ?? PALETTE.sky, seen: 0 };
  }

  private drawFighter(v: FighterView, e: EntitySnap, t: number): void {
    const flags = e.f ?? 0;
    const falling = (e.h ?? 1) < 1;
    const fall = e.h ?? 1;
    const heavy = (flags & EntFlag.Shield) !== 0;
    const r = e.r;
    v.root.position.set(e.x, e.y);
    v.root.zIndex = e.y;
    v.root.scale.set(falling ? 0.3 + 0.7 * fall : 1);
    v.root.alpha = (flags & EntFlag.Protected ? 0.55 + 0.35 * Math.sin(t * 14) : 1) * (falling ? fall : 1);
    v.shadow.visible = !falling;
    v.shadow.scale.set((r * 1.1) / 64, (r * 0.75) / 64);
    v.shadow.position.set(5, 12);
    const color = heavy ? 0x9aa3b5 : v.color;
    const a = e.a ?? 0;
    const g = v.body;
    g.clear();
    // squash and stretch while ramming
    const ram = (flags & EntFlag.Dash) !== 0;
    g.rotation = a;
    g.scale.set(ram ? 1.18 : 1, ram ? 0.86 : 1);
    g.circle(0, 0, r).fill(color).stroke({ width: 5, color: shade(color, 0.5) });
    // belt
    g.rect(-r * 0.25, -r * 0.95, r * 0.5, r * 1.9).fill(shade(color, 0.35));
    // face looking forward
    g.circle(r * 0.5, -r * 0.3, r * 0.17).fill(0xffffff);
    g.circle(r * 0.5, r * 0.3, r * 0.17).fill(0xffffff);
    g.circle(r * 0.58, -r * 0.3, r * 0.08).fill(0x0b1020);
    g.circle(r * 0.58, r * 0.3, r * 0.08).fill(0x0b1020);
    if (heavy) g.circle(0, 0, r + 6).stroke({ width: 5, color: 0xdfe6f3, alpha: 0.9 });
    if (ram && Math.random() < 0.7) {
      const back = a + Math.PI;
      this.stage.spawnParticle(e.x + Math.cos(back) * r, e.y + Math.sin(back) * r, Math.cos(back) * 120, Math.sin(back) * 120, PALETTE.sky, r * 0.5, 0.3, -1.5);
    }
    const ring = v.ring;
    ring.clear();
    if (flags & EntFlag.Cashout) ring.arc(0, 0, r + 16, -Math.PI / 2, -Math.PI / 2 + (e.p ?? 0) * Math.PI * 2).stroke({ width: 7, color: PALETTE.mint, cap: 'round' });
    if (flags & EntFlag.You) ring.circle(0, 0, r + 9).stroke({ width: 3, color: 0xffffff, alpha: 0.55 });
    v.name.y = -r - 14;
    v.stake.y = -r - 36;
    const s = e.s ?? 0;
    if (s !== v.lastStake) {
      v.stake.text = formatCredits(s);
      v.lastStake = s;
    }
  }

  destroy(): void {
    this.fighters.clear();
    this.bumpers.clear();
  }
}
