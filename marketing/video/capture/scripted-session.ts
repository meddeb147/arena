import { GAMES, MINT, MemoryLedger, Room, walletAcc } from '@arena/engine';
import { CREDIT, EMPTY_INPUT, TICK_MS, type GameId, type PlayerInput } from '@arena/shared';
import type { GameSession, SessionStatus } from '../../../packages/client/src/net/session';

export const HERO = 'hero';

/** Called before every simulation tick; may set inputs and stage positions. */
export type Script = (room: Room, tick: number) => Partial<PlayerInput> | null;

/**
 * A GameSession like the offline LocalSession, but with a fixed seed and a
 * script that drives the hero. Everything shown is the real engine and the
 * real UI; the script only chooses inputs and sets up moments (who stands where).
 */
export class ScriptedSession implements GameSession {
  onSnapshot: GameSession['onSnapshot'] = null;
  onStatus: GameSession['onStatus'] = null;
  readonly interpDelayMs = TICK_MS * 1.2;
  status: SessionStatus = 'offline';
  readonly room: Room;
  private last = -1;
  private acc = 0;
  private scriptTick = 0;

  constructor(readonly gameId: GameId, name: string, seed: number, private readonly script: Script, population = 10) {
    const game = GAMES[gameId]!;
    this.room = new Room(game, { id: 'capture', seed, ledger: new MemoryLedger(), targetPopulation: population });
    this.room.addPlayer(HERO, name);
    (this.room.ledger as MemoryLedger).transfer(MINT, walletAcc(HERO), 10 * CREDIT, 'grant');
    for (let i = 0; i < 150; i++) this.room.step();
  }

  update(now: number): void {
    if (this.last < 0) this.last = now;
    this.acc += Math.min(250, now - this.last);
    this.last = now;
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      const input = this.script(this.room, this.scriptTick++);
      if (input) this.room.setInput(HERO, { ...EMPTY_INPUT, ...input, seq: this.scriptTick });
      this.room.step();
      this.logEvents();
      const snap = this.room.snapshotFor(HERO);
      if (snap) this.onSnapshot?.(snap, now - this.acc);
    }
  }

  /** Record the hero's key moments with the (virtual) clock, so the video can sync to them. */
  private logEvents(): void {
    const w = window as unknown as { captureLog?: Record<string, unknown>[] };
    if (!w.captureLog) w.captureLog = [];
    const log = w.captureLog;
    const now = performance.now();
    const snap = this.room.snapshotFor(HERO);
    if (snap && snap.you.entityId !== null) this.lastId = snap.you.entityId;
    const me = this.lastId;
    for (const ev of this.room.lastEvents) {
      if (ev.t === 'spawn' && ev.id === me) log.push({ type: 'spawn', t: now });
      if (ev.t === 'kill' && ev.killerId === me) log.push({ type: 'ko', t: now, amount: ev.amount, stake: snap?.you.stake });
      if (ev.t === 'kill' && ev.victimId === me) log.push({ type: 'died', t: now });
      if (ev.t === 'cashout' && ev.id === me) log.push({ type: 'cashout', t: now, amount: ev.amount, wallet: snap?.you.wallet });
    }
    if (snap && snap.you.cashout > 0 && !this.cashing) {
      this.cashing = true;
      log.push({ type: 'cashout-start', t: now });
    }
  }
  private lastId: number | null = null;
  private cashing = false;

  /** player inputs from the keyboard/mouse are ignored: the script drives */
  sendInput(): void {}
  requestSpawn(): void {
    this.room.spawn(HERO);
  }
  refill(): void {}
  dispose(): void {
    this.onSnapshot = null;
  }
}
