import {
  PROTOCOL_VERSION,
  ROOM_CODE_RE,
  TICK_MS,
  type ClientMsg,
  type EntitySnap,
  type GameId,
  type PlayerInput,
  type ServerMsg,
} from '@arena/shared';
import { guestId, wsUrl } from './server';
import type { GameSession, SessionStatus } from './session';

/**
 * Online play: the server runs the room; we send inputs and rebuild the world
 * from delta snapshots (changed entities + removed ids).
 */
export class NetSession implements GameSession {
  onSnapshot: GameSession['onSnapshot'] = null;
  onStatus: GameSession['onStatus'] = null;
  readonly interpDelayMs = 110;
  private ws: WebSocket;
  private readonly world = new Map<number, EntitySnap>();
  private size = { w: 0, h: 0 };
  private queue: string[] = [];
  private lastSent = 0;
  private lastKey = '';
  private ready!: Promise<void>;
  status: SessionStatus = 'connecting';
  /** private room code, when playing with friends */
  roomCode: string | null = null;
  closeReason = '';

  constructor(readonly gameId: GameId, name: string, base: string) {
    this.ws = new WebSocket(wsUrl(base));
    this.ready = new Promise<void>((resolve, reject) => {
      this.ws.onopen = () => {
        const room = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
        this.raw({ t: 'hello', v: PROTOCOL_VERSION, game: gameId, name, guestId: guestId(), ...(ROOM_CODE_RE.test(room) ? { room } : {}) });
        for (const m of this.queue) this.ws.send(m);
        this.queue = [];
      };
      this.ws.onmessage = (ev) => {
        let m: ServerMsg;
        try {
          m = JSON.parse(String(ev.data)) as ServerMsg;
        } catch {
          return;
        }
        if (m.t === 'welcome') {
          this.size = m.world;
          this.roomCode = m.code ?? null;
          this.setStatus('online');
          resolve();
        } else if (m.t === 's') this.applySnapshot(m);
        else if (m.t === 'err') this.closeReason = m.code;
      };
      this.ws.onclose = () => {
        this.setStatus('closed');
        reject(new Error(this.closeReason || 'closed'));
      };
    });
    this.ready.catch(() => undefined);
  }

  /** Resolves once the server has put us in a room. */
  connected(): Promise<void> {
    return this.ready;
  }

  private setStatus(s: SessionStatus): void {
    this.status = s;
    this.onStatus?.(s);
  }

  private applySnapshot(m: Extract<ServerMsg, { t: 's' }>): void {
    for (const id of m.d) this.world.delete(id);
    for (const e of m.u) this.world.set(e.id, e);
    this.onSnapshot?.(
      { tick: m.tick, game: this.gameId, world: this.size, ents: [...this.world.values()], lb: m.lb, events: m.ev, you: m.you, pop: m.pop, king: m.king ?? null },
      performance.now(),
    );
  }

  private raw(m: ClientMsg): void {
    const s = JSON.stringify(m);
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(s);
    else if (this.ws.readyState === WebSocket.CONNECTING) this.queue.push(s);
  }

  update(): void {
    /* the server owns time */
  }

  /** Throttled to the tick rate; button changes are sent immediately. */
  sendInput(i: PlayerInput): void {
    const now = performance.now();
    const key = `${+i.skill1}${+i.skill2}${+i.cashout}`;
    if (key === this.lastKey && now - this.lastSent < TICK_MS) return;
    this.lastSent = now;
    this.lastKey = key;
    const r = (v: number) => Math.round(v * 1000) / 1000;
    this.raw({ t: 'in', seq: i.seq, dx: r(i.dx), dy: r(i.dy), s1: i.skill1 ? 1 : 0, s2: i.skill2 ? 1 : 0, co: i.cashout ? 1 : 0 });
  }

  requestSpawn(): void {
    this.raw({ t: 'spawn' });
  }

  refill(): void {
    this.raw({ t: 'refill' });
  }

  dispose(): void {
    this.onSnapshot = null;
    this.onStatus = null;
    this.ws.onclose = null;
    this.ws.close();
  }
}
