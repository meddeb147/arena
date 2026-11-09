import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { BlobKind } from '@arena/engine';
import { EntFlag, formatCredits, type EntitySnap, type Snapshot } from '@arena/shared';
import type { Stage } from '../../render/stage';
import { PALETTE, PELLET_COLORS, shade } from '../../render/color';
import type { GameRenderer } from '../renderer';

interface CellView {
  root: Container;
  glow: Sprite;
  edge: Sprite;
  body: Sprite;
  shine: Sprite;
  shield: Sprite;
  ring: Graphics;
  name: Text;
  stake: Text;
  lastStake: number;
  seen: number;
}

const THEME = { bg: 0x2a1440, grid: 0x3a2160, border: 0xff4f7b };

/** Blob Stake: glossy cells, pulsing pellets, spinning spike traps. */
export class BlobRenderer implements GameRenderer {
  readonly gameId = 'blob' as const;
  private stage!: Stage;
  private cells = new Map<number, CellView>();
  private pellets = new Map<number, { s: Sprite; seen: number }>();
  private traps = new Map<number, { c: Container; seen: number }>();
  private pelletLayer = new Container();
  private trapLayer = new Container();
  private cellLayer = new Container();
  private frame = 0;
  private youId: number | null = null;

  init(stage: Stage, world: { w: number; h: number }): void {
    this.stage = stage;
    const bg = new Graphics();
    bg.rect(-2000, -2000, world.w + 4000, world.h + 4000).fill(0x120d26);
    bg.rect(0, 0, world.w, world.h).fill(THEME.bg);
    const step = 80;
    for (let x = 0; x <= world.w; x += step) bg.moveTo(x, 0).lineTo(x, world.h);
    for (let y = 0; y <= world.h; y += step) bg.moveTo(0, y).lineTo(world.w, y);
    bg.stroke({ width: 2, color: THEME.grid, alpha: 0.7 });
    bg.rect(0, 0, world.w, world.h).stroke({ width: 10, color: THEME.border, alpha: 0.8 });
    stage.layerBg.addChild(bg);
    this.cellLayer.sortableChildren = true; // bigger cells on top via zIndex
    stage.layerMain.addChild(this.pelletLayer, this.trapLayer, this.cellLayer);
  }

  focusSize(e: EntitySnap): number {
    return e.r;
  }

  onSnapshot(snap: Snapshot): void {
    if (snap.you.entityId !== null) this.youId = snap.you.entityId; // keep last id: death/cash-out snapshots no longer carry it
    for (const ev of snap.events) {
      if (ev.t === 'kill') {
        const view = this.cells.get(ev.victimId);
        const color = view ? view.body.tint : PALETTE.pink;
        const size = view ? view.body.scale.x * 64 : 30;
        const near = Math.hypot(ev.x - this.stage.camX, ev.y - this.stage.camY) < 1400;
        if (!near) continue;
        this.stage.burst(ev.x, ev.y, color as number, ev.cause === 'player' ? 18 : 40, 200 + size * 3, Math.max(6, size / 5));
        if (ev.cause !== 'player') this.stage.burst(ev.x, ev.y, 0xffffff, 12, 400, 5);
        if (ev.killerId !== null && ev.killerId === this.youId) {
          this.stage.floatText(ev.x, ev.y - 30, `+${formatCredits(ev.amount)}`, PALETTE.amber);
          this.stage.shake(10);
        } else if (ev.victimId === this.youId) {
          this.stage.shake(22);
        } else this.stage.shake(3);
      } else if (ev.t === 'cashout') {
        this.stage.burst(ev.x, ev.y, PALETTE.mint, 30, 300, 7);
        if (ev.id === this.youId) this.stage.floatText(ev.x, ev.y - 30, `+${formatCredits(ev.amount)}`, PALETTE.mint, 42);
      } else if (ev.t === 'skill') {
        const v = this.cells.get(ev.id);
        if (v && ev.slot === 1) this.stage.burst(ev.x, ev.y, PALETTE.violet, 14, 260, 5);
      }
    }
  }

  render(ents: EntitySnap[], _snap: Snapshot, time: number, dtMs: number): void {
    const f = ++this.frame;
    const T = this.stage.textures;
    const pulse = time / 1000;

    for (const e of ents) {
      if (e.k === BlobKind.Pellet) {
        let p = this.pellets.get(e.id);
        if (!p) {
          const s = new Sprite(T.circle);
          s.anchor.set(0.5);
          s.tint = PELLET_COLORS[(e.c ?? 0) % PELLET_COLORS.length]!;
          this.pelletLayer.addChild(s);
          p = { s, seen: f };
          this.pellets.set(e.id, p);
        }
        p.seen = f;
        p.s.position.set(e.x, e.y);
        p.s.scale.set((e.r / 64) * (1 + 0.18 * Math.sin(pulse * 4 + e.id)));
      } else if (e.k === BlobKind.Trap) {
        let tr = this.traps.get(e.id);
        if (!tr) {
          tr = { c: this.makeTrap(e.r), seen: f };
          this.trapLayer.addChild(tr.c);
          this.traps.set(e.id, tr);
        }
        tr.seen = f;
        tr.c.position.set(e.x, e.y);
        tr.c.rotation = e.a ?? 0;
      } else if (e.k === BlobKind.Cell) {
        let v = this.cells.get(e.id);
        if (!v) {
          v = this.makeCell(e);
          this.cellLayer.addChild(v.root);
          this.cells.set(e.id, v);
        }
        this.updateCell(v, e, pulse, dtMs);
        v.seen = f;
      }
    }

    // remove anything not in this frame
    for (const [id, p] of this.pellets) {
      if (p.seen === f) continue;
      p.s.destroy();
      this.pellets.delete(id);
    }
    for (const [id, tr] of this.traps) {
      if (tr.seen === f) continue;
      tr.c.destroy({ children: true });
      this.traps.delete(id);
    }
    for (const [id, v] of this.cells) if (v.seen !== f) { v.root.destroy({ children: true }); this.cells.delete(id); }
  }

  private makeTrap(r: number): Container {
    const c = new Container();
    const glow = new Sprite(this.stage.textures.soft);
    glow.anchor.set(0.5);
    glow.tint = 0xff3355;
    glow.scale.set((r * 2.2) / 64);
    const g = new Graphics();
    const spikes = 14;
    const pts: number[] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const rr = i % 2 === 0 ? r * 1.25 : r * 0.82;
      const a = (i / (spikes * 2)) * Math.PI * 2;
      pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.poly(pts).fill(0x2fd36b).stroke({ width: 4, color: 0x147a3a });
    g.circle(0, 0, r * 0.55).fill(0x23a957);
    g.circle(0, 0, r * 0.25).fill(0x147a3a);
    c.addChild(glow, g);
    return c;
  }

  private makeCell(e: EntitySnap): CellView {
    const T = this.stage.textures;
    const color = e.c ?? PALETTE.pink;
    const mk = (tex = T.circle) => {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      return s;
    };
    const glow = mk(T.soft);
    glow.tint = color;
    glow.alpha = 0.5;
    const edge = mk();
    edge.tint = shade(color, 0.62);
    const body = mk();
    body.tint = color;
    const shine = mk();
    shine.tint = 0xffffff;
    shine.alpha = 0.22;
    const shield = mk(T.ring);
    shield.tint = PALETTE.violet;
    shield.visible = false;
    const ring = new Graphics();
    const style = { fontFamily: 'Nunito, sans-serif', fontWeight: '900' as const, fill: 0xffffff, stroke: { color: 0x171433, width: 5 } };
    const name = new Text({ text: e.n ?? '', style: { ...style, fontSize: 28 }, resolution: 2 });
    name.anchor.set(0.5, 0.7);
    const stake = new Text({ text: '', style: { ...style, fontSize: 22, fill: PALETTE.amber }, resolution: 2 });
    stake.anchor.set(0.5, -0.2);
    const root = new Container();
    root.addChild(glow, edge, body, shine, ring, shield, name, stake);
    return { root, glow, edge, body, shine, shield, ring, name, stake, lastStake: -1, seen: 0 };
  }

  private updateCell(v: CellView, e: EntitySnap, t: number, dtMs: number): void {
    const flags = e.f ?? 0;
    const r = e.r;
    // spawn protection: gentle blink
    v.root.alpha = flags & EntFlag.Protected ? 0.55 + 0.35 * Math.sin(t * 14) : 1;
    // wobble: a slightly squashed, breathing blob
    const wob = 1 + 0.025 * Math.sin(t * 5 + e.id);
    v.root.position.set(e.x, e.y);
    v.root.scale.set(1); // children are sized directly in world units
    v.edge.scale.set((r / 64) * wob);
    v.body.scale.set(((r - Math.max(3, r * 0.07)) / 64) * wob);
    v.glow.scale.set((r * 1.6) / 64);
    v.glow.visible = (flags & EntFlag.You) !== 0 || (flags & EntFlag.Dash) !== 0;
    v.shine.scale.set((r * 0.35) / 64);
    v.shine.position.set(-r * 0.35, -r * 0.4);
    v.root.zIndex = r;

    const nameSize = Math.max(0.55, Math.min(2.4, r / 34));
    v.name.scale.set(nameSize);
    v.stake.scale.set(nameSize);
    const s = e.s ?? 0;
    if (s !== v.lastStake) {
      v.stake.text = formatCredits(s);
      v.lastStake = s;
    }

    if (flags & EntFlag.Shield) {
      v.shield.visible = true;
      v.shield.scale.set(((r + 10) / 64) * (1 + 0.05 * Math.sin(t * 12)));
      v.shield.alpha = 0.7 + 0.3 * Math.sin(t * 8);
    } else v.shield.visible = false;

    v.ring.clear();
    if (flags & EntFlag.Cashout) {
      const p = e.p ?? 0;
      v.ring.arc(0, 0, r + 14, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2).stroke({ width: 8, color: PALETTE.mint, cap: 'round' });
    }

    if (flags & EntFlag.Dash && Math.random() < dtMs / 12) {
      const a = (e.a ?? 0) + Math.PI + (Math.random() - 0.5) * 0.8;
      this.stage.spawnParticle(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, Math.cos(a) * 80, Math.sin(a) * 80, e.c ?? PALETTE.pink, r * 0.35, 0.35, -1.5);
    }
  }

  destroy(): void {
    this.cells.clear();
    this.pellets.clear();
    this.traps.clear();
  }
}
