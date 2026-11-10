import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { PROTOCOL_VERSION, type EntitySnap, type ServerMsg } from '@arena/shared';
import { startServer, type RunningServer } from '../src/app';

let server: RunningServer;

beforeAll(async () => {
  server = await startServer({ port: 0, host: '127.0.0.1', staticDir: '/nonexistent' });
});
afterAll(async () => {
  await server.close();
});

/** Minimal test client that rebuilds the world from delta snapshots. */
class Bot {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  world = new Map<number, EntitySnap>();
  welcome: Extract<ServerMsg, { t: 'welcome' }> | null = null;
  last: Extract<ServerMsg, { t: 's' }> | null = null;
  closed = false;
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMsg;
      this.msgs.push(m);
      if (m.t === 'welcome') this.welcome = m;
      if (m.t === 's') {
        for (const id of m.d) this.world.delete(id);
        for (const e of m.u) this.world.set(e.id, e);
        this.last = m;
      }
    });
    this.ws.on('close', () => (this.closed = true));
  }
  open() {
    return new Promise<void>((res) => this.ws.once('open', () => res()));
  }
  send(o: unknown) {
    this.ws.send(JSON.stringify(o));
  }
  hello(name: string, guestId: string) {
    this.send({ t: 'hello', v: PROTOCOL_VERSION, game: 'blob', name, guestId });
  }
}

const until = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe('multiplayer gateway', () => {
  it('puts friends who join together in the same room', async () => {
    const a = new Bot(server.port);
    const b = new Bot(server.port);
    await Promise.all([a.open(), b.open()]);
    a.hello('Alice', 'guest-alice-123');
    b.hello('Bob', 'guest-bob-4567');
    await until(() => !!a.welcome && !!b.welcome);
    expect(a.welcome!.roomId).toBe(b.welcome!.roomId);

    a.send({ t: 'spawn' });
    b.send({ t: 'spawn' });
    await until(() => a.last?.you.state === 'alive' && b.last?.you.state === 'alive');
    await until(() => (a.last?.pop.humans ?? 0) === 2);
    expect(b.last!.pop.humans).toBe(2);
    expect(a.last!.you.wallet).toBe(900); // 10 credits granted, 1 at stake

    // delta snapshots: the first carries the whole view, later ones only changes
    const snaps = a.msgs.filter((m): m is Extract<ServerMsg, { t: 's' }> => m.t === 's');
    const first = snaps[0]!.u.length;
    await until(() => a.msgs.filter((m) => m.t === 's').length > snaps.length + 5);
    const later = (a.msgs.filter((m) => m.t === 's').at(-1) as Extract<ServerMsg, { t: 's' }>).u.length;
    expect(later).toBeLessThan(first);
    expect(a.world.size).toBeGreaterThan(50); // pellets kept client-side

    // inputs move the player (server-authoritative)
    const me = () => a.world.get(a.last!.you.entityId!)!;
    const x0 = me().x;
    for (let i = 0; i < 10; i++) {
      a.send({ t: 'in', seq: i + 1, dx: x0 < 1600 ? 1 : -1, dy: 0, s1: 0, s2: 0, co: 0 });
      await new Promise((r) => setTimeout(r, 30));
    }
    await until(() => Math.abs(me().x - x0) > 20);

    a.ws.close();
    b.ws.close();
  });

  it('survives garbage and rejects oversized messages', async () => {
    const c = new Bot(server.port);
    await c.open();
    c.ws.send('{not json');
    c.send({ t: 'in', dx: 1e9, dy: Number.NaN }); // before hello: ignored
    c.hello('Eve', 'guest-eve-99999');
    await until(() => !!c.welcome);
    c.send({ t: 'in', seq: 1, dx: 1e9, dy: -1e9, s1: 7, s2: 'x', co: null });
    c.ws.send('x'.repeat(2000));
    await until(() => c.closed);
    expect(c.msgs.some((m) => m.t === 'err')).toBe(true);
  });

  it('private room codes keep friends together and strangers out', async () => {
    const hello = (b: Bot, name: string, id: string, room?: string) => b.send({ t: 'hello', v: PROTOCOL_VERSION, game: 'blob', name, guestId: id, ...(room ? { room } : {}) });
    const [f1, f2, other, pub, bad] = [0, 1, 2, 3, 4].map(() => new Bot(server.port));
    await Promise.all([f1, f2, other, pub, bad].map((b) => b!.open()));
    hello(f1!, 'Ana', 'guest-friend-001', 'K7QX2');
    hello(f2!, 'Ben', 'guest-friend-002', 'K7QX2');
    hello(other!, 'Cat', 'guest-friend-003', 'ZZZZ9');
    hello(pub!, 'Dan', 'guest-friend-004');
    hello(bad!, 'Eve', 'guest-friend-005', 'not a code');
    await until(() => [f1, f2, other, pub, bad].every((b) => !!b!.welcome));
    expect(f1!.welcome!.roomId).toBe(f2!.welcome!.roomId);
    expect(f1!.welcome!.code).toBe('K7QX2');
    expect(other!.welcome!.roomId).not.toBe(f1!.welcome!.roomId);
    expect(pub!.welcome!.roomId).not.toBe(f1!.welcome!.roomId);
    expect(pub!.welcome!.code).toBeUndefined();
    expect(bad!.welcome!.code).toBeUndefined(); // invalid codes are ignored: public matchmaking
    for (const b of [f1, f2, other, pub, bad]) b!.ws.close();
  });

  it('the chosen colour is used; invalid choices fall back', async () => {
    const mk = async (id: string, color: unknown) => {
      const c = new Bot(server.port);
      await c.open();
      c.send({ t: 'hello', v: PROTOCOL_VERSION, game: 'blob', name: 'Col', guestId: id, color });
      await until(() => !!c.welcome);
      c.send({ t: 'spawn' });
      await until(() => !!c.last && c.last.you.entityId !== null && !!c.world.get(c.last.you.entityId));
      const col = c.world.get(c.last!.you.entityId!)!.c;
      c.ws.close();
      return col;
    };
    expect(await mk('guest-color-0001', 12)).toBe(0xff2e63);
    expect(typeof (await mk('guest-color-0002', 999))).toBe('number');
    expect(typeof (await mk('guest-color-0003', 'red'))).toBe('number');
  });

  it('offensive nicknames are replaced', async () => {
    const c = new Bot(server.port);
    await c.open();
    c.hello('Sh1t Lord', 'guest-rude-00001');
    await until(() => !!c.welcome);
    c.send({ t: 'spawn' });
    await until(() => !!c.last && c.last.you.state === 'alive');
    const me = c.world.get(c.last!.you.entityId!);
    await until(() => !!c.world.get(c.last!.you.entityId!)?.n);
    expect(c.world.get(c.last!.you.entityId!)!.n).toBe('Player');
    expect(me).toBeTruthy();
    c.ws.close();
  });

  it('a second tab with the same guest replaces the first', async () => {
    const a = new Bot(server.port);
    await a.open();
    a.hello('Dup', 'guest-dup-00000');
    await until(() => !!a.welcome);
    const a2 = new Bot(server.port);
    await a2.open();
    a2.hello('Dup', 'guest-dup-00000');
    await until(() => !!a2.welcome && a.closed);
    expect(a.msgs.some((m) => m.t === 'err' && m.code === 'replaced')).toBe(true);
    a2.ws.close();
  });
});
