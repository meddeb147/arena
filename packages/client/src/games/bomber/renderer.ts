import { Container, Graphics } from 'pixi.js';
import type { Text } from 'pixi.js';
import { BOMBER, BomberKind } from '@arena/engine';
import { EntFlag, type EntitySnap, type Snapshot } from '@arena/shared';
import type { Stage } from '../../render/stage';
import { PALETTE, shade } from '../../render/color';
import type { GameRenderer } from '../renderer';
import { commonEvents, destroyAll, makeLabels, setStake } from '../common';

type V = { root: Container; g: Graphics; name: Text; stake: Text; cache: { last: number }; color: number; seen: number };

/** Bomber Blast: checkered floor, stone pillars, fizzing bombs, big blasts. */
export class BomberRenderer implements GameRenderer {
  readonly gameId = 'bomber' as const;
  private stage!: Stage;
  private players = new Map<number, V>();
  private world = new Graphics();
  private playerLayer = new Container();
  private frame = 0;
  private youId: number | null = null;
  private flashes: { x: number; y: number; life: number }[] = [];

  init(stage: Stage, world: { w: number; h: number }): void {
    this.stage = stage;
    const g = new Graphics();
    g.rect(-2000, -2000, world.w + 4000, world.h + 4000).fill(0x170c0c);
    const T = 105;
    for (let y = 0; y < world.h; y += T) for (let x = 0; x < world.w; x += T) g.rect(x, y, T, T).fill((x + y) / T % 2 ? 0x2e1a1a : 0x341e1d);
    g.rect(0, 0, world.w, world.h).stroke({ width: 12, color: 0xff8a4f });
    stage.layerBg.addChild(g);
    this.playerLayer.sortableChildren = true;
    stage.layerMain.addChild(this.world, this.playerLayer);
  }

  focusSize(): number {
    return 70;
  }

  onSnapshot(snap: Snapshot): void {
    if (snap.you.entityId !== null) this.youId = snap.you.entityId;
    const S = this.stage;
    commonEvents(S, snap, this.youId, (id) => this.players.get(id)?.color);
    for (const ev of snap.events) {
      if (ev.t !== 'fx' || Math.hypot(ev.x - S.camX, ev.y - S.camY) > 1500) continue;
      if (ev.kind === 'blast') {
        this.flashes.push({ x: ev.x, y: ev.y, life: 1 });
        S.burst(ev.x, ev.y, 0xff8a4f, 36, 520, 10);
        S.burst(ev.x, ev.y, 0xffd84f, 20, 360, 8);
        S.burst(ev.x, ev.y, 0x555555, 14, 200, 14);
        S.shake(Math.max(3, 16 - Math.hypot(ev.x - S.camX, ev.y - S.camY) / 70));
      } else if (ev.kind === 'kick') S.burst(ev.x, ev.y, 0xffffff, 6, 200, 4);
      else if (ev.kind === 'land') S.burst(ev.x, ev.y, 0xaaaaaa, 12, 200, 6);
    }
  }

  render(ents: EntitySnap[], _snap: Snapshot, time: number, dtMs: number): void {
    const f = ++this.frame;
    const t = time / 1000;
    const g = this.world;
    g.clear();
    for (const e of ents) {
      if (e.k === BomberKind.Pillar) {
        g.circle(e.x + 6, e.y + 10, e.r).fill({ color: 0x000000, alpha: 0.35 });
        g.circle(e.x, e.y, e.r).fill(0x5b4a4a).stroke({ width: 6, color: 0x3a2c2c });
        g.circle(e.x - e.r * 0.25, e.y - e.r * 0.25, e.r * 0.45).fill({ color: 0xffffff, alpha: 0.08 });
      } else if (e.k === BomberKind.SkyMark) {
        const k = e.h ?? 0;
        const blink = k > 0.7 ? 0.5 + 0.5 * Math.sin(t * 30) : 1;
        g.circle(e.x, e.y, e.r).fill({ color: 0xff3d3d, alpha: 0.08 + k * 0.14 }).stroke({ width: 5, color: 0xff3d3d, alpha: 0.8 * blink });
        g.circle(e.x, e.y, e.r * (1 - k)).stroke({ width: 3, color: 0xffd84f, alpha: 0.8 });
        g.moveTo(e.x - 18, e.y).lineTo(e.x + 18, e.y).moveTo(e.x, e.y - 18).lineTo(e.x, e.y + 18).stroke({ width: 4, color: 0xffffff, alpha: 0.8 });
      } else if (e.k === BomberKind.Bomb) {
        const left = e.h ?? 1;
        const rate = 4 + (1 - left) * 26;
        const pulse = 1 + 0.12 * Math.sin(t * rate);
        const r = e.r * pulse;
        // danger zone, stronger near the end
        g.circle(e.x, e.y, BOMBER.blast).fill({ color: 0xff3d3d, alpha: 0.04 + (1 - left) * 0.12 });
        g.circle(e.x + 4, e.y + 7, r).fill({ color: 0x000000, alpha: 0.35 });
        g.circle(e.x, e.y, r).fill(Math.sin(t * rate) > 0.6 && left < 0.4 ? 0xff5050 : 0x1b1430).stroke({ width: 4, color: e.c !== undefined && e.c >= 0 ? e.c : 0xff8a4f });
        g.circle(e.x - r * 0.35, e.y - r * 0.35, r * 0.25).fill({ color: 0xffffff, alpha: 0.35 });
        g.moveTo(e.x + r * 0.5, e.y - r * 0.7).lineTo(e.x + r * 0.9, e.y - r * 1.2).stroke({ width: 4, color: 0xd9b48a });
        g.circle(e.x + r * 0.9, e.y - r * 1.25, 4 + Math.random() * 3).fill(0xffd84f);
      } else if (e.k === BomberKind.Player) {
        let v = this.players.get(e.id);
        if (!v) {
          const root = new Container();
          const pg = new Graphics();
          const { name, stake } = makeLabels(e.n ?? '', 0x170c0c);
          root.addChild(pg, name, stake);
          this.playerLayer.addChild(root);
          v = { root, g: pg, name, stake, cache: { last: -1 }, color: e.c ?? 0xff8a4f, seen: f };
          this.players.set(e.id, v);
        }
        v.seen = f;
        this.drawPlayer(v, e, t);
      }
    }
    // blast flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const fl = this.flashes[i]!;
      fl.life -= dtMs / 350;
      if (fl.life <= 0) {
        this.flashes.splice(i, 1);
        continue;
      }
      g.circle(fl.x, fl.y, BOMBER.blast * (1.15 - fl.life * 0.15)).fill({ color: 0xffd84f, alpha: 0.55 * fl.life });
      g.circle(fl.x, fl.y, BOMBER.blast * 0.6).fill({ color: 0xffffff, alpha: 0.5 * fl.life });
    }
    destroyAll(this.players, f, (v) => v.root.destroy({ children: true }));
  }

  private drawPlayer(v: V, e: EntitySnap, t: number): void {
    const flags = e.f ?? 0;
    const r = e.r;
    v.root.position.set(e.x, e.y);
    v.root.zIndex = e.y;
    v.root.alpha = flags & EntFlag.Protected ? 0.55 + 0.35 * Math.sin(t * 14) : 1;
    const g = v.g;
    g.clear();
    const a = e.a ?? 0;
    const bob = Math.sin(t * 10 + e.id) * 2;
    g.circle(4, 9, r).fill({ color: 0x000000, alpha: 0.3 });
    g.circle(0, bob, r).fill(v.color).stroke({ width: 4, color: shade(v.color, 0.5) });
    // helmet visor
    g.arc(Math.cos(a) * 3, bob + Math.sin(a) * 3, r * 0.7, a - 0.9, a + 0.9).stroke({ width: 8, color: 0x1b1430, cap: 'round' });
    g.circle(Math.cos(a) * r * 0.55, bob + Math.sin(a) * r * 0.55, 4).fill(0xffffff);
    if (flags & EntFlag.Shield) g.circle(0, bob, r + 12).stroke({ width: 6, color: PALETTE.sky, alpha: 0.7 + 0.3 * Math.sin(t * 9) });
    if (flags & EntFlag.Cashout) g.arc(0, 0, r + 18, -Math.PI / 2, -Math.PI / 2 + (e.p ?? 0) * Math.PI * 2).stroke({ width: 7, color: PALETTE.mint, cap: 'round' });
    if (flags & EntFlag.You) g.circle(0, 0, r + 7).stroke({ width: 3, color: 0xffffff, alpha: 0.5 });
    v.name.y = -r - 14;
    v.stake.y = -r - 36;
    setStake(v.stake, e.s ?? 0, v.cache);
  }

  destroy(): void {
    this.players.clear();
  }
}
