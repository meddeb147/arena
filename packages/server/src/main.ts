import { createServer } from 'node:http';
import { MemoryLedger, Room, blobGame, HOUSE } from '@arena/engine';
import { PLAY_CREDITS_DISCLAIMER, TICK_MS, formatCredits } from '@arena/shared';
import { FixedLoop } from './loop';

/**
 * Step 1 server: runs one authoritative Blob Stake room full of bots at 30 Hz.
 * Step 2 adds the WebSocket gateway and matchmaking on top of this.
 */
const PORT = Number(process.env.PORT ?? 8080);

const ledger = new MemoryLedger();
const room = new Room(blobGame, { id: 'blob-1', seed: Date.now() & 0xffffffff, ledger });
let kills = 0;
let cashouts = 0;

const loop = new FixedLoop(TICK_MS, () => {
  room.step();
  for (const ev of room.lastEvents) {
    if (ev.t === 'kill') kills++;
    else if (ev.t === 'cashout') cashouts++;
  }
});
loop.start();

const stats = () => ({
  room: room.roomId,
  tick: room.tick,
  humans: room.humanCount,
  bots: room.botCount,
  kills,
  cashouts,
  house: formatCredits(ledger.balance(HOUSE)),
  tickMs: Number(loop.lastMs.toFixed(3)),
  maxTickMs: Number(loop.maxMs.toFixed(3)),
});

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...stats() }));
    return;
  }
  res.writeHead(404).end();
});
http.listen(PORT, () => {
  console.log(`[arena] ${PLAY_CREDITS_DISCLAIMER}`);
  console.log(`[arena] server on :${PORT}  (GET /health)`);
});

setInterval(() => console.log('[arena]', JSON.stringify(stats())), 10_000).unref();

const shutdown = () => {
  loop.stop();
  http.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
