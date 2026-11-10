import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { GAMES, MINT, walletAcc, type MemoryLedger } from '@arena/engine';
import {
  CREDIT,
  MAX_MESSAGES_PER_SECOND,
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  SPAWN_STAKE,
  TICK_RATE,
  ROOM_CODE_RE,
  cleanName,
  type ClientMsg,
  type EntitySnap,
  type GameEvent,
  type GameId,
  type ServerMsg,
} from '@arena/shared';
import type { AnyRoom, RoomManager } from './rooms';

const STARTING_GRANT = 10 * CREDIT;
const REFILL_GRANT = 5 * CREDIT;
const REFILL_COOLDOWN_MS = 20_000;
/** skip snapshots to a client whose socket is this backed up (slow connection) */
const MAX_BUFFERED = 512 * 1024;

interface Client {
  ws: WebSocket;
  ip: string;
  playerId: string | null;
  room: AnyRoom | null;
  /** last entity state sent to this client, for delta snapshots */
  sent: Map<number, EntitySnap>;
  winStart: number;
  winCount: number;
  strikes: number;
  lastRefill: number;
  alive: boolean;
}

const sameEnt = (a: EntitySnap, b: EntitySnap): boolean =>
  a.x === b.x && a.y === b.y && a.r === b.r && a.a === b.a && a.c === b.c && a.f === b.f && a.s === b.s && a.p === b.p && a.n === b.n && a.k === b.k && a.pts === b.pts;

/**
 * WebSocket gateway: authenticates (guest ids for now), validates and
 * rate-limits every message, and streams per-player delta snapshots.
 */
export class Gateway {
  private readonly clients = new Set<Client>();
  private readonly byPlayer = new Map<string, Client>();
  /** guests that already received the starting grant (in-memory until step 3) */
  private readonly granted = new Set<string>();
  private heartbeat: NodeJS.Timeout;

  constructor(
    readonly wss: WebSocketServer,
    private readonly rooms: RoomManager,
    private readonly ledger: MemoryLedger,
  ) {
    wss.on('connection', (ws, req) => this.onConnection(ws, req));
    this.heartbeat = setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) {
          c.ws.terminate();
          continue;
        }
        c.alive = false;
        c.ws.ping();
      }
    }, 15_000);
    this.heartbeat.unref();
  }

  get online(): number {
    return this.byPlayer.size;
  }

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0]!.trim();
    const c: Client = { ws, ip, playerId: null, room: null, sent: new Map(), winStart: Date.now(), winCount: 0, strikes: 0, lastRefill: 0, alive: true };
    this.clients.add(c);
    ws.on('pong', () => (c.alive = true));
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const buf = data as Buffer;
      if (buf.length > MAX_MESSAGE_BYTES) return this.kick(c, 'rate', 'message too large');
      if (!this.allow(c)) return;
      let msg: ClientMsg;
      try {
        msg = JSON.parse(buf.toString('utf8')) as ClientMsg;
      } catch {
        return;
      }
      if (typeof msg !== 'object' || msg === null) return;
      this.handle(c, msg);
    });
    ws.on('close', () => this.drop(c));
    ws.on('error', () => this.drop(c));
  }

  /** Sliding one-second window; persistent flooding gets the socket closed. */
  private allow(c: Client): boolean {
    const now = Date.now();
    if (now - c.winStart >= 1000) {
      if (c.winCount > MAX_MESSAGES_PER_SECOND * 3) c.strikes++;
      c.winStart = now;
      c.winCount = 0;
    }
    c.winCount++;
    if (c.strikes >= 3) {
      this.kick(c, 'rate', 'too many messages');
      return false;
    }
    return c.winCount <= MAX_MESSAGES_PER_SECOND;
  }

  private handle(c: Client, msg: ClientMsg): void {
    switch (msg.t) {
      case 'hello':
        return this.hello(c, msg);
      case 'ping':
        return this.send(c, { t: 'pong', c: Number(msg.c) || 0, s: Date.now() });
    }
    if (!c.room || !c.playerId) return;
    switch (msg.t) {
      case 'in':
        c.room.setInput(c.playerId, { seq: msg.seq, dx: msg.dx, dy: msg.dy, skill1: msg.s1 === 1, skill2: msg.s2 === 1, cashout: msg.co === 1 });
        break;
      case 'spawn':
        c.room.spawn(c.playerId);
        break;
      case 'refill': {
        const now = Date.now();
        if (this.ledger.balance(walletAcc(c.playerId)) < SPAWN_STAKE && now - c.lastRefill > REFILL_COOLDOWN_MS) {
          c.lastRefill = now;
          this.ledger.transfer(MINT, walletAcc(c.playerId), REFILL_GRANT, 'grant', 0, 'refill');
        }
        break;
      }
    }
  }

  private hello(c: Client, msg: Extract<ClientMsg, { t: 'hello' }>): void {
    if (c.playerId) return;
    if (msg.v !== PROTOCOL_VERSION) return this.kick(c, 'version', 'please reload the page');
    const game = msg.game as GameId;
    if (!GAMES[game]) return this.kick(c, 'bad_game');
    const guest = typeof msg.guestId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(msg.guestId) ? msg.guestId : randomBytes(12).toString('base64url');
    const playerId = `guest:${guest}`;
    const name = cleanName(msg.name) || `Guest${Math.floor(1000 + Math.random() * 9000)}`;

    // one live connection per guest: a new tab replaces the old one
    const old = this.byPlayer.get(playerId);
    if (old) this.kick(old, 'replaced', 'opened in another tab');

    if (!this.granted.has(playerId)) {
      this.granted.add(playerId);
      if (this.ledger.balance(walletAcc(playerId)) === 0) this.ledger.transfer(MINT, walletAcc(playerId), STARTING_GRANT, 'grant', 0, 'welcome');
    }

    const code = typeof msg.room === 'string' && ROOM_CODE_RE.test(msg.room) ? msg.room : null;
    let room: AnyRoom;
    try {
      room = this.rooms.pick(game, code);
      room.addPlayer(playerId, name);
    } catch {
      return this.kick(c, 'full');
    }
    c.playerId = playerId;
    c.room = room;
    this.byPlayer.set(playerId, c);
    this.send(c, { t: 'welcome', playerId, roomId: room.roomId, game, world: { w: room.config.width, h: room.config.height }, tickRate: TICK_RATE, ...(code ? { code } : {}) });
  }

  /** Called after the room manager advanced; streams snapshots to everyone. */
  broadcast(): void {
    const events = new Map<string, GameEvent[]>();
    for (const r of this.rooms.all) events.set(r.roomId, this.rooms.takeEvents(r.roomId));
    for (const c of this.clients) {
      if (!c.room || !c.playerId || c.ws.readyState !== WebSocket.OPEN) continue;
      if (c.ws.bufferedAmount > MAX_BUFFERED) continue;
      const snap = c.room.snapshotFor(c.playerId);
      if (!snap) continue;
      const u: EntitySnap[] = [];
      const seen = new Set<number>();
      for (const e of snap.ents) {
        seen.add(e.id);
        const prev = c.sent.get(e.id);
        if (!prev || !sameEnt(prev, e)) {
          u.push(e);
          c.sent.set(e.id, e);
        }
      }
      const d: number[] = [];
      for (const id of c.sent.keys()) {
        if (!seen.has(id)) {
          d.push(id);
          c.sent.delete(id);
        }
      }
      this.send(c, { t: 's', tick: snap.tick, u, d, lb: snap.lb, ev: events.get(c.room.roomId) ?? [], you: snap.you, pop: snap.pop, king: snap.king });
    }
  }

  private send(c: Client, msg: ServerMsg): void {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg));
  }

  private kick(c: Client, code: Extract<ServerMsg, { t: 'err' }>['code'], text?: string): void {
    this.send(c, { t: 'err', code, ...(text ? { msg: text } : {}) });
    this.drop(c);
    c.ws.close(4000, code);
  }

  private drop(c: Client): void {
    if (!this.clients.delete(c)) return;
    if (c.playerId && this.byPlayer.get(c.playerId) === c) this.byPlayer.delete(c.playerId);
    if (c.room && c.playerId) c.room.removePlayer(c.playerId); // live entity auto-cashes-out
    c.room = null;
  }

  close(): void {
    clearInterval(this.heartbeat);
    for (const c of [...this.clients]) c.ws.terminate();
  }
}
