import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { APOTHEM, ARENA_CX, ARENA_CY, VOLT, VoltKind } from '@arena/engine';
import { EntFlag, formatCredits, type EntitySnap, type Snapshot } from '@arena/shared';
import type { Stage } from '../../render/stage';
import { PALETTE, shade } from '../../render/color';
import type { GameRenderer } from '../renderer';

const NEON_PINK = 0xff3d8b;
const NEON_CYAN = 0x3de8ff;
const BOLT = 0xe9d4ff;

interface FighterView {
  root: Container;
  body: Container;
  shadow: Sprite;
  torso: Sprite;
  rim: Sprite;
  visor: Graphics;
  fistL: Sprite;
  fistR: Sprite;
  shield: Sprite;
  hp: Graphics;
  ring: Graphics;
  name: Text;
  stake: Text;
  lastHp: number;
  lastStake: number;
  punchSide: number;
  wasAttacking: boolean;
  seen: number;
}

/** Octagon vertex list (flat walls facing the axes). */
function octagon(radius: number): number[] {
  const pts: number[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    pts.push(ARENA_CX + Math.cos(a) * radius, ARENA_CY + Math.sin(a) * radius);
  }
  return pts;
}

/** A jagged lightning path from (x0,y0) to (x1,y1). */
function jagged(g: Graphics, x0: number, y0: number, x1: number, y1: number, segs: number, spread: number): void {
  g.moveTo(x0, y0);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    g.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * spread, y0 + (y1 - y0) * t + (Math.random() - 0.5) * spread * 0.4);
  }
  g.lineTo(x1, y1);
}

/** Volt Brawl: neon octagon cage, punchy fighters, lightning. */
export class VoltRenderer implements GameRenderer {
  readonly gameId = 'volt' as const;
  private stage!: Stage;
  private fighters = new Map<number, FighterView>();
  private statics = new Map<number, { c: Container; seen: number; k: number }>();
  private floorLayer = new Container();
  private hazardLayer = new Container();
  private fighterLayer = new Container();
  private boltLayer = new Graphics();
  private bolts: { x: number; y: number; life: number }[] = [];
  private arcs = new Graphics();
  private cage = new Graphics();
  private frame = 0;
  private youId: number | null = null;

  init(stage: Stage, world: { w: number; h: number }): void {
    this.stage = stage;
    const g = new Graphics();
    // the street outside the cage
    g.rect(-2000, -2000, world.w + 4000, world.h + 4000).fill(0x0f0b24);
    for (let x = -400; x <= world.w + 400; x += 140) g.moveTo(x, -400).lineTo(x, world.h + 400);
    for (let y = -400; y <= world.h + 400; y += 140) g.moveTo(-400, y).lineTo(world.w + 400, y);
    g.stroke({ width: 2, color: 0x1d1640, alpha: 1 });
    // floor
    const R = VOLT.arenaRadius;
    g.poly(octagon(R)).fill(0x221d63);
    // plates: concentric octagons and spokes
    for (const f of [0.78, 0.52, 0.26]) g.poly(octagon(R * f)).stroke({ width: 6, color: 0x2f2a84 });
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + Math.PI / 8;
      g.moveTo(ARENA_CX + Math.cos(a) * R * 0.26, ARENA_CY + Math.sin(a) * R * 0.26).lineTo(ARENA_CX + Math.cos(a) * R, ARENA_CY + Math.sin(a) * R);
    }
    g.stroke({ width: 6, color: 0x2f2a84 });
    // two half-circle zones, pink and cyan
    const zr = R * 0.34;
    g.arc(ARENA_CX - APOTHEM, ARENA_CY, zr, -Math.PI / 2, Math.PI / 2).fill({ color: NEON_PINK, alpha: 0.18 });
    g.arc(ARENA_CX - APOTHEM, ARENA_CY, zr, -Math.PI / 2, Math.PI / 2).stroke({ width: 10, color: PALETTE.amber, alpha: 0.7 });
    g.arc(ARENA_CX + APOTHEM, ARENA_CY, zr, Math.PI / 2, (Math.PI * 3) / 2).fill({ color: NEON_CYAN, alpha: 0.16 });
    g.arc(ARENA_CX + APOTHEM, ARENA_CY, zr, Math.PI / 2, (Math.PI * 3) / 2).stroke({ width: 10, color: PALETTE.amber, alpha: 0.7 });
    // centre mark
    g.circle(ARENA_CX, ARENA_CY, 90).stroke({ width: 8, color: 0x3d3799 });
    g.circle(ARENA_CX, ARENA_CY, 30).fill(0x3d3799);
    this.floorLayer.addChild(g);
    stage.layerBg.addChild(this.floorLayer);

    this.fighterLayer.sortableChildren = true;
    stage.layerMain.addChild(this.hazardLayer, this.fighterLayer, this.arcs, this.cage, this.boltLayer);
    this.drawCage(0);
  }

  /** Neon cage walls, redrawn so the glow can pulse. */
  private drawCage(t: number): void {
    const R = VOLT.arenaRadius + 14;
    const pts = octagon(R);
    const c = this.cage;
    c.clear();
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
    c.poly(pts).stroke({ width: 70, color: NEON_PINK, alpha: 0.07 * pulse });
    c.poly(pts).stroke({ width: 34, color: NEON_PINK, alpha: 0.18 * pulse });
    c.poly(pts).stroke({ width: 12, color: NEON_PINK, alpha: 0.95 });
    c.poly(pts).stroke({ width: 4, color: 0xffd1e3, alpha: 0.9 });
    for (let i = 0; i < pts.length; i += 2) c.circle(pts[i]!, pts[i + 1]!, 22).fill(0x2a1748).stroke({ width: 6, color: NEON_PINK });
  }

  focusSize(): number {
    return 70;
  }

  onSnapshot(snap: Snapshot): void {
    if (snap.you.entityId !== null) this.youId = snap.you.entityId;
    const S = this.stage;
    const near = (x: number, y: number, d = 1300) => Math.hypot(x - S.camX, y - S.camY) < d;
    for (const ev of snap.events) {
      if (ev.t === 'fx') {
        if (!near(ev.x, ev.y)) continue;
        const mine = ev.id === this.youId;
        switch (ev.kind) {
          case 'hit':
            S.burst(ev.x, ev.y, 0xffffff, 5, 220, 4);
            S.burst(ev.x, ev.y, PALETTE.amber, 4, 160, 5);
            if (mine) S.shake(2);
            break;
          case 'smash':
            S.burst(ev.x, ev.y, 0xffffff, 14, 420, 6);
            S.burst(ev.x, ev.y, NEON_CYAN, 10, 300, 7);
            S.shake(mine ? 9 : 4);
            break;
          case 'slam':
            S.burst(ev.x, ev.y, NEON_PINK, 16, 360, 6);
            S.shake(5);
            break;
          case 'zap':
            S.burst(ev.x, ev.y, PALETTE.violet, 14, 320, 5);
            S.burst(ev.x, ev.y, 0xffffff, 6, 420, 3);
            if (mine) S.shake(7);
            break;
          case 'block':
            S.burst(ev.x, ev.y, PALETTE.violet, 8, 200, 5);
            break;
          case 'orb':
            S.burst(ev.x, ev.y, PALETTE.mint, 16, 220, 5);
            if (mine) S.floatText(ev.x, ev.y - 40, `+${VOLT.orbHeal} HP`, PALETTE.mint, 28);
            break;
          case 'bolt':
            this.bolts.push({ x: ev.x, y: ev.y, life: 0.32 });
            S.burst(ev.x, ev.y, BOLT, 26, 520, 7);
            S.burst(ev.x, ev.y, PALETTE.violet, 18, 300, 9);
            S.shake(Math.max(2, 14 - Math.hypot(ev.x - S.camX, ev.y - S.camY) / 80));
            break;
        }
      } else if (ev.t === 'kill') {
        const v = this.fighters.get(ev.victimId);
        const color = v ? (v.torso.tint as number) : NEON_PINK;
        S.burst(ev.x, ev.y, color, 30, 420, 9);
        S.burst(ev.x, ev.y, 0xffffff, 12, 520, 5);
        if (ev.killerId !== null && ev.killerId === this.youId) {
          S.floatText(ev.x, ev.y - 40, `+${formatCredits(ev.amount)}`, PALETTE.amber);
          S.shake(10);
        } else if (ev.victimId === this.youId) S.shake(20);
        else S.shake(3);
      } else if (ev.t === 'cashout') {
        S.burst(ev.x, ev.y, PALETTE.mint, 30, 300, 7);
        if (ev.id === this.youId) S.floatText(ev.x, ev.y - 40, `+${formatCredits(ev.amount)}`, PALETTE.mint, 42);
      }
    }
  }

  render(ents: EntitySnap[], _snap: Snapshot, time: number, dtMs: number): void {
    const f = ++this.frame;
    const t = time / 1000;
    this.drawCage(t);
    this.arcs.clear();

    for (const e of ents) {
      if (e.k === VoltKind.Fighter) {
        let v = this.fighters.get(e.id);
        if (!v) {
          v = this.makeFighter(e);
          this.fighterLayer.addChild(v.root);
          this.fighters.set(e.id, v);
        }
        v.seen = f;
        this.updateFighter(v, e, t);
        continue;
      }
      let s = this.statics.get(e.id);
      if (!s || s.k !== e.k) {
        s?.c.destroy({ children: true });
        s = { c: this.makeStatic(e), seen: f, k: e.k };
        this.hazardLayer.addChild(s.c);
        this.statics.set(e.id, s);
      }
      s.seen = f;
      s.c.position.set(e.x, e.y);
      this.updateStatic(s.c, e, t);
    }
    for (const [id, v] of this.fighters) if (v.seen !== f) { v.root.destroy({ children: true }); this.fighters.delete(id); }
    for (const [id, s] of this.statics) if (s.seen !== f) { s.c.destroy({ children: true }); this.statics.delete(id); }

    // lightning bolts falling from the sky
    const g = this.boltLayer;
    g.clear();
    const dt = dtMs / 1000;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!;
      b.life -= dt;
      if (b.life <= 0) {
        this.bolts.splice(i, 1);
        continue;
      }
      const a = Math.min(1, b.life / 0.2);
      for (let k = 0; k < 2; k++) {
        jagged(g, b.x + (Math.random() - 0.5) * 60, b.y - 1100, b.x, b.y, 12, 90);
        g.stroke({ width: 26, color: PALETTE.violet, alpha: 0.25 * a });
        jagged(g, b.x + (Math.random() - 0.5) * 40, b.y - 1100, b.x, b.y, 12, 70);
        g.stroke({ width: 8, color: BOLT, alpha: 0.95 * a });
      }
      g.circle(b.x, b.y, VOLT.strikeRadius * (1.2 - a * 0.2)).fill({ color: BOLT, alpha: 0.35 * a });
    }
  }

  private makeStatic(e: EntitySnap): Container {
    const T = this.stage.textures;
    const c = new Container();
    if (e.k === VoltKind.Pylon) {
      const glow = new Sprite(T.soft);
      glow.anchor.set(0.5);
      glow.tint = PALETTE.violet;
      glow.scale.set((e.r * 3.4) / 64);
      glow.label = 'glow';
      const g = new Graphics();
      g.circle(0, 0, e.r + 14).fill(0x1b1540).stroke({ width: 6, color: PALETTE.amber });
      g.circle(0, 0, e.r).fill(0x3a1f6e);
      g.circle(0, 0, e.r * 0.62).fill(NEON_PINK);
      g.circle(0, 0, e.r * 0.3).fill(0xffd1e3);
      c.addChild(glow, g);
    } else if (e.k === VoltKind.Orb) {
      const glow = new Sprite(T.soft);
      glow.anchor.set(0.5);
      glow.tint = PALETTE.mint;
      glow.scale.set((e.r * 4) / 64);
      const core = new Sprite(T.circle);
      core.anchor.set(0.5);
      core.tint = PALETTE.mint;
      core.scale.set(e.r / 64);
      const plus = new Graphics();
      plus.rect(-e.r * 0.5, -2.5, e.r, 5).fill(0x0f3b30);
      plus.rect(-2.5, -e.r * 0.5, 5, e.r).fill(0x0f3b30);
      c.addChild(glow, core, plus);
    } else {
      // strike warning / bolt impact: redrawn every frame
      const g = new Graphics();
      g.label = 'g';
      c.addChild(g);
    }
    return c;
  }

  private updateStatic(c: Container, e: EntitySnap, t: number): void {
    if (e.k === VoltKind.Pylon) {
      const glow = c.getChildByLabel('glow');
      if (glow) glow.alpha = 0.55 + 0.35 * Math.sin(t * 5 + e.id);
      // crackling arcs around the pylon
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = e.r * 0.6;
        const r1 = e.r + 18 + Math.random() * 26;
        jagged(this.arcs, e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0, e.x + Math.cos(a + 0.4) * r1, e.y + Math.sin(a + 0.4) * r1, 4, 16);
      }
      this.arcs.stroke({ width: 3, color: BOLT, alpha: 0.8 });
    } else if (e.k === VoltKind.Orb) {
      c.scale.set(1 + 0.15 * Math.sin(t * 5 + e.id));
      c.y += Math.sin(t * 3 + e.id) * 4;
    } else {
      const g = c.getChildByLabel('g') as Graphics;
      g.clear();
      const p = e.p ?? 0;
      if (e.k === VoltKind.Strike) {
        const blink = p > 0.7 ? 0.5 + 0.5 * Math.sin(t * 40) : 1;
        g.circle(0, 0, e.r).fill({ color: NEON_PINK, alpha: 0.1 + 0.15 * p }).stroke({ width: 5, color: NEON_PINK, alpha: 0.85 * blink });
        g.circle(0, 0, e.r * p).fill({ color: BOLT, alpha: 0.18 + 0.2 * p });
        g.moveTo(-e.r * 0.25, 0).lineTo(e.r * 0.25, 0).moveTo(0, -e.r * 0.25).lineTo(0, e.r * 0.25).stroke({ width: 4, color: 0xffffff, alpha: 0.7 * blink });
      } else {
        g.circle(0, 0, e.r).fill({ color: 0x000000, alpha: 0.35 }).stroke({ width: 6, color: BOLT, alpha: 0.6 });
      }
    }
  }

  private makeFighter(e: EntitySnap): FighterView {
    const T = this.stage.textures;
    const color = e.c ?? NEON_PINK;
    const mk = (tex = T.circle, tint = 0xffffff) => {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.tint = tint;
      return s;
    };
    const r = e.r;
    const shadow = mk(T.circle, 0x000000);
    shadow.alpha = 0.35;
    shadow.scale.set((r * 1.15) / 64, (r * 0.8) / 64);
    shadow.position.set(6, 10);
    const rim = mk(T.circle, shade(color, 0.55));
    rim.scale.set(r / 64);
    const torso = mk(T.circle, color);
    torso.scale.set((r - 5) / 64);
    const visor = new Graphics();
    visor.arc(0, 0, r * 0.62, -0.75, 0.75).stroke({ width: 7, color: 0xffffff, alpha: 0.9, cap: 'round' });
    const fistL = mk(T.circle, shade(color, 1.25));
    const fistR = mk(T.circle, shade(color, 1.25));
    for (const fi of [fistL, fistR]) fi.scale.set((r * 0.38) / 64);
    const body = new Container();
    body.addChild(fistL, fistR, rim, torso, visor);
    const shield = mk(T.ring, PALETTE.violet);
    shield.visible = false;
    const hp = new Graphics();
    const ring = new Graphics();
    const style = { fontFamily: 'Nunito, sans-serif', fontWeight: '900' as const, fill: 0xffffff, stroke: { color: 0x0f0b24, width: 5 } };
    const name = new Text({ text: e.n ?? '', style: { ...style, fontSize: 22 }, resolution: 2 });
    name.anchor.set(0.5, 1);
    name.y = -r - 16;
    const stake = new Text({ text: '', style: { ...style, fontSize: 18, fill: PALETTE.amber }, resolution: 2 });
    stake.anchor.set(0.5, 1);
    stake.y = -r - 38;
    const root = new Container();
    root.addChild(shadow, body, shield, ring, hp, name, stake);
    return { root, body, shadow, torso, rim, visor, fistL, fistR, shield, hp, ring, name, stake, lastHp: -1, lastStake: -1, punchSide: 0, wasAttacking: false, seen: 0 };
  }

  private updateFighter(v: FighterView, e: EntitySnap, t: number): void {
    const flags = e.f ?? 0;
    const r = e.r;
    v.root.position.set(e.x, e.y);
    v.root.zIndex = e.y;
    v.root.alpha = flags & EntFlag.Protected ? 0.55 + 0.35 * Math.sin(t * 14) : 1;
    v.body.rotation = e.a ?? 0;

    // fists: guard position, one jabs forward while attacking (alternating)
    const attacking = (flags & EntFlag.Attack) !== 0;
    if (attacking && !v.wasAttacking) v.punchSide ^= 1;
    v.wasAttacking = attacking;
    const dashing = (flags & EntFlag.Dash) !== 0;
    const guard = (side: number) => ({ x: r * 0.55, y: side * r * 0.72 });
    const gl = guard(-1);
    const gr = guard(1);
    if (dashing) {
      gl.x = gr.x = r * 1.25;
      gl.y = -r * 0.3;
      gr.y = r * 0.3;
    } else if (attacking) {
      const p = v.punchSide === 0 ? gl : gr;
      p.x = r * 1.35;
      p.y *= 0.25;
    } else {
      const bob = Math.sin(t * 8 + e.id) * 3;
      gl.x += bob;
      gr.x -= bob;
    }
    v.fistL.position.set(gl.x, gl.y);
    v.fistR.position.set(gr.x, gr.y);

    if (dashing && Math.random() < 0.6) {
      const a = (e.a ?? 0) + Math.PI + (Math.random() - 0.5) * 0.7;
      this.stage.spawnParticle(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, Math.cos(a) * 90, Math.sin(a) * 90, NEON_CYAN, r * 0.45, 0.3, -1.6);
    }

    if (flags & EntFlag.Shield) {
      v.shield.visible = true;
      v.shield.scale.set(((r + 14) / 64) * (1 + 0.05 * Math.sin(t * 12)));
      v.shield.alpha = 0.7 + 0.3 * Math.sin(t * 8);
    } else v.shield.visible = false;

    const hp = e.h ?? 1;
    if (hp !== v.lastHp) {
      v.lastHp = hp;
      const w = r * 2;
      const color = hp > 0.6 ? PALETTE.mint : hp > 0.3 ? PALETTE.amber : PALETTE.pink;
      v.hp.clear();
      v.hp.roundRect(-w / 2 - 2, r + 10, w + 4, 11, 5).fill({ color: 0x0f0b24, alpha: 0.85 });
      v.hp.roundRect(-w / 2, r + 12, Math.max(0, w * hp), 7, 3.5).fill(color);
    }

    const s = e.s ?? 0;
    if (s !== v.lastStake) {
      v.stake.text = formatCredits(s);
      v.lastStake = s;
    }
    v.ring.clear();
    if (flags & EntFlag.Cashout) {
      v.ring.arc(0, 0, r + 16, -Math.PI / 2, -Math.PI / 2 + (e.p ?? 0) * Math.PI * 2).stroke({ width: 7, color: PALETTE.mint, cap: 'round' });
    }
    if (flags & EntFlag.You) {
      v.ring.circle(0, 0, r + 6).stroke({ width: 3, color: 0xffffff, alpha: 0.55 });
    }
  }

  destroy(): void {
    this.fighters.clear();
    this.statics.clear();
  }
}
