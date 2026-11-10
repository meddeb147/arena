import { Container, Text } from 'pixi.js';
import { formatCredits, type Snapshot } from '@arena/shared';
import type { Stage } from '../render/stage';
import { PALETTE } from '../render/color';

/** Name + stake labels shared by the round-character games. */
export function makeLabels(name: string, dark: number): { name: Text; stake: Text } {
  const style = { fontFamily: 'Nunito, sans-serif', fontWeight: '900' as const, fill: 0xffffff, stroke: { color: dark, width: 5 } };
  const n = new Text({ text: name, style: { ...style, fontSize: 22 }, resolution: 2 });
  n.anchor.set(0.5, 1);
  const s = new Text({ text: '', style: { ...style, fontSize: 18, fill: PALETTE.amber }, resolution: 2 });
  s.anchor.set(0.5, 1);
  return { name: n, stake: s };
}

export function setStake(t: Text, units: number, cache: { last: number }): void {
  if (units === cache.last) return;
  cache.last = units;
  t.text = formatCredits(units);
}

/** Kill/cash-out effects every game shares: bursts, floating credits, shake. */
export function commonEvents(stage: Stage, snap: Snapshot, youId: number | null, colorOf: (id: number) => number | undefined): void {
  for (const ev of snap.events) {
    if (Math.hypot(ev.x - stage.camX, ev.y - stage.camY) > 1500) continue;
    if (ev.t === 'kill') {
      stage.burst(ev.x, ev.y, colorOf(ev.victimId) ?? PALETTE.pink, 30, 400, 8);
      stage.burst(ev.x, ev.y, 0xffffff, 10, 480, 4);
      if (ev.killerId !== null && ev.killerId === youId) {
        stage.floatText(ev.x, ev.y - 34, `+${formatCredits(ev.amount)}`, PALETTE.amber);
        stage.shake(10);
      } else if (ev.victimId === youId) stage.shake(20);
      else stage.shake(2);
    } else if (ev.t === 'cashout') {
      stage.burst(ev.x, ev.y, PALETTE.mint, 30, 300, 7);
      if (ev.id === youId) stage.floatText(ev.x, ev.y - 34, `+${formatCredits(ev.amount)}`, PALETTE.mint, 42);
    }
  }
}

export function destroyAll<T>(map: Map<number, T & { seen: number }>, frame: number, kill: (v: T) => void): void {
  for (const [id, v] of map) {
    if (v.seen === frame) continue;
    kill(v);
    map.delete(id);
  }
}

export type { Container };
