import { GAMES, MINT, MemoryLedger, Room, walletAcc } from '@arena/engine';
import { CREDIT, SPAWN_STAKE, TICK_MS, type GameId, type PlayerInput } from '@arena/shared';
import type { GameSession } from './session';

const PLAYER = 'local';

/** Runs an authoritative room in the browser at a fixed 30 Hz. */
export class LocalSession implements GameSession {
  onSnapshot: GameSession['onSnapshot'] = null;
  private readonly room: Room;
  private readonly ledger = new MemoryLedger();
  private last = -1;
  private acc = 0;

  constructor(readonly gameId: GameId, name: string) {
    const game = GAMES[gameId];
    if (!game) throw new Error(`game not available: ${gameId}`);
    this.room = new Room(game, { id: 'local', seed: (Math.random() * 2 ** 31) | 0, ledger: this.ledger });
    this.room.addPlayer(PLAYER, name);
    this.ledger.transfer(MINT, walletAcc(PLAYER), 10 * CREDIT, 'grant');
    // let the bots spread out before we arrive
    for (let i = 0; i < 90; i++) this.room.step();
  }

  update(now: number): void {
    if (this.last < 0) this.last = now;
    this.acc += Math.min(250, now - this.last);
    this.last = now;
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.room.step();
      const snap = this.room.snapshotFor(PLAYER);
      if (snap) this.onSnapshot?.(snap, now - this.acc);
    }
  }

  sendInput(input: PlayerInput): void {
    this.room.setInput(PLAYER, input);
  }

  requestSpawn(): void {
    this.room.spawn(PLAYER);
  }

  refill(): void {
    const bal = this.ledger.balance(walletAcc(PLAYER));
    if (bal < SPAWN_STAKE) this.ledger.transfer(MINT, walletAcc(PLAYER), 5 * CREDIT, 'grant');
  }

  dispose(): void {
    this.onSnapshot = null;
  }
}
