import { MemoryLedger, Room, blobGame } from '@arena/engine';
import { TICK_MS } from '@arena/shared';

/**
 * Headless load test: N rooms x 20 bots stepped as fast as possible.
 * Reports the CPU budget used per 30 Hz tick across all rooms.
 *   npm run bench -- 10      (10 rooms = 200 bots)
 */
const rooms = Number(process.argv[2] ?? 10);
const ticks = Number(process.argv[3] ?? 900);

const list = Array.from({ length: rooms }, (_, i) =>
  new Room(blobGame, { id: `b${i}`, seed: i + 1, ledger: new MemoryLedger(), targetPopulation: 20 }),
);
for (const r of list) for (let i = 0; i < 60; i++) r.step(); // warm up, bots spawn

const t0 = performance.now();
let worst = 0;
for (let t = 0; t < ticks; t++) {
  const s = performance.now();
  for (const r of list) r.step();
  worst = Math.max(worst, performance.now() - s);
}
const avg = (performance.now() - t0) / ticks;
const players = list.reduce((n, r) => n + r.botCount + r.humanCount, 0);
console.log(`rooms=${rooms} players=${players} ticks=${ticks}`);
console.log(`avg ${avg.toFixed(3)} ms/tick, worst ${worst.toFixed(3)} ms  (budget ${TICK_MS.toFixed(1)} ms => ${((avg / TICK_MS) * 100).toFixed(1)}% of one core)`);
