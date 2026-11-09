import { TICK_MS, lerp, lerpAngle, type EntitySnap, type Snapshot } from '@arena/shared';

/**
 * Snapshot interpolation buffer. Renders slightly in the past (one tick plus
 * jitter allowance) and blends between the two snapshots around that time.
 */
export class SnapshotBuffer {
  private buf: { at: number; snap: Snapshot }[] = [];
  constructor(private readonly delayMs = TICK_MS * 1.2) {}

  push(snap: Snapshot, at: number): void {
    this.buf.push({ at, snap });
    if (this.buf.length > 30) this.buf.shift();
  }

  get latest(): Snapshot | null {
    return this.buf[this.buf.length - 1]?.snap ?? null;
  }

  /** Interpolated entities at `now`. */
  sample(now: number): { ents: EntitySnap[]; snap: Snapshot } | null {
    if (this.buf.length === 0) return null;
    const t = now - this.delayMs;
    let i = this.buf.length - 1;
    while (i > 0 && this.buf[i - 1]!.at > t) i--;
    const b = this.buf[i]!;
    const a = this.buf[i - 1];
    // drop history we'll never need again
    if (i > 2) this.buf.splice(0, i - 2);
    if (!a || b.at <= a.at) return { ents: b.snap.ents, snap: b.snap };
    const k = Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at)));
    const prev = new Map<number, EntitySnap>();
    for (const e of a.snap.ents) prev.set(e.id, e);
    const ents = b.snap.ents.map((e) => {
      const p = prev.get(e.id);
      if (!p) return e;
      return {
        ...e,
        x: lerp(p.x, e.x, k),
        y: lerp(p.y, e.y, k),
        r: lerp(p.r, e.r, k),
        ...(e.a !== undefined && p.a !== undefined ? { a: lerpAngle(p.a, e.a, k) } : {}),
      };
    });
    return { ents, snap: b.snap };
  }
}
