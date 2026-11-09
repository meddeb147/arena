import type { PlayerInput } from '@arena/shared';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Never trust the client: coerce anything into a valid input.
 * Direction magnitude is capped at 1 so a client can't request extra speed.
 */
export function sanitizeInput(raw: unknown, prevSeq = 0): PlayerInput {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  let dx = num(o.dx);
  let dy = num(o.dy);
  const m = Math.hypot(dx, dy);
  if (m > 1) {
    dx /= m;
    dy /= m;
  }
  const seq = Math.max(prevSeq, Math.floor(num(o.seq)));
  return { seq, dx, dy, skill1: o.skill1 === true, skill2: o.skill2 === true, cashout: o.cashout === true };
}
