import { Container, Graphics, Sprite } from 'pixi.js';
import type { Text } from 'pixi.js';
import { BladeKind } from '@arena/engine';
import { EntFlag, type EntitySnap, type Snapshot } from '@arena/shared';
import type { Stage } from '../../render/stage';
import { PALETTE, shade } from '../../render/color';
import type { GameRenderer } from '../renderer';
import { commonEvents, destroyAll, makeLabels, setStake } from '../common';

type V = { root: Container; g: Graphics; name: Text; stake: Text; cache: { last: number }; color: number; trail: number[]; seen: number };

/** Blade Spin: obsidian floor, lava pools, glowing spinning blades. */
export class BladeRenderer implements GameRenderer {
  readonly gameId = 'blade' as const;
  private stage!: Stage;
  private spinners = new Map<number, V>();
  private orbs = new Map<number, { s: Sprite; seen: number }>();
  private lava = new Graphics();
  private orbLayer = new Container();
  private spinLayer = new Container();
  private frame = 0;
  private youId: number | null = null;

  init(stage: Stage, world: { w: number; h: number }): void {
    this.stage = stage;
    const g = new Graphics();
    g.rect(-2000, -2000, world.w + 4000, world.h + 4000).fill(0x0d0919);
    g.rect(0, 0, world.w, world.h).fill(0x1d1533);
    // hex-ish obsidian tiles
    for (let y = 0; y < world.h; y += 120) for (let x = (y / 120) % 2 ? 60 : 0; x < world.w; x += 120) g.circle(x, y, 52).stroke({ width: 2, color: 0x2a1f48 });
    g.rect(0, 0, world.w, world.h).stroke({ width: 12, color: PALETTE.violet });
    stage.layerBg.addChild(g);
    stage.layerMain.addChild(this.lava, this.orbLayer, this.spinLayer);
  }

  focusSize(e: EntitySnap): number {
    return 40 + (e.h ?? 0) * 1000 * 0.8;
  }

  onSnapshot(snap: Snapshot): void {
    if (snap.you.entityId !== null) this.youId = snap.you.entityId;
    const S = this.stage;
    commonEvents(S, snap, this.youId, (id) => this.spinners.get(id)?.color);
    for (const ev of snap.events) {
      if (ev.t !== 'fx' || Math.hypot(ev.x - S.camX, ev.y - S.camY) > 1400) continue;
      if (ev.kind === 'clash') {
        S.burst(ev.x, ev.y, 0xffffff, 16, 420, 4);
        S.burst(ev.x, ev.y, PALETTE.amber, 10, 300, 5);
        S.shake(4);
      } else if (ev.kind === 'lava') S.burst(ev.x, ev.y, 0xff6a3d, 30, 300, 8);
    }
  }

  render(ents: EntitySnap[], _snap: Snapshot, time: number): void {
    const f = ++this.frame;
    const t = time / 1000;
    const T = this.stage.textures;
    const lv = this.lava;
    lv.clear();
    for (const e of ents) {
      if (e.k === BladeKind.Lava) {
        lv.circle(e.x, e.y, e.r + 16).fill({ color: 0xff3d1f, alpha: 0.18 + 0.08 * Math.sin(t * 3 + e.id) });
        lv.circle(e.x, e.y, e.r).fill(0xc2341a);
        lv.circle(e.x, e.y, e.r * 0.72).fill(0xff6a3d);
        for (let i = 0; i < 4; i++) {
          const a = t * 0.8 + i * 1.7 + e.id;
          const rr = e.r * 0.45 * (0.5 + 0.5 * Math.sin(t * 2 + i));
          lv.circle(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr, 6 + 6 * Math.abs(Math.sin(t * 3 + i))).fill(0xffd84f);
        }
      } else if (e.k === BladeKind.Orb) {
        let o = this.orbs.get(e.id);
        if (!o) {
          const s = new Sprite(T.circle);
          s.anchor.set(0.5);
          s.tint = PALETTE.mint;
          this.orbLayer.addChild(s);
          o = { s, seen: f };
          this.orbs.set(e.id, o);
        }
        o.seen = f;
        o.s.position.set(e.x, e.y);
        o.s.scale.set((e.r / 64) * (1 + 0.25 * Math.sin(t * 6 + e.id)));
      } else if (e.k === BladeKind.Spinner) {
        let v = this.spinners.get(e.id);
        if (!v) {
          const root = new Container();
          const g = new Graphics();
          const { name, stake } = makeLabels(e.n ?? '', 0x0d0919);
          root.addChild(g, name, stake);
          this.spinLayer.addChild(root);
          v = { root, g, name, stake, cache: { last: -1 }, color: e.c ?? PALETTE.violet, trail: [], seen: f };
          this.spinners.set(e.id, v);
        }
        v.seen = f;
        this.drawSpinner(v, e, t);
      }
    }
    destroyAll(this.orbs, f, (o) => o.s.destroy());
    destroyAll(this.spinners, f, (v) => v.root.destroy({ children: true }));
  }

  private drawSpinner(v: V, e: EntitySnap, t: number): void {
    const flags = e.f ?? 0;
    const r = e.r;
    const L = (e.h ?? 0.05) * 1000;
    const a = e.a ?? 0;
    v.root.position.set(e.x, e.y);
    v.root.alpha = flags & EntFlag.Protected ? 0.55 + 0.35 * Math.sin(t * 14) : 1;
    const g = v.g;
    g.clear();
    // motion trail: the last few blade angles
    v.trail.unshift(a);
    if (v.trail.length > 6) v.trail.length = 6;
    v.trail.forEach((ta, i) => {
      if (i === 0) return;
      for (const k of [0, Math.PI]) {
        const c = Math.cos(ta + k);
        const s = Math.sin(ta + k);
        g.moveTo(c * (r + 6), s * (r + 6)).lineTo(c * (r + 4 + L), s * (r + 4 + L)).stroke({ width: 10, color: v.color, alpha: 0.12 * (1 - i / 6) });
      }
    });
    for (const k of [0, Math.PI]) {
      const c = Math.cos(a + k);
      const s = Math.sin(a + k);
      g.moveTo(c * (r + 4), s * (r + 4)).lineTo(c * (r + 4 + L), s * (r + 4 + L)).stroke({ width: 14, color: v.color, alpha: 0.35, cap: 'round' });
      g.moveTo(c * (r + 4), s * (r + 4)).lineTo(c * (r + 4 + L), s * (r + 4 + L)).stroke({ width: 6, color: 0xf3efff, cap: 'round' });
      g.circle(c * (r + 4 + L), s * (r + 4 + L), 6).fill(0xffffff);
    }
    g.circle(0, 0, r).fill(v.color).stroke({ width: 5, color: shade(v.color, 0.5) });
    g.circle(0, 0, r * 0.45).fill(shade(v.color, 0.6));
    g.circle(0, 0, r * 0.2).fill(0xffffff);
    if (flags & EntFlag.Shield) g.circle(0, 0, r + 10).stroke({ width: 6, color: PALETTE.sky, alpha: 0.7 + 0.3 * Math.sin(t * 9) });
    if (flags & EntFlag.Cashout) g.arc(0, 0, r + 18, -Math.PI / 2, -Math.PI / 2 + (e.p ?? 0) * Math.PI * 2).stroke({ width: 7, color: PALETTE.mint, cap: 'round' });
    if (flags & EntFlag.You) g.circle(0, 0, r + 6).stroke({ width: 3, color: 0xffffff, alpha: 0.5 });
    v.name.y = -r - 14;
    v.stake.y = -r - 36;
    setStake(v.stake, e.s ?? 0, v.cache);
  }

  destroy(): void {
    this.spinners.clear();
    this.orbs.clear();
  }
}
