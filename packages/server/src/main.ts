import { PLAY_CREDITS_DISCLAIMER } from '@arena/shared';
import { startServer } from './app';

const PORT = Number(process.env.PORT ?? 8080);

const server = await startServer({ port: PORT });
console.log(`[arena] ${PLAY_CREDITS_DISCLAIMER}`);
console.log(`[arena] listening on :${server.port}  (game at /, websocket at /ws, stats at /health)`);

setInterval(() => {
  console.log('[arena]', JSON.stringify({ online: server.gateway.online, ...server.rooms.stats(), tickMs: Number(server.loop.lastMs.toFixed(3)) }));
}, 60_000).unref();

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
