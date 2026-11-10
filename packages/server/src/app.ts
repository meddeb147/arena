import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { HOUSE, MemoryLedger } from '@arena/engine';
import { MAX_MESSAGE_BYTES, SNAPSHOT_EVERY_TICKS, TICK_MS, WS_PATH, formatCredits } from '@arena/shared';
import { Gateway } from './gateway';
import { FixedLoop } from './loop';
import { RoomManager } from './rooms';
import { staticHandler } from './static';

export interface ServerOptions {
  port: number;
  /** built client to serve; defaults to packages/client/dist */
  staticDir?: string;
  host?: string;
}

export interface RunningServer {
  port: number;
  http: Server;
  rooms: RoomManager;
  gateway: Gateway;
  ledger: MemoryLedger;
  loop: FixedLoop;
  close(): Promise<void>;
}

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const ledger = new MemoryLedger();
  const rooms = new RoomManager(ledger);
  const serveStatic = staticHandler(opts.staticDir ?? fileURLToPath(new URL('../../client/dist', import.meta.url)));
  const started = Date.now();

  const http = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/health' || path === '/api/stats') {
      res.writeHead(200, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      });
      res.end(
        JSON.stringify({
          ok: true,
          online: gateway.online,
          ...rooms.stats(),
          tickMs: Number(loop.lastMs.toFixed(3)),
          uptimeS: Math.round((Date.now() - started) / 1000),
          house: formatCredits(ledger.balance(HOUSE)),
        }),
      );
      return;
    }
    if (serveStatic(req, res)) return;
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  });

  const wss = new WebSocketServer({
    server: http,
    path: WS_PATH,
    maxPayload: MAX_MESSAGE_BYTES * 4,
    perMessageDeflate: { threshold: 512, zlibDeflateOptions: { level: 3 } },
  });
  const gateway = new Gateway(wss, rooms, ledger);

  const loop = new FixedLoop(TICK_MS, () => {
    rooms.step();
    if (rooms.tick % SNAPSHOT_EVERY_TICKS === 0) gateway.broadcast();
  });

  await new Promise<void>((res) => http.listen(opts.port, opts.host ?? '0.0.0.0', res));
  loop.start();
  const port = (http.address() as AddressInfo).port;

  return {
    port,
    http,
    rooms,
    gateway,
    ledger,
    loop,
    close: async () => {
      loop.stop();
      gateway.close();
      wss.close();
      await new Promise<void>((res) => http.close(() => res()));
    },
  };
}
