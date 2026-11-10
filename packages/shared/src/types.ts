export type GameId = 'coil' | 'blob' | 'volt' | 'tank' | 'sumo' | 'blade' | 'bomber' | 'potato';

/** What a client is allowed to send each tick. Everything else is decided by the server. */
export interface PlayerInput {
  /** Monotonic sequence number, used for prediction reconciliation. */
  seq: number;
  /** Desired movement direction; magnitude 0..1 acts as throttle. */
  dx: number;
  dy: number;
  skill1: boolean;
  skill2: boolean;
  /** Held to cash out. */
  cashout: boolean;
}

export const EMPTY_INPUT: Readonly<PlayerInput> = Object.freeze({
  seq: 0,
  dx: 0,
  dy: 0,
  skill1: false,
  skill2: false,
  cashout: false,
});

/** Bit flags describing visual state of an entity in a snapshot. */
export const EntFlag = {
  Shield: 1 << 0,
  Dash: 1 << 1,
  Cashout: 1 << 2,
  Bot: 1 << 3,
  Jump: 1 << 4,
  Magnet: 1 << 5,
  You: 1 << 6,
  Protected: 1 << 7,
  /** mid-attack animation (punch, swing…) */
  Attack: 1 << 8,
} as const;

/**
 * Compact entity snapshot. `k` is a per-game kind code (each game's renderer
 * interprets it). Kept small because it goes on the wire in step 2.
 */
export interface EntitySnap {
  id: number;
  k: number;
  x: number;
  y: number;
  r: number;
  /** angle (optional) */
  a?: number;
  /** colour 0xRRGGBB (optional) */
  c?: number;
  /** name (players only) */
  n?: string;
  /** stake units (players only) */
  s?: number;
  /** EntFlag bitmask */
  f?: number;
  /** cash-out progress 0..1 for players; game-defined progress for other kinds (e.g. a charging hazard) */
  p?: number;
  /** health 0..1 (games with health bars) */
  h?: number;
  /** polyline points, flattened [x0, y0, x1, y1, …] (snake bodies) */
  pts?: number[];
}

export type DeathCause = 'player' | 'hazard' | 'self' | 'disconnect';

export type GameEvent =
  | { t: 'kill'; killerId: number | null; killerName: string | null; victimId: number; victimName: string; amount: number; houseCut: number; cause: DeathCause; x: number; y: number }
  | { t: 'cashout'; id: number; name: string; amount: number; x: number; y: number }
  | { t: 'skill'; id: number; slot: 0 | 1; x: number; y: number }
  | { t: 'spawn'; id: number; name: string; x: number; y: number }
  /** game-specific visual/sound cue (hit spark, lightning bolt…); never affects state */
  | { t: 'fx'; kind: string; x: number; y: number; id?: number; v?: number };

export interface LeaderboardRow {
  id: number;
  name: string;
  stake: number;
  bot: boolean;
}

export interface SelfState {
  /** null when not currently alive */
  entityId: number | null;
  state: 'lobby' | 'alive' | 'dead' | 'cashed';
  wallet: number;
  stake: number;
  kills: number;
  /** remaining cooldown ticks per skill slot */
  cooldowns: [number, number];
  /** total cooldown ticks per skill slot (for rings) */
  cooldownMax: [number, number];
  /** cash-out hold progress 0..1 */
  cashout: number;
  /** earliest tick at which a respawn is accepted */
  respawnAt: number;
}

export interface Snapshot {
  tick: number;
  game: GameId;
  world: { w: number; h: number };
  ents: EntitySnap[];
  lb: LeaderboardRow[];
  events: GameEvent[];
  you: SelfState;
  /** room population */
  pop: { humans: number; bots: number };
}
