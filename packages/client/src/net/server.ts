/**
 * Where is the game server?
 *  1. `?server=https://host` in the page URL (or `?server=offline`)
 *  2. VITE_SERVER_URL at build time (GitHub Pages build points it at the game server)
 *  3. the page's own origin, when the game server serves the page (or Vite dev proxy)
 * Returns null for offline play (bots only, engine in the browser).
 */
export function serverBase(): string | null {
  const q = new URLSearchParams(location.search).get('server');
  if (q === 'offline') return null;
  if (q && /^https?:\/\/[^\s]+$/.test(q)) return q.replace(/\/+$/, '');
  const env = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
  if (env === 'offline') return null;
  if (env) return env.replace(/\/+$/, '');
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
  if (location.hostname.endsWith('github.io')) return null; // static host, no game server there
  return location.origin;
}

export function wsUrl(base: string): string {
  return base.replace(/^http/, 'ws') + '/ws';
}

export interface ServerStats {
  online: number;
  humans: number;
  rooms: number;
}

/** Ask the server how many people are playing (also wakes a sleeping free-tier host). */
export async function fetchStats(base: string, timeoutMs = 70_000): Promise<ServerStats | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}/health`, { signal: ac.signal, cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as ServerStats;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Stable anonymous id so your wallet survives reloads (until accounts arrive in step 3). */
export function guestId(): string {
  try {
    const saved = localStorage.getItem('guestId');
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  try {
    localStorage.setItem('guestId', id);
  } catch {
    /* ignore */
  }
  return id;
}
