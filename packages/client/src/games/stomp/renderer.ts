import { Container, Graphics } from 'pixi.js';
import type { Text } from 'pixi.js';
import { STOMP, STOMP_CONFIG, StompKind } from '@arena/engine';
import { EntFlag, type EntitySnap, type Snapshot } from '@arena/shared';
import type { Stage } from '../../render/stage';
import { PALETTE, shade } from '../../render/color';
import type { GameRenderer } from '../renderer';
import { commonEvents, destroyAll, makeLabels, setStake } from '../common';

type V = { root: Container; g: Graphics; name: Text; stake: Text; cache: { last: number }; color: number; lastX: number; step: number; seen: number };

const LAVA = STOMP.lavaY;

/** Stomp Stake: side-view neon platforms over a lava sea. */
export class StompRenderer implements GameRenderer {
  readonly gameId = 'stomp' as const;
  private stage!: Stage;
  private players = new Map<number, V>();
  private level = new Graphics();
  private lava = new Graphics();
  private playerLayer = new Container();
  private springPress = new Map<string, number>();
  private frame = 0;
  private youId: number | null = null;

  init(stage: Stage, world: { w: number; h: number }): void {
    this.stage = stage;
    const g = new Graphics();
    // night sky in bands
    const bands = [0x0c1a14, 0x0f2119, 0x12291e, 0x153124];
    bands.forEach((c, i) => g.rect(-2000, -2000 + i * ((world.h + 2000) / bands.length), world.w + 4000, (world.h + 2000) / bands.length + 2).fill(c));
    // stars and a big moon
    for (let i = 0; i < 160; i++) g.circle((i * 977) % (world.w + 2000) - 1000, ((i * 613) % 1400) - 300, (i % 3) + 1).fill({ color: 0xffffff, alpha: 0.3 + (i % 5) * 0.1 });
    g.circle(world.w * 0.78, 260, 150).fill({ color: 0xd9ffe0, alpha: 0.12 });
    g.circle(world.w * 0.78, 260, 110).fill(0xd9ffe0);
    g.circle(world.w * 0.78 - 30, 240, 22).fill({ color: 0xa8d8b0, alpha: 0.6 });
    // distant neon city
    for (let i = 0; i < 46; i++) {
      const w = 60 + ((i * 37) % 90);
      const h = 220 + ((i * 131) % 520);
      const x = i * 82 - 200;
      g.rect(x, LAVA - h, w, h).fill(0x0a1712);
      for (let wy = LAVA - h + 20; wy < LAVA - 40; wy += 46) for (let wx = x + 12; wx < x + w - 12; wx += 26) if ((wx * 7 + wy * 3) % 5 < 2) g.rect(wx, wy, 10, 14).fill({ color: [PALETTE.mint, PALETTE.pink, PALETTE.amber][(wx + wy) % 3]!, alpha: 0.35 });
    }
    stage.layerBg.addChild(g);
    this.playerLayer.sortableChildren = true;
    stage.layerMain.addChild(this.level, this.playerLayer, this.lava);
  }

  focusSize(): number {
    return 120;
  }

  onSnapshot(snap: Snapshot): void {
    if (snap.you.entityId !== null) this.youId = snap.you.entityId;
    const S = this.stage;
    commonEvents(S, snap, this.youId, (id) => this.players.get(id)?.color);
    for (const ev of snap.events) {
      if (ev.t !== 'fx' || Math.hypot(ev.x - S.camX, ev.y - S.camY) > 1600) continue;
      const mine = ev.id === this.youId;
      switch (ev.kind) {
        case 'stomp':
          S.burst(ev.x, ev.y, 0xffffff, 14, 360, 5);
          S.burst(ev.x, ev.y, PALETTE.amber, 12, 280, 7);
          S.floatText(ev.x, ev.y - 50, 'STOMP!', mine ? PALETTE.amber : 0xffffff, mine ? 46 : 30);
          S.shake(mine ? 12 : 4);
          break;
        case 'pound':
          S.burst(ev.x, ev.y, 0xd9ffe0, 22, 420, 6);
          S.shake(mine ? 10 : 4);
          break;
        case 'bonk':
          S.burst(ev.x, ev.y, PALETTE.sky, 8, 220, 5);
          break;
        case 'spring':
          this.springPress.set(`${ev.x}:${ev.y}`, 1);
          S.burst(ev.x, ev.y, PALETTE.pink, 8, 260, 5);
          break;
        case 'double':
          S.burst(ev.x, ev.y, 0xffffff, 8, 180, 5);
          break;
        case 'land':
          S.burst(ev.x, ev.y, 0x7a9a80, 6, 160, 6);
          break;
        case 'lava':
          S.burst(ev.x, ev.y, 0xff6a3d, 30, 420, 9);
          S.burst(ev.x, ev.y, 0xffd84f, 14, 300, 6);
          break;
        case 'spiked':
          S.burst(ev.x, ev.y, 0xff4f7b, 20, 320, 6);
          break;
      }
    }
  }

  render(ents: EntitySnap[], _snap: Snapshot, time: number, dtMs: number): void {
    const f = ++this.frame;
    const t = time / 1000;
    const g = this.level;
    g.clear();
    for (const e of ents) {
      if (e.k === StompKind.Platform || e.k === StompKind.Mover) {
        const w = e.pts?.[0] ?? e.r * 2;
        const h = e.pts?.[1] ?? 28;
        const mover = e.k === StompKind.Mover;
        const edge = mover ? PALETTE.amber : PALETTE.mint;
        g.roundRect(e.x + 6, e.y + 10, w, h, 8).fill({ color: 0x000000, alpha: 0.35 });
        g.roundRect(e.x, e.y, w, h, 8).fill(h > 40 ? 0x1c3a28 : 0x234a33);
        // bricks
        for (let bx = e.x + 30; bx < e.x + w - 10; bx += 46) g.rect(bx, e.y + 8, 3, h - 12).fill({ color: 0x000000, alpha: 0.18 });
        if (h > 40) for (let by = e.y + 22; by < e.y + h - 6; by += 16) g.rect(e.x + 6, by, w - 12, 2).fill({ color: 0x000000, alpha: 0.15 });
        g.roundRect(e.x, e.y - 3, w, 8, 4).fill(edge);
        g.roundRect(e.x - 4, e.y - 9, w + 8, 18, 9).fill({ color: edge, alpha: 0.15 + 0.08 * Math.sin(t * 3 + e.id) });
        if (mover) {
          const ax = e.x + w / 2;
          g.poly([ax - 30, e.y + 13, ax - 18, e.y + 7, ax - 18, e.y + 19]).fill(0x2a1f10);
          g.poly([ax + 30, e.y + 13, ax + 18, e.y + 7, ax + 18, e.y + 19]).fill(0x2a1f10);
        }
      } else if (e.k === StompKind.Spring) {
        const key = `${e.x}:${e.y}`;
        const press = this.springPress.get(key) ?? 0;
        if (press > 0) this.springPress.set(key, Math.max(0, press - dtMs / 250));
        const hgt = 30 - 18 * press;
        const top = e.y - hgt;
        g.rect(e.x - 22, e.y - 6, 44, 6).fill(0x555566);
        for (let i = 0; i < 4; i++) {
          const y0 = e.y - 6 - (i * (hgt - 10)) / 4;
          const y1 = e.y - 6 - ((i + 1) * (hgt - 10)) / 4;
          g.moveTo(e.x - 16, y0).lineTo(e.x + 16, (y0 + y1) / 2).lineTo(e.x - 16, y1);
        }
        g.stroke({ width: 4, color: 0xc8d0e0 });
        g.roundRect(e.x - 28, top - 8, 56, 12, 6).fill(PALETTE.pink).stroke({ width: 3, color: shade(PALETTE.pink, 0.6) });
      } else if (e.k === StompKind.Spikes) {
        const w = e.pts?.[0] ?? e.r * 2;
        const n = Math.max(3, Math.round(w / 18));
        for (let i = 0; i < n; i++) {
          const x0 = e.x + (i * w) / n;
          g.poly([x0, e.y, x0 + w / n / 2, e.y - 24, x0 + w / n, e.y]).fill(0xd0d6e8).stroke({ width: 2, color: 0x7a8296 });
        }
        g.rect(e.x - 2, e.y - 26, w + 4, 28).fill({ color: PALETTE.pink, alpha: 0.08 + 0.06 * Math.sin(t * 6) });
      } else if (e.k === StompKind.Player) {
        let v = this.players.get(e.id);
        if (!v) {
          const root = new Container();
          const pg = new Graphics();
          const { name, stake } = makeLabels(e.n ?? '', 0x0c1a14);
          root.addChild(pg, name, stake);
          this.playerLayer.addChild(root);
          v = { root, g: pg, name, stake, cache: { last: -1 }, color: e.c ?? PALETTE.mint, lastX: e.x, step: 0, seen: f };
          this.players.set(e.id, v);
        }
        v.seen = f;
        this.drawPlayer(v, e, t);
      }
    }
    destroyAll(this.players, f, (v) => v.root.destroy({ children: true }));

    // the lava sea with rolling waves and bubbles
    const lv = this.lava;
    lv.clear();
    const x0 = this.stage.camX - 2200;
    const x1 = this.stage.camX + 2200;
    const pts: number[] = [];
    for (let x = Math.floor(x0 / 40) * 40; x <= x1; x += 40) pts.push(x, LAVA + Math.sin(x / 90 + t * 2.2) * 8 + Math.sin(x / 37 - t * 3.1) * 4);
    lv.poly([...pts, x1, LAVA + 3000, x0, LAVA + 3000]).fill(0xc2341a);
    lv.poly([...pts.map((v, i) => (i % 2 ? v + 22 : v)), x1, LAVA + 3000, x0, LAVA + 3000]).fill(0xff5a2a);
    lv.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) lv.lineTo(pts[i]!, pts[i + 1]!);
    lv.stroke({ width: 6, color: 0xffd84f, alpha: 0.9 });
    for (let i = 0; i < 14; i++) {
      const bx = Math.floor(x0 / 300) * 300 + i * 320 + ((t * 40 + i * 50) % 120);
      const k = (t * 0.8 + i * 0.37) % 1;
      lv.circle(bx, LAVA + 60 - k * 70, 6 + 8 * k).fill({ color: 0xffd84f, alpha: 0.8 * (1 - k) });
    }
    lv.rect(x0, LAVA - 60, x1 - x0, 60).fill({ color: 0xff6a3d, alpha: 0.06 });
  }

  private drawPlayer(v: V, e: EntitySnap, t: number): void {
    const flags = e.f ?? 0;
    const air = (flags & EntFlag.Jump) !== 0;
    const pound = (flags & EntFlag.Attack) !== 0;
    const vy = e.h ?? 0;
    const facing = Math.cos(e.a ?? 0) >= 0 ? 1 : -1;
    const hw = STOMP.hw;
    const hh = STOMP.hh;
    v.root.position.set(e.x, e.y);
    v.root.zIndex = e.y;
    v.root.alpha = flags & EntFlag.Protected ? 0.55 + 0.35 * Math.sin(t * 14) : 1;
    // squash and stretch from vertical speed
    const sy = air ? 1 + Math.min(0.3, Math.abs(vy) * 0.35) : 1;
    const sx = air ? 1 - Math.min(0.2, Math.abs(vy) * 0.22) : 1;
    const moved = e.x - v.lastX;
    v.lastX = e.x;
    if (!air && Math.abs(moved) > 0.5) v.step += Math.abs(moved) * 0.06;
    const g = v.g;
    g.clear();
    g.scale.set(sx * facing, sy);
    if (!air) g.ellipse(0, hh + 2, hw * 1.1, 6).fill({ color: 0x000000, alpha: 0.35 });
    // feet patter while running, tuck in the air
    const fy = air ? hh * 0.55 : hh - 6;
    const swing = air ? 0 : Math.sin(v.step) * 6;
    g.ellipse(-hw * 0.45 + swing, fy, 10, 7).fill(shade(v.color, 0.55));
    g.ellipse(hw * 0.45 - swing, fy, 10, 7).fill(shade(v.color, 0.55));
    // body
    g.roundRect(-hw, -hh, hw * 2, hh * 1.9, hw * 0.95).fill(v.color).stroke({ width: 4, color: shade(v.color, 0.5) });
    g.roundRect(-hw * 0.55, -hh * 0.1, hw * 1.1, hh * 0.9, hw * 0.5).fill({ color: 0xffffff, alpha: 0.18 });
    // big eyes looking where we run
    for (const ex of [hw * 0.15, hw * 0.62]) {
      g.ellipse(ex, -hh * 0.42, 7.5, 9.5).fill(0xffffff);
      g.circle(ex + 2.5, -hh * 0.42 + (air ? (vy > 0 ? 3 : -3) : 0), 3.8).fill(0x0c1a14);
    }
    if (pound) {
      g.rect(-hw * 0.7, -hh - 60, 6, 46).fill({ color: 0xffffff, alpha: 0.5 });
      g.rect(hw * 0.5, -hh - 70, 6, 56).fill({ color: 0xffffff, alpha: 0.5 });
    }
    if (flags & EntFlag.Cashout) {
      g.scale.set(1, 1);
      g.arc(0, 0, hh + 16, -Math.PI / 2, -Math.PI / 2 + (e.p ?? 0) * Math.PI * 2).stroke({ width: 7, color: PALETTE.mint, cap: 'round' });
    }
    if (flags & EntFlag.You) {
      g.poly([-8 * facing, -hh - 14, 8 * facing, -hh - 14, 0, -hh - 4]).fill(0xffffff);
    }
    v.name.y = -hh - 18;
    v.stake.y = -hh - 40;
    setStake(v.stake, e.s ?? 0, v.cache);
  }

  destroy(): void {
    this.players.clear();
  }
}

export { STOMP_CONFIG };
