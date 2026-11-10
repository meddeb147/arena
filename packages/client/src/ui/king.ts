import { Graphics } from 'pixi.js';
import { EntFlag, formatCredits, type EntitySnap, type Snapshot } from '@arena/shared';
import { t } from '../i18n';
import type { Stage } from '../render/stage';
import { h } from './dom';

/**
 * The King, shared by every game: a crown over the richest player and, when
 * they are off-screen, an arrow on the screen edge pointing to them with their
 * bounty, so everyone knows who to hunt.
 */
export class KingMarker {
  private g = new Graphics();
  private arrow: HTMLElement;
  private label: HTMLElement;

  constructor(private readonly stage: Stage, root: HTMLElement) {
    stage.layerFx.addChild(this.g);
    this.label = h('span');
    this.arrow = h('div.king-arrow', {}, h('i'), this.label);
    this.arrow.hidden = true;
    root.append(this.arrow);
  }

  update(ents: EntitySnap[], snap: Snapshot, timeMs: number): void {
    const g = this.g;
    g.clear();
    const king = snap.king;
    if (!king) {
      this.arrow.hidden = true;
      return;
    }
    const me = snap.you.entityId === king.id;
    const ent = ents.find((e) => e.id === king.id && (e.f ?? 0) & EntFlag.King);
    const secs = timeMs / 1000;
    if (ent) {
      // crown, bobbing above the head, with a gold ring
      const z = 1 / Math.max(0.35, this.stage.zoom);
      const s = Math.min(1.6, Math.max(0.8, z * 0.8));
      const x = ent.x;
      const y = ent.y - ent.r - 62 * s + Math.sin(secs * 3) * 4;
      g.circle(ent.x, ent.y, ent.r + 18).stroke({ width: 5, color: 0xffd84f, alpha: 0.45 + 0.3 * Math.sin(secs * 5) });
      g.poly([x - 26 * s, y + 14 * s, x - 30 * s, y - 12 * s, x - 13 * s, y + 2 * s, x, y - 18 * s, x + 13 * s, y + 2 * s, x + 30 * s, y - 12 * s, x + 26 * s, y + 14 * s])
        .fill(0xffd84f)
        .stroke({ width: 3 * s, color: 0xb8860b });
      for (const dx of [-14, 0, 14]) g.circle(x + dx * s, y + 8 * s, 3.2 * s).fill(dx === 0 ? 0xff4f7b : 0x4fd2ff);
    }
    // off-screen arrow (not for the King themself)
    const sx = (king.x - this.stage.camX) * this.stage.zoom + this.stage.width / 2;
    const sy = (king.y - this.stage.camY) * this.stage.zoom + this.stage.height / 2;
    const margin = 60;
    const off = sx < margin || sy < margin || sx > this.stage.width - margin || sy > this.stage.height - margin;
    if (!off || me) {
      this.arrow.hidden = true;
      return;
    }
    const cx = this.stage.width / 2;
    const cy = this.stage.height / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const k = Math.min((cx - margin) / Math.abs(Math.cos(ang) || 1e-6), (cy - margin) / Math.abs(Math.sin(ang) || 1e-6));
    this.arrow.hidden = false;
    this.arrow.style.transform = `translate(${cx + Math.cos(ang) * k}px, ${cy + Math.sin(ang) * k}px)`;
    (this.arrow.firstChild as HTMLElement).style.transform = `rotate(${ang}rad)`;
    const text = `👑 ${king.name} · ${t('bounty')} +${formatCredits(king.bounty)}`;
    if (this.label.textContent !== text) this.label.textContent = text;
  }

  destroy(): void {
    this.g.destroy();
    this.arrow.remove();
  }
}
