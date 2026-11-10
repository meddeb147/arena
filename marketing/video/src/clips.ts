import volt from '../public/clips/volt.json';
import blob from '../public/clips/blob.json';

type Moment = { type: string; t: number; amount?: number; stake?: number; wallet?: number };
type Meta = { moments: Moment[] };

const find = (m: Meta, type: string, nth = 0, fallback = 0): Moment => m.moments.filter((x) => x.type === type)[nth] ?? { type, t: fallback };

/** Key moments in the captured footage (seconds into each clip), measured during capture. */
export const VOLT = {
  ko1: find(volt as Meta, 'ko', 0, 6.4),
  ko2: find(volt as Meta, 'ko', 1, 9.4),
  cashStart: find(volt as Meta, 'cashout-start', 0, 11.5),
  cashDone: find(volt as Meta, 'cashout', 0, 14.5),
};
export const BLOB = { eat: find(blob as Meta, 'ko', 0, 3.2) };
