import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { COIL_CONFIG, CoilKind } from '@arena/engine';
import { EntFlag, formatCredits, type EntitySnap, type Snapshot } from '@arena/shared';
import type { Stage } from '../../render/stage';
import { PALETTE, PELLET_COLORS, shade } from '../../render/color';
import type { GameRenderer } from '../renderer';

interface SnakeView {
  body: Graphics;
  shadow: Graphics;
  head: Container;
  eyes: Graphics;
  ring: Graphics;
  name: Text;
  stake: Text;
  lastStake: number;
  color: number;
  seen: number;
}

/** Coil Stake: neon snakes on a dark teal field. */
export class CoilRenderer implements GameRenderer {
  readonly gameId = 'coil' as const;
  private stage!: Stage;
  private snakes = new Map<number, SnakeView>();
  private pellets = new Map<number, { s: Sprite; glow: Sprite | null; seen: number }>();
  private traps = new Map<number, { c: Container; seen: number }>();
  private pelletLayer = new Container();
  private trapLayer = new Container();
  private shadowLayer = new Container();
  private snakeLayer = new Container();
  private frame = 0;
  private youId: number | null = null;

  init(stage: Stage, world: { w: number; h: number }): void {
    this.stage = stage;
    const g = new Graphics();
    g.rect(-2000, -2000, world.w + 4000, world.h + 4000).fill(0x081a1a);
    g.rect(0, 0, world.w, world.h).fill(0x0f2b2a);
    for (let x = 40; x < world.w; x += 80) for (let y = 40; y < world.h; y += 80) g.circle(x, y, 3).fill({ color: 0x1f4f4b, alpha: 1 });
    // hazard-striped walls
    const stripe = 60;
    for (let i = 0; i < world.w; i += stripe * 2) {
      g.rect(i, -24, stripe, 24).fill(0xffb84f);
      g.rect(i, world.h, stripe, 24).fill(0xffb84f);
    }
    for (let i = 0; i < world.h; i += stripe * 2) {
      g.rect(-24, i, 24, stripe).fill(0xffb84f);
      g.rect(world.w, i, 24, stripe).fill(0xffb84f);
    }
    g.rect(0, 0, world.w, world.h).stroke({ width: 8, color: PALETTE.mint, alpha: 0.9 });
    stage.layerBg.addChild(g);
    this.snakeLayer.sortableChildren = true;
    stage.layerMain.addChild(this.pelletLayer, this.trapLayer, this.shadowLayer, this.snakeLayer);
  }

  focusSize(e: EntitySnap): number {
    return 30 + (e.pts ? e.pts.length : 0) * 0.6;
  }

  onSnapshot(snap: Snapshot): void {
    if (snap.you.entityId !== null) this.youId = snap.you.entityId;
    const S = this.stage;
    for (const ev of snap.events) {
      const near = Math.hypot(ev.x - S.camX, ev.y - S.camY) < 1500;
      if (!near) continue;
      if (ev.t === 'kill') {
        const v = this.snakes.get(ev.victimId);
        S.burst(ev.x, ev.y, v?.color ?? PALETTE.mint, 36, 380, 8);
        S.burst(ev.x, ev.y, 0xffffff, 10, 480, 4);
        if (ev.killerId !== null && ev.killerId === this.youId) {
          S.floatText(ev.x, ev.y - 30, `+${formatCredits(ev.amount)}`, PALETTE.amber);
          S.shake(10);
        } else if (ev.victimId === this.youId) S.shake(22);
        else S.shake(2);
      } else if (ev.t === 'cashout') {
        S.burst(ev.x, ev.y, PALETTE.mint, 30, 300, 7);
        if (ev.id === this.youId) S.floatText(ev.x, ev.y - 30, `+${formatCredits(ev.amount)}`, PALETTE.mint, 42);
      } else if (ev.t === 'fx' && ev.kind === 'golden') {
        S.burst(ev.x, ev.y, PALETTE.amber, 14, 260, 5);
      } else if (ev.t === 'skill') {
        S.burst(ev.x, ev.y, ev.slot === 0 ? PALETTE.sky : PALETTE.violet, 10, 200, 5);
      }
    }
  }

  render(ents: EntitySnap[], _snap: Snapshot, time: number): void {
    const f = ++this.frame;
    const t = time / 1000;
    const T = this.stage.textures;
    for (const e of ents) {
      if (e.k === CoilKind.Pellet) {
        let p = this.pellets.get(e.id);
        if (!p) {
          const golden = e.c === -1;
          const s = new Sprite(T.circle);
          s.anchor.set(0.5);
          s.tint = golden ? PALETTE.amber : PELLET_COLORS[(e.c ?? 0) % PELLET_COLORS.length]!;
          let glow: Sprite | null = null;
          if (golden || e.r > 6) {
            glow = new Sprite(T.soft);
            glow.anchor.set(0.5);
            glow.tint = s.tint;
            glow.alpha = 0.7;
            this.pelletLayer.addChild(glow);
          }
          this.pelletLayer.addChild(s);
          p = { s, glow, seen: f };
          this.pellets.set(e.id, p);
        }
        p.seen = f;
        const k = 1 + 0.2 * Math.sin(t * 5 + e.id);
        p.s.position.set(e.x, e.y);
        p.s.scale.set((e.r / 64) * k);
        if (p.glow) {
          p.glow.position.set(e.x, e.y);
          p.glow.scale.set((e.r * 4 * k) / 64);
        }
      } else if (e.k === CoilKind.Trap) {
        let tr = this.traps.get(e.id);
        if (!tr) {
          const c = new Container();
          const g = new Graphics();
          const pts: number[] = [];
          for (let i = 0; i < 24; i++) {
            const rr = i % 2 ? e.r * 0.75 : e.r * 1.3;
            const a = (i / 24) * Math.PI * 2;
            pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          g.poly(pts).fill(0xff4f7b).stroke({ width: 4, color: 0x8a1d3a });
          g.circle(0, 0, e.r * 0.4).fill(0x8a1d3a);
          const glow = new Sprite(T.soft);
          glow.anchor.set(0.5);
          glow.tint = 0xff4f7b;
          glow.scale.set((e.r * 3) / 64);
          c.addChild(glow, g);
          this.trapLayer.addChild(c);
          tr = { c, seen: f };
          this.traps.set(e.id, tr);
        }
        tr.seen = f;
        tr.c.position.set(e.x, e.y);
        tr.c.rotation = e.a ?? 0;
      } else if (e.k === CoilKind.Snake) {
        let v = this.snakes.get(e.id);
        if (!v) {
          v = this.makeSnake(e);
          this.snakes.set(e.id, v);
        }
        v.seen = f;
        this.drawSnake(v, e, t);
      }
    }
    for (const [id, p] of this.pellets) if (p.seen !== f) { p.s.destroy(); p.glow?.destroy(); this.pellets.delete(id); }
    for (const [id, tr] of this.traps) if (tr.seen !== f) { tr.c.destroy({ children: true }); this.traps.delete(id); }
    for (const [id, v] of this.snakes) {
      if (v.seen === f) continue;
      v.body.destroy();
      v.shadow.destroy();
      v.head.destroy({ children: true });
      this.snakes.delete(id);
    }
  }

  private makeSnake(e: EntitySnap): SnakeView {
    const body = new Graphics();
    const shadow = new Graphics();
    const head = new Container();
    const eyes = new Graphics();
    const ring = new Graphics();
    const style = { fontFamily: 'Nunito, sans-serif', fontWeight: '900' as const, fill: 0xffffff, stroke: { color: 0x081a1a, width: 5 } };
    const name = new Text({ text: e.n ?? '', style: { ...style, fontSize: 22 }, resolution: 2 });
    name.anchor.set(0.5, 1);
    const stake = new Text({ text: '', style: { ...style, fontSize: 18, fill: PALETTE.amber }, resolution: 2 });
    stake.anchor.set(0.5, 1);
    head.addChild(ring, eyes, name, stake);
    this.shadowLayer.addChild(shadow);
    this.snakeLayer.addChild(body, head);
    return { body, shadow, head, eyes, ring, name, stake, lastStake: -1, color: e.c ?? PALETTE.mint, seen: 0 };
  }

  private drawSnake(v: SnakeView, e: EntitySnap, t: number): void {
    const flags = e.f ?? 0;
    const jumping = (flags & EntFlag.Jump) !== 0;
    const pts = e.pts ?? [e.x, e.y];
    // slide the (30 Hz) body to follow the interpolated head
    const ox = e.x - (pts[0] ?? e.x);
    const oy = e.y - (pts[1] ?? e.y);
    const r = e.r;
    const lift = jumping ? 22 : 0;
    const path: number[] = [];
    for (let i = 0; i < pts.length; i += 2) path.push(pts[i]! + ox, pts[i + 1]! + oy - lift);
    const blink = flags & EntFlag.Protected ? 0.5 + 0.35 * Math.sin(t * 14) : 1;

    const sh = v.shadow;
    sh.clear();
    if (jumping) {
      sh.moveTo(path[0]!, path[1]! + lift * 1.6);
      for (let i = 2; i < path.length; i += 2) sh.lineTo(path[i]!, path[i + 1]! + lift * 1.6);
      sh.stroke({ width: r * 2, color: 0x000000, alpha: 0.3, cap: 'round', join: 'round' });
    }
    const g = v.body;
    g.clear();
    g.alpha = blink;
    g.zIndex = jumping ? 2 : 1;
    v.head.zIndex = g.zIndex;
    const line = (w: number, color: number, alpha = 1) => {
      g.moveTo(path[0]!, path[1]!);
      for (let i = 2; i < path.length; i += 2) g.lineTo(path[i]!, path[i + 1]!);
      g.stroke({ width: w, color, alpha, cap: 'round', join: 'round' });
    };
    line(r * 2 + 8, shade(v.color, 0.45));
    line(r * 2, v.color);
    line(r * 0.7, shade(v.color, 1.35), 0.5);
    // glowing scales
    for (let i = 4; i < path.length; i += 6) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 6 - i * 0.3);
      g.circle(path[i]!, path[i + 1]!, r * 0.28).fill({ color: 0xffffff, alpha: 0.18 + pulse * 0.25 });
    }

    const hx = path[0]!;
    const hy = path[1]!;
    const a = e.a ?? 0;
    v.head.position.set(hx, hy);
    v.head.alpha = blink;
    const ey = v.eyes;
    ey.clear();
    ey.circle(0, 0, r * 1.08).fill(v.color).stroke({ width: 4, color: shade(v.color, 0.45) });
    for (const side of [-1, 1]) {
      const ex = Math.cos(a) * r * 0.45 - Math.sin(a) * side * r * 0.45;
      const eyy = Math.sin(a) * r * 0.45 + Math.cos(a) * side * r * 0.45;
      ey.circle(ex, eyy, r * 0.36).fill(0xffffff);
      ey.circle(ex + Math.cos(a) * r * 0.14, eyy + Math.sin(a) * r * 0.14, r * 0.18).fill(0x0b1020);
    }
    const ring = v.ring;
    ring.clear();
    if (flags & EntFlag.Magnet) {
      const rr = 60 + ((t * 160) % 180);
      ring.circle(0, 0, rr).stroke({ width: 4, color: PALETTE.violet, alpha: Math.max(0, 1 - rr / 240) });
      ring.circle(0, 0, 240).stroke({ width: 2, color: PALETTE.violet, alpha: 0.25 });
    }
    if (flags & EntFlag.Cashout) ring.arc(0, 0, r + 18, -Math.PI / 2, -Math.PI / 2 + (e.p ?? 0) * Math.PI * 2).stroke({ width: 7, color: PALETTE.mint, cap: 'round' });
    if (flags & EntFlag.You) ring.circle(0, 0, r + 8).stroke({ width: 3, color: 0xffffff, alpha: 0.5 });
    v.name.y = -r - 18;
    v.stake.y = -r - 40;
    const s = e.s ?? 0;
    if (s !== v.lastStake) {
      v.stake.text = formatCredits(s);
      v.lastStake = s;
    }
  }

  destroy(): void {
    this.snakes.clear();
    this.pellets.clear();
    this.traps.clear();
  }
}

export { COIL_CONFIG };
