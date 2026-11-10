import { Container, Graphics, Sprite } from 'pixi.js';
import { TankKind } from '@arena/engine';
import { EntFlag, type EntitySnap, type Snapshot } from '@arena/shared';
import type { Text } from 'pixi.js';
import type { Stage } from '../../render/stage';
import { PALETTE, shade } from '../../render/color';
import type { GameRenderer } from '../renderer';
import { commonEvents, destroyAll, makeLabels, setStake } from '../common';

type V = { root: Container; hull: Graphics; turret: Graphics; ring: Graphics; hp: Graphics; name: Text; stake: Text; cache: { last: number }; lastHp: number; color: number; recoil: number; seen: number };
type S = { g: Container; seen: number };

/** Tank Duel: desert-steel arena, treaded tanks with auto-aiming turrets. */
export class TankRenderer implements GameRenderer {
  readonly gameId = 'tank' as const;
  private stage!: Stage;
  private tanks = new Map<number, V>();
  private statics = new Map<number, S>();
  private shells = new Graphics();
  private staticLayer = new Container();
  private tankLayer = new Container();
  private frame = 0;
  private youId: number | null = null;

  init(stage: Stage, world: { w: number; h: number }): void {
    this.stage = stage;
    const g = new Graphics();
    g.rect(-2000, -2000, world.w + 4000, world.h + 4000).fill(0x14100a);
    g.rect(0, 0, world.w, world.h).fill(0x2b2216);
    for (let x = 0; x <= world.w; x += 100) g.moveTo(x, 0).lineTo(x, world.h);
    for (let y = 0; y <= world.h; y += 100) g.moveTo(0, y).lineTo(world.w, y);
    g.stroke({ width: 2, color: 0x3a2e1c });
    g.rect(0, 0, world.w, world.h).stroke({ width: 12, color: PALETTE.amber });
    stage.layerBg.addChild(g);
    this.tankLayer.sortableChildren = true;
    stage.layerMain.addChild(this.staticLayer, this.tankLayer, this.shells);
  }

  focusSize(): number {
    return 80;
  }

  onSnapshot(snap: Snapshot): void {
    if (snap.you.entityId !== null) this.youId = snap.you.entityId;
    const S = this.stage;
    commonEvents(S, snap, this.youId, (id) => this.tanks.get(id)?.color);
    for (const ev of snap.events) {
      if (ev.t !== 'fx' || Math.hypot(ev.x - S.camX, ev.y - S.camY) > 1400) continue;
      if (ev.kind === 'shot') {
        S.burst(ev.x, ev.y, PALETTE.amber, 5, 200, 5);
        const v = ev.id !== undefined ? this.tanks.get(ev.id) : undefined;
        if (v) v.recoil = 1;
      } else if (ev.kind === 'hit') S.burst(ev.x, ev.y, 0xffffff, 8, 260, 4);
      else if (ev.kind === 'ricochet') S.burst(ev.x, ev.y, PALETTE.amber, 4, 180, 3);
      else if (ev.kind === 'mine') {
        S.burst(ev.x, ev.y, 0xff6a3d, 34, 460, 9);
        S.burst(ev.x, ev.y, 0xffd84f, 16, 300, 7);
        S.shake(10);
      } else if (ev.kind === 'orb') S.burst(ev.x, ev.y, PALETTE.mint, 14, 220, 5);
    }
  }

  render(ents: EntitySnap[], _snap: Snapshot, time: number, dtMs: number): void {
    const f = ++this.frame;
    const t = time / 1000;
    const sh = this.shells;
    sh.clear();
    for (const e of ents) {
      if (e.k === TankKind.Tank) {
        let v = this.tanks.get(e.id);
        if (!v) {
          v = this.makeTank(e);
          this.tankLayer.addChild(v.root);
          this.tanks.set(e.id, v);
        }
        v.seen = f;
        this.drawTank(v, e, t, dtMs);
      } else if (e.k === TankKind.Shell) {
        const a = e.a ?? 0;
        sh.moveTo(e.x - Math.cos(a) * 26, e.y - Math.sin(a) * 26).lineTo(e.x, e.y).stroke({ width: 6, color: PALETTE.amber, alpha: 0.5, cap: 'round' });
        sh.circle(e.x, e.y, 6).fill(0xfff1c4);
      } else {
        let s = this.statics.get(e.id);
        if (!s || s.g.label !== String(e.k)) {
          s?.g.destroy({ children: true });
          s = { g: this.makeStatic(e), seen: f };
          s.g.label = String(e.k);
          this.staticLayer.addChild(s.g);
          this.statics.set(e.id, s);
        }
        s.seen = f;
        s.g.position.set(e.x, e.y);
        if (e.k === TankKind.Mine) {
          const blink = s.g.getChildByLabel('blink');
          if (blink) blink.alpha = (e.p ?? 0) > 0 ? (Math.sin(t * 8 + e.id) > 0 ? 1 : 0.2) : 0.15;
        } else if (e.k === TankKind.Kit) s.g.scale.set(1 + 0.12 * Math.sin(t * 5 + e.id));
      }
    }
    destroyAll(this.tanks, f, (v) => v.root.destroy({ children: true }));
    destroyAll(this.statics, f, (s) => s.g.destroy({ children: true }));
  }

  private makeStatic(e: EntitySnap): Container {
    const c = new Container();
    const g = new Graphics();
    if (e.k === TankKind.Crate) {
      g.circle(6, 10, e.r).fill({ color: 0x000000, alpha: 0.3 });
      g.roundRect(-e.r * 0.8, -e.r * 0.8, e.r * 1.6, e.r * 1.6, 10).fill(0x7a5a33).stroke({ width: 6, color: 0x4a3418 });
      g.moveTo(-e.r * 0.8, -e.r * 0.8).lineTo(e.r * 0.8, e.r * 0.8).moveTo(e.r * 0.8, -e.r * 0.8).lineTo(-e.r * 0.8, e.r * 0.8).stroke({ width: 6, color: 0x4a3418 });
      c.addChild(g);
    } else if (e.k === TankKind.Mine) {
      g.circle(0, 0, e.r + 4).fill(0x2a2a2a).stroke({ width: 3, color: 0x111111 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.circle(Math.cos(a) * e.r, Math.sin(a) * e.r, 4).fill(0x555555);
      }
      const blink = new Graphics().circle(0, 0, 6).fill(0xff3d3d);
      blink.label = 'blink';
      c.addChild(g, blink);
    } else {
      const glow = new Sprite(this.stage.textures.soft);
      glow.anchor.set(0.5);
      glow.tint = PALETTE.mint;
      glow.scale.set((e.r * 4) / 64);
      g.roundRect(-e.r, -e.r, e.r * 2, e.r * 2, 6).fill(0xf3efff).stroke({ width: 3, color: PALETTE.mint });
      g.rect(-e.r * 0.6, -3.5, e.r * 1.2, 7).fill(0xff4f7b);
      g.rect(-3.5, -e.r * 0.6, 7, e.r * 1.2).fill(0xff4f7b);
      c.addChild(glow, g);
    }
    return c;
  }

  private makeTank(e: EntitySnap): V {
    const root = new Container();
    const hull = new Graphics();
    const turret = new Graphics();
    const ring = new Graphics();
    const hp = new Graphics();
    const { name, stake } = makeLabels(e.n ?? '', 0x14100a);
    root.addChild(hull, turret, ring, hp, name, stake);
    return { root, hull, turret, ring, hp, name, stake, cache: { last: -1 }, lastHp: -1, color: e.c ?? PALETTE.amber, recoil: 0, seen: 0 };
  }

  private drawTank(v: V, e: EntitySnap, t: number, dtMs: number): void {
    const r = e.r;
    const flags = e.f ?? 0;
    v.root.position.set(e.x, e.y);
    v.root.zIndex = e.y;
    v.root.alpha = flags & EntFlag.Protected ? 0.55 + 0.35 * Math.sin(t * 14) : 1;
    const h = v.hull;
    h.clear();
    h.rotation = e.a ?? 0;
    h.roundRect(-r * 1.05 + 5, -r * 0.95 + 8, r * 2.1, r * 1.9, 10).fill({ color: 0x000000, alpha: 0.3 });
    // treads with moving links
    for (const side of [-1, 1]) {
      h.roundRect(-r * 1.05, side * r * 0.62 - r * 0.33, r * 2.1, r * 0.66, 8).fill(0x2a2a2a);
      for (let i = -3; i <= 3; i++) {
        const x = ((i * r * 0.3 + ((t * 120) % (r * 0.3))) % (r * 2)) - r * 0.05;
        h.rect(x - 2, side * r * 0.62 - r * 0.3, 4, r * 0.6).fill(0x444444);
      }
    }
    h.roundRect(-r * 0.85, -r * 0.55, r * 1.7, r * 1.1, 8).fill(v.color).stroke({ width: 4, color: shade(v.color, 0.5) });
    v.recoil = Math.max(0, v.recoil - dtMs / 160);
    const turretAngle = e.pts?.[0] ?? e.a ?? 0;
    const tg = v.turret;
    tg.clear();
    tg.rotation = turretAngle;
    tg.roundRect(r * 0.2 - v.recoil * 8, -5, r * 1.15, 10, 4).fill(shade(v.color, 0.7)).stroke({ width: 3, color: shade(v.color, 0.4) });
    tg.circle(0, 0, r * 0.45).fill(shade(v.color, 1.15)).stroke({ width: 3, color: shade(v.color, 0.5) });
    const ring = v.ring;
    ring.clear();
    if (flags & EntFlag.Shield) ring.circle(0, 0, r + 14).stroke({ width: 6, color: PALETTE.violet, alpha: 0.7 + 0.3 * Math.sin(t * 9) });
    if (flags & EntFlag.Cashout) ring.arc(0, 0, r + 20, -Math.PI / 2, -Math.PI / 2 + (e.p ?? 0) * Math.PI * 2).stroke({ width: 7, color: PALETTE.mint, cap: 'round' });
    if (flags & EntFlag.You) ring.circle(0, 0, r + 8).stroke({ width: 3, color: 0xffffff, alpha: 0.5 });
    if (flags & EntFlag.Dash && Math.random() < 0.6) {
      const back = (e.a ?? 0) + Math.PI;
      this.stage.spawnParticle(e.x + Math.cos(back) * r, e.y + Math.sin(back) * r, Math.cos(back) * 90, Math.sin(back) * 90, 0x8a7a66, r * 0.5, 0.4, 1);
    }
    const hpv = e.h ?? 1;
    if (hpv !== v.lastHp) {
      v.lastHp = hpv;
      v.hp.clear();
      v.hp.roundRect(-r - 2, r + 12, r * 2 + 4, 11, 5).fill({ color: 0x14100a, alpha: 0.85 });
      v.hp.roundRect(-r, r + 14, r * 2 * hpv, 7, 3.5).fill(hpv > 0.6 ? PALETTE.mint : hpv > 0.3 ? PALETTE.amber : PALETTE.pink);
    }
    v.name.y = -r - 16;
    v.stake.y = -r - 38;
    setStake(v.stake, e.s ?? 0, v.cache);
  }

  destroy(): void {
    this.tanks.clear();
    this.statics.clear();
  }
}
