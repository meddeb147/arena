import type { DeathCause, EntitySnap, GameEvent, GameId, PlayerInput, Rng } from '@arena/shared';

/** Fields every game entity (a player's or bot's avatar) has. Games extend this. */
export interface BaseEntity {
  id: number;
  /** player id for humans, bot id for bots; owner of the stake */
  ownerId: string;
  isBot: boolean;
  name: string;
  color: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** collision radius */
  r: number;
  /** facing angle (radians) */
  angle: number;
  alive: boolean;
  input: PlayerInput;
  /** previous tick's skill buttons, for edge detection */
  prevSkill: [boolean, boolean];
  /** remaining cooldown ticks per skill slot */
  cooldowns: [number, number];
  /** remaining active-effect ticks per skill slot */
  effects: [number, number];
  /** ticks the cash-out button has been held */
  cashoutTicks: number;
  spawnTick: number;
  /** tick until which the entity is spawn-protected */
  protectedUntil: number;
  kills: number;
  /** most recent contact by another entity (used e.g. for Sumo/Potato kill credit) */
  lastHit: { by: number; tick: number } | null;
}

export interface SkillDef {
  name: string;
  cooldownTicks: number;
  /** how long the effect lasts once activated (0 = instant) */
  durationTicks: number;
}

export interface GameConfig {
  id: GameId;
  width: number;
  height: number;
  skills: [SkillDef, SkillDef];
  /** radius around the viewer included in snapshots (interest management) */
  viewRadius: number;
}

/** Bot personality, rolled once per bot. Games may read it to vary behaviour. */
export interface BotPersona {
  /** 0..1, reaction speed / skill usage accuracy */
  skill: number;
  /** stake (units) at which the bot considers cashing out */
  cashoutAt: number;
  /** 0..1 how willing to chase */
  aggression: number;
}

export const isProtected = (sim: { tick: number }, e: BaseEntity): boolean => sim.tick < e.protectedUntil;

/** What a game module sees of the room while simulating. */
export interface Sim<E extends BaseEntity, S> {
  readonly roomId: string;
  readonly tick: number;
  /** seconds per tick */
  readonly dt: number;
  readonly rng: Rng;
  readonly state: S;
  readonly entities: ReadonlyMap<number, E>;
  readonly config: GameConfig;
  newId(): number;
  /** Eliminate `victim`. Credits move according to the ledger rules. Safe to call twice. */
  kill(victim: E, killer: E | null, cause: DeathCause): void;
  /** Current stake of an entity (derived from the ledger). */
  stakeOf(e: E): number;
  /** Queue a cosmetic event for clients (sparks, bolts, sounds). */
  emit(ev: GameEvent): void;
}

export interface StateInit {
  rng: Rng;
  newId(): number;
  config: GameConfig;
}

/**
 * A game is a pure simulation module. The Room owns players, bots, the ledger,
 * skills/cooldowns, cash-out and respawn; the module owns physics, collisions,
 * hazards, which kills happen, bot steering and what a snapshot contains.
 *
 * To add a game: implement this interface in `src/games/<id>/`, register it in
 * `src/games/index.ts`, and add a renderer on the client.
 */
export interface GameModule<E extends BaseEntity = BaseEntity, S = unknown, B = unknown> {
  readonly config: GameConfig;
  createState(init: StateInit): S;
  /** Build a fresh entity from the base fields: choose a spawn position, initial size, etc. */
  createEntity(base: BaseEntity, sim: Sim<E, S>): E;
  /** Advance one tick: movement, collisions, hazards. Call `sim.kill` for eliminations. */
  step(sim: Sim<E, S>): void;
  /** Try to activate a skill. Return false to refuse (cooldown is then not consumed). */
  useSkill(sim: Sim<E, S>, e: E, slot: 0 | 1): boolean;
  /** Called when the cash-out hold starts: cancel protective effects etc. */
  onCashoutStart?(sim: Sim<E, S>, e: E): void;
  onDeath?(sim: Sim<E, S>, e: E, cause: DeathCause): void;
  /** Called after an entity leaves the world (death or cash-out). */
  onRemove?(sim: Sim<E, S>, e: E): void;
  createBrain(sim: Sim<E, S>, e: E, persona: BotPersona): B;
  botInput(sim: Sim<E, S>, e: E, brain: B, persona: BotPersona): PlayerInput;
  /** Everything visible around (cx, cy), including players. Room adds generic flags. */
  snapshot(sim: Sim<E, S>, viewer: E | null, cx: number, cy: number): EntitySnap[];
}
