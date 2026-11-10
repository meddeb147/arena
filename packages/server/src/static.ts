import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json',
};

/** Serves the built client (packages/client/dist) with an SPA fallback. */
export function staticHandler(dir: string) {
  const root = resolve(dir);
  const enabled = existsSync(join(root, 'index.html'));
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    if (!enabled || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    let file = normalize(join(root, url));
    if (file !== root && !file.startsWith(root + sep)) return false; // path traversal
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    const immutable = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
    return true;
  };
}
