import { CREDIT, KILLER_SHARE_PCT } from './constants';

/** Split a victim's stake between killer and house. Integer-exact: killer + house === stake. */
export function splitKill(stake: number): { killer: number; house: number } {
  assertUnits(stake);
  const killer = Math.floor((stake * KILLER_SHARE_PCT) / 100);
  return { killer, house: stake - killer };
}

export function assertUnits(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`invalid credit amount: ${amount}`);
  }
}

/** 150 -> "1.50" */
export function formatCredits(units: number): string {
  const sign = units < 0 ? '-' : '';
  const abs = Math.abs(units);
  const whole = Math.floor(abs / CREDIT);
  const frac = String(abs % CREDIT).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}
