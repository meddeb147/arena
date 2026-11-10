import { GAMES, Room, type Ledger } from '@arena/engine';
import type { GameEvent, GameId } from '@arena/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRoom = Room<any, any, any>;

interface Slot {
  room: AnyRoom;
  game: GameId;
  idleSince: number | null;
  /** events produced since the last snapshot flush */
  pending: GameEvent[];
}

/**
 * Owns every live room. Matchmaking puts a player in the FULLEST room of the
 * requested game that still has space, so friends who join around the same
 * time end up together; a new room opens only when all are full.
 */
export class RoomManager {
  private readonly slots = new Map<string, Slot>();
  private seq = 0;
  tick = 0;

  constructor(
    private readonly ledger: Ledger,
    /** rooms per game kept running even when empty, so joining is instant */
    private readonly warmPerGame = 1,
    /** close extra empty rooms after this many ticks */
    private readonly idleCloseTicks = 30 * 60,
  ) {
    for (const id of Object.keys(GAMES) as GameId[]) for (let i = 0; i < warmPerGame; i++) this.open(id);
  }

  get all(): AnyRoom[] {
    return [...this.slots.values()].map((s) => s.room);
  }

  get(roomId: string): AnyRoom | undefined {
    return this.slots.get(roomId)?.room;
  }

  /** Fullest room with space for one more human; opens a new one if needed. */
  pick(game: GameId): AnyRoom {
    let best: Slot | null = null;
    for (const s of this.slots.values()) {
      if (s.game !== game || !s.room.hasSpaceForHuman()) continue;
      if (!best || s.room.humanCount > best.room.humanCount) best = s;
    }
    return (best ?? this.open(game)).room;
  }

  private open(game: GameId): Slot {
    const module = GAMES[game];
    if (!module) throw new Error(`unknown game ${game}`);
    const id = `${game}-${++this.seq}`;
    const room = new Room(module, { id, seed: (Date.now() ^ (this.seq * 0x9e3779b1)) >>> 0, ledger: this.ledger });
    const slot: Slot = { room, game, idleSince: null, pending: [] };
    this.slots.set(id, slot);
    return slot;
  }

  /** Advance every room one tick, collect events, retire long-idle extra rooms. */
  step(): void {
    this.tick++;
    const warm = new Map<GameId, number>();
    for (const [id, s] of this.slots) {
      s.room.step();
      if (s.room.lastEvents.length) s.pending.push(...s.room.lastEvents);
      if (s.room.isIdle) {
        s.idleSince ??= this.tick;
        const kept = warm.get(s.game) ?? 0;
        if (kept < this.warmPerGame) warm.set(s.game, kept + 1);
        else if (this.tick - s.idleSince > this.idleCloseTicks) {
          s.room.close();
          this.slots.delete(id);
        }
      } else s.idleSince = null;
    }
  }

  /** Events since the last call, per room (consumed). */
  takeEvents(roomId: string): GameEvent[] {
    const s = this.slots.get(roomId);
    if (!s) return [];
    const ev = s.pending;
    s.pending = [];
    return ev;
  }

  stats() {
    let humans = 0;
    let bots = 0;
    const games: Partial<Record<GameId, number>> = {};
    for (const s of this.slots.values()) {
      humans += s.room.humanCount;
      bots += s.room.botCount;
      games[s.game] = (games[s.game] ?? 0) + s.room.humanCount;
    }
    return { rooms: this.slots.size, humans, bots, games };
  }
}
