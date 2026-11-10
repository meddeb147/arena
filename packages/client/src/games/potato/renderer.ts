import { Container, Graphics, Sprite } from 'pixi.js';
import type { Text } from 'pixi.js';
import { PotatoKind } from '@arena/engine';
import { EntFlag, type EntitySnap, type Snapshot } from '@arena/shared';
import { play } from '../../audio/sfx';
import type { Stage } from '../../render/stage';
import { PALETTE, shade } from '../../render/color';
import type { GameRenderer } from '../renderer';
import { commonEvents, destroyAll, makeLabels, setStake } from '../common';

type V = { root: Container; g: Graphics; name: Text; stake: Text; cache: { last: number }; color: number; seen: number };

/** Hot Potato: a picnic field, runners, and sizzling potatoes that tick down. */
export class PotatoRenderer implements GameRenderer {
  readonly gameId = 'potato' as const;
  private stage!: Stage;
  private runners = new Map<number, V>();
  private props = new Graphics();
  private glow!: Sprite;
  private runnerLayer = new Container();
  private potatoLayer = new Graphics();
  private frame = 0;
  private youId: number | null = null;
  private lastBeep = 0;

  init(stage: Stage, world: { w: number; h: number }): void {
    this.stage = stage;
    const g = new Graphics();
    g.rect(-2000, -2000, world.w + 4000, world.h + 4000).fill(0x14120a);
    g.rect(0, 0, world.w, world.h).fill(0x2d2614);
    const T = 120;
    for (let y = 0; y < world.h; y += T) for (let x = 0; x < world.w; x += T) if (((x + y) / T) % 2) g.rect(x, y, T, T).fill({ color: 0x3a3119, alpha: 1 });
    g.rect(0, 0, world.w, world.h).stroke({ width: 12, color: 0xffd84f });
    stage.layerBg.addChild(g);
    this.glow = new Sprite(stage.textures.soft);
    this.glow.anchor.set(0.5);
    this.glow.visible = false;
    this.runnerLayer.sortableChildren = true;
    stage.layerMain.addChild(this.props, this.glow, this.runnerLayer, this.potatoLayer);
  }

  focusSize(): number {
    return 80;
  }

  onSnapshot(snap: Snapshot): void {
    if (snap.you.entityId !== null) this.youId = snap.you.entityId;
    const S = this.stage;
    commonEvents(S, snap, this.youId, (id) => this.runners.get(id)?.color);
    for (const ev of snap.events) {
      if (ev.t !== 'fx' || Math.hypot(ev.x - S.camX, ev.y - S.camY) > 1500) continue;
      if (ev.kind === 'potato') {
        S.burst(ev.x, ev.y, 0xb5833f, 30, 460, 10);
        S.burst(ev.x, ev.y, 0xffd84f, 26, 380, 8);
        S.shake(12);
      } else if (ev.kind === 'pass') S.burst(ev.x, ev.y, 0xffd84f, 12, 260, 5);
      else if (ev.kind === 'assign') {
        S.burst(ev.x, ev.y, 0xffd84f, 18, 300, 6);
        if (ev.id === this.youId) S.floatText(ev.x, ev.y - 60, 'HOT!', 0xff6a3d, 40);
      }
    }
  }

  render(ents: EntitySnap[], _snap: Snapshot, time: number): void {
    const f = ++this.frame;
    const t = time / 1000;
    const pg = this.props;
    pg.clear();
    const pt = this.potatoLayer;
    pt.clear();
    this.glow.visible = false;
    for (const e of ents) {
      if (e.k === PotatoKind.Pillar) {
        pg.circle(e.x + 6, e.y + 10, e.r).fill({ color: 0x000000, alpha: 0.35 });
        pg.circle(e.x, e.y, e.r).fill(0x6b5a2e).stroke({ width: 6, color: 0x4a3d1c });
        pg.circle(e.x, e.y, e.r * 0.6).stroke({ width: 4, color: 0x8a7640 });
      } else if (e.k === PotatoKind.Player) {
        let v = this.runners.get(e.id);
        if (!v) {
          const root = new Container();
          const g = new Graphics();
          const { name, stake } = makeLabels(e.n ?? '', 0x14120a);
          root.addChild(g, name, stake);
          this.runnerLayer.addChild(root);
          v = { root, g, name, stake, cache: { last: -1 }, color: e.c ?? 0xffd84f, seen: f };
          this.runners.set(e.id, v);
        }
        v.seen = f;
        this.drawRunner(v, e, t);
      } else if (e.k === PotatoKind.Potato) {
        const left = e.h ?? 1;
        const heat = 1 - left;
        const shakeAmt = heat * 5;
        const x = e.x + (Math.random() - 0.5) * shakeAmt;
        const y = e.y - 50 + (Math.random() - 0.5) * shakeAmt;
        const color = heat > 0.66 ? 0xff5030 : heat > 0.33 ? 0xd98a3a : 0xb5833f;
        pt.ellipse(x, y, 24, 17).fill(color).stroke({ width: 3, color: 0x6b4518 });
        pt.circle(x - 8, y - 4, 2.5).fill(0x6b4518);
        pt.circle(x + 6, y + 5, 2.5).fill(0x6b4518);
        pt.circle(x + 9, y - 6, 2).fill(0x6b4518);
        // fuse ring
        pt.arc(x, y, 32, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2).stroke({ width: 5, color: heat > 0.66 ? 0xff3d3d : 0xffd84f, cap: 'round' });
        // steam
        if (Math.random() < 0.3 + heat * 0.5) this.stage.spawnParticle(x + (Math.random() - 0.5) * 20, y - 16, (Math.random() - 0.5) * 30, -60 - heat * 60, 0xffffff, 6, 0.6, 1.2);
        this.glow.visible = true;
        this.glow.position.set(x, y);
        this.glow.tint = color;
        this.glow.scale.set((60 + heat * 50) / 64);
        // my potato: beep faster as it runs out
        const holder = ents.find((o) => o.k === PotatoKind.Player && Math.hypot(o.x - e.x, o.y - e.y) < 2);
        if (holder && (holder.f ?? 0) & EntFlag.You) {
          const gap = 120 + left * 700;
          if (time - this.lastBeep > gap) {
            this.lastBeep = time;
            play('tick', 0.7 + heat * 0.3);
          }
        }
      }
    }
    destroyAll(this.runners, f, (v) => v.root.destroy({ children: true }));
  }

  private drawRunner(v: V, e: EntitySnap, t: number): void {
    const flags = e.f ?? 0;
    const r = e.r;
    v.root.position.set(e.x, e.y);
    v.root.zIndex = e.y;
    v.root.alpha = flags & EntFlag.Protected ? 0.55 + 0.35 * Math.sin(t * 14) : 1;
    const g = v.g;
    g.clear();
    const a = e.a ?? 0;
    const hot = (flags & EntFlag.Attack) !== 0;
    g.circle(4, 9, r).fill({ color: 0x000000, alpha: 0.3 });
    g.circle(0, 0, r).fill(v.color).stroke({ width: 4, color: hot ? 0xff3d3d : shade(v.color, 0.5) });
    // eyes: worried when someone hot is around is too much logic; just look ahead
    for (const side of [-1, 1]) {
      const ex = Math.cos(a) * r * 0.42 - Math.sin(a) * side * r * 0.36;
      const ey = Math.sin(a) * r * 0.42 + Math.cos(a) * side * r * 0.36;
      g.circle(ex, ey, r * 0.2).fill(0xffffff);
      g.circle(ex + Math.cos(a) * 3, ey + Math.sin(a) * 3, r * 0.1).fill(0x14120a);
    }
    if (hot) g.circle(0, 0, r + 8 + Math.sin(t * 18) * 3).stroke({ width: 4, color: 0xff6a3d, alpha: 0.8 });
    if (flags & EntFlag.Shield) g.circle(0, 0, r + 12).stroke({ width: 6, color: PALETTE.sky, alpha: 0.7 + 0.3 * Math.sin(t * 9) });
    if (flags & EntFlag.Cashout) g.arc(0, 0, r + 18, -Math.PI / 2, -Math.PI / 2 + (e.p ?? 0) * Math.PI * 2).stroke({ width: 7, color: PALETTE.mint, cap: 'round' });
    if (flags & EntFlag.You) g.circle(0, 0, r + 6).stroke({ width: 3, color: 0xffffff, alpha: 0.5 });
    if (flags & EntFlag.Dash && Math.random() < 0.5) {
      const back = a + Math.PI;
      this.stage.spawnParticle(e.x + Math.cos(back) * r, e.y + Math.sin(back) * r, Math.cos(back) * 80, Math.sin(back) * 80, v.color, r * 0.4, 0.3, -1.5);
    }
    v.name.y = -r - (hot ? 80 : 14);
    v.stake.y = -r - (hot ? 102 : 36);
    setStake(v.stake, e.s ?? 0, v.cache);
  }

  destroy(): void {
    this.runners.clear();
  }
}
