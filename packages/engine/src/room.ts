import {
  CASHOUT_HOLD_TICKS,
  DEFAULT_TARGET_POPULATION,
  DT,
  EMPTY_INPUT,
  EntFlag,
  MAX_PLAYERS_PER_ROOM,
  RESPAWN_MIN_TICKS,
  Rng,
  SPAWN_PROTECTION_TICKS,
  SPAWN_STAKE,
  splitKill,
  type DeathCause,
  type GameEvent,
  type LeaderboardRow,
  type PlayerInput,
  type Snapshot,
} from '@arena/shared';
import { HOUSE, MemoryLedger, stakeAcc, walletAcc, type Ledger } from './ledger';
import { BOT_NAMES, PLAYER_COLORS } from './names';
import { sanitizeInput } from './input';
import type { BaseEntity, BotPersona, GameModule, Sim } from './types';

export interface RoomOptions {
  id?: string;
  seed?: number;
  ledger?: Ledger;
  maxPlayers?: number;
  /** humans + bots the room tries to keep; bots fill the gap */
  targetPopulation?: number;
  /** delay before a dead bot respawns */
  botRespawnTicks?: number;
}

type SlotState = 'lobby' | 'alive' | 'dead' | 'cashed';

interface HumanSlot {
  playerId: string;
  name: string;
  color: number;
  entityId: number | null;
  state: SlotState;
  input: PlayerInput;
  deathTick: number;
  kills: number;
  camX: number;
  camY: number;
}

interface BotSlot<B> {
  botId: string;
  name: string;
  color: number;
  persona: BotPersona;
  entityId: number | null;
  brain: B | null;
  respawnAt: number;
}

export type SpawnResult = { ok: true; entityId: number } | { ok: false; reason: 'unknown' | 'alive' | 'cooldown' | 'funds' };

/**
 * One arena instance. Owns players, bots, the economy and the generic rules
 * (skills/cooldowns, cash-out, respawn). Delegates the game itself to a GameModule.
 */
export class Room<E extends BaseEntity = BaseEntity, S = unknown, B = unknown> implements Sim<E, S> {
  readonly roomId: string;
  readonly dt = DT;
  readonly rng: Rng;
  readonly state: S;
  readonly ledger: Ledger;
  readonly maxPlayers: number;
  targetPopulation: number;
  private readonly botRespawnTicks: number;

  tick = 0;
  private idSeq = 0;
  private readonly ents = new Map<number, E>();
  private readonly humans = new Map<string, HumanSlot>();
  private readonly bots = new Map<string, BotSlot<B>>();
  /** entities of players who disconnected while alive; they auto-cash-out */
  private readonly orphans = new Set<number>();
  private events: GameEvent[] = [];
  private lbCache: { tick: number; rows: LeaderboardRow[] } = { tick: -1, rows: [] };
  private botSeq = 0;

  constructor(readonly game: GameModule<E, S, B>, opts: RoomOptions = {}) {
    this.roomId = opts.id ?? 'r1';
    this.rng = new Rng(opts.seed ?? 1);
    this.ledger = opts.ledger ?? new MemoryLedger();
    this.maxPlayers = opts.maxPlayers ?? MAX_PLAYERS_PER_ROOM;
    this.targetPopulation = Math.min(this.maxPlayers, opts.targetPopulation ?? DEFAULT_TARGET_POPULATION);
    this.botRespawnTicks = opts.botRespawnTicks ?? 45;
    this.state = game.createState({ rng: this.rng, newId: () => this.newId(), config: game.config });
    this.balanceBots();
  }

  // ---- Sim interface -------------------------------------------------------

  get entities(): ReadonlyMap<number, E> {
    return this.ents;
  }
  get config() {
    return this.game.config;
  }
  newId(): number {
    return ++this.idSeq;
  }
  stakeOf(e: E): number {
    return this.ledger.balance(stakeAcc(this.roomId, e.id));
  }

  kill(victim: E, killer: E | null, cause: DeathCause): void {
    if (!victim.alive) return;
    victim.alive = false;
    const acc = stakeAcc(this.roomId, victim.id);
    const stake = this.ledger.balance(acc);
    const validKiller = killer && killer.alive && killer !== victim ? killer : null;
    let amount = 0;
    let houseCut = 0;
    if (stake > 0) {
      if (validKiller) {
        const split = splitKill(stake);
        amount = split.killer;
        houseCut = split.house;
        if (amount > 0) this.ledger.transfer(acc, stakeAcc(this.roomId, validKiller.id), amount, 'kill_reward', this.tick, String(victim.id));
        if (houseCut > 0) this.ledger.transfer(acc, HOUSE, houseCut, 'house_cut', this.tick, String(victim.id));
      } else {
        houseCut = stake;
        this.ledger.transfer(acc, HOUSE, stake, 'hazard_loss', this.tick, String(victim.id));
      }
    }
    if (validKiller) {
      validKiller.kills++;
      const ks = this.humanByEntity(validKiller.id);
      if (ks) ks.kills++;
    }
    this.events.push({
      t: 'kill',
      killerId: validKiller?.id ?? null,
      killerName: validKiller?.name ?? null,
      victimId: victim.id,
      victimName: victim.name,
      amount,
      houseCut,
      cause: validKiller ? 'player' : cause === 'player' ? 'hazard' : cause,
      x: victim.x,
      y: victim.y,
    });
    this.game.onDeath?.(this, victim, cause);
    const hs = this.humanByEntity(victim.id);
    if (hs) {
      hs.state = 'dead';
      hs.deathTick = this.tick;
    }
  }

  // ---- Players -------------------------------------------------------------

  get humanCount(): number {
    return this.humans.size;
  }
  get botCount(): number {
    return this.bots.size;
  }
  hasSpaceForHuman(): boolean {
    return this.humans.size < this.maxPlayers;
  }

  addPlayer(playerId: string, name: string): void {
    if (this.humans.has(playerId)) return;
    if (!this.hasSpaceForHuman()) throw new Error('room full');
    this.humans.set(playerId, {
      playerId,
      name: name.slice(0, 16) || 'Player',
      color: PLAYER_COLORS[this.humans.size % PLAYER_COLORS.length]!,
      entityId: null,
      state: 'lobby',
      input: { ...EMPTY_INPUT },
      deathTick: -Infinity,
      kills: 0,
      camX: this.config.width / 2,
      camY: this.config.height / 2,
    });
    this.balanceBots();
  }

  /** Spend SPAWN_STAKE from the player's wallet and enter the arena. */
  spawn(playerId: string): SpawnResult {
    const h = this.humans.get(playerId);
    if (!h) return { ok: false, reason: 'unknown' };
    if (h.state === 'alive') return { ok: false, reason: 'alive' };
    if (this.tick - h.deathTick < RESPAWN_MIN_TICKS) return { ok: false, reason: 'cooldown' };
    if (this.ledger.balance(walletAcc(playerId)) < SPAWN_STAKE) return { ok: false, reason: 'funds' };
    const e = this.createEntity(playerId, false, h.name, h.color);
    this.ledger.transfer(walletAcc(playerId), stakeAcc(this.roomId, e.id), SPAWN_STAKE, 'spawn_stake', this.tick);
    h.entityId = e.id;
    h.state = 'alive';
    h.input = { ...EMPTY_INPUT };
    return { ok: true, entityId: e.id };
  }

  setInput(playerId: string, raw: unknown): void {
    const h = this.humans.get(playerId);
    if (!h) return;
    h.input = sanitizeInput(raw, h.input.seq);
  }

  /** Disconnect. A live entity stays in the world and auto-cashes-out (vulnerable). */
  removePlayer(playerId: string): void {
    const h = this.humans.get(playerId);
    if (!h) return;
    if (h.state === 'alive' && h.entityId !== null) {
      const e = this.ents.get(h.entityId);
      if (e?.alive) this.orphans.add(e.id);
    }
    this.humans.delete(playerId);
    this.balanceBots();
  }

  // ---- Simulation ----------------------------------------------------------

  step(): void {
    this.tick++;
    this.events = [];

    // 1. inputs
    for (const h of this.humans.values()) {
      if (h.entityId === null) continue;
      const e = this.ents.get(h.entityId);
      if (e?.alive) e.input = h.input;
    }
    for (const id of this.orphans) {
      const e = this.ents.get(id);
      if (e?.alive) e.input = { ...EMPTY_INPUT, cashout: true };
    }
    for (const b of this.bots.values()) {
      if (b.entityId === null || b.brain === null) continue;
      const e = this.ents.get(b.entityId);
      if (e?.alive) e.input = this.game.botInput(this, e, b.brain, b.persona);
    }

    // 2. generic rules: skills, cooldowns, cash-out
    const cashouts: E[] = [];
    for (const e of this.ents.values()) {
      if (!e.alive) continue;
      for (const s of [0, 1] as const) {
        if (e.cooldowns[s] > 0) e.cooldowns[s]--;
        if (e.effects[s] > 0) e.effects[s]--;
      }
      if (e.input.cashout) {
        if (e.cashoutTicks === 0) {
          e.effects = [0, 0];
          e.protectedUntil = 0;
          this.game.onCashoutStart?.(this, e);
        }
        e.cashoutTicks++;
        if (e.cashoutTicks >= CASHOUT_HOLD_TICKS) cashouts.push(e);
      } else {
        e.cashoutTicks = 0;
        const pressed: [boolean, boolean] = [e.input.skill1, e.input.skill2];
        for (const s of [0, 1] as const) {
          if (pressed[s] && !e.prevSkill[s] && e.cooldowns[s] === 0 && this.game.useSkill(this, e, s)) {
            const def = this.config.skills[s];
            e.cooldowns[s] = def.cooldownTicks;
            e.effects[s] = def.durationTicks;
            e.protectedUntil = 0;
            this.events.push({ t: 'skill', id: e.id, slot: s, x: e.x, y: e.y });
          }
        }
      }
      e.prevSkill = [e.input.skill1, e.input.skill2];
    }

    // 3. the game itself
    this.game.step(this);

    // 4. cash-outs that survived the tick
    for (const e of cashouts) if (e.alive) this.cashout(e);

    // 5. sweep removed entities
    for (const e of [...this.ents.values()]) {
      if (e.alive) continue;
      const left = this.ledger.balance(stakeAcc(this.roomId, e.id));
      if (left !== 0) throw new Error(`entity ${e.id} removed with stake ${left}`);
      this.game.onRemove?.(this, e);
      this.ents.delete(e.id);
      this.orphans.delete(e.id);
      const h = this.humanByEntity(e.id);
      if (h) {
        h.entityId = null;
        h.camX = e.x;
        h.camY = e.y;
      }
      for (const b of this.bots.values()) {
        if (b.entityId === e.id) {
          b.entityId = null;
          b.brain = null;
          b.respawnAt = this.tick + this.botRespawnTicks;
        }
      }
    }

    // 6. bots
    if (this.tick % 15 === 0) this.balanceBots();
    for (const b of this.bots.values()) {
      if (b.entityId === null && this.tick >= b.respawnAt) this.spawnBot(b);
    }
  }

  private cashout(e: E): void {
    const acc = stakeAcc(this.roomId, e.id);
    const stake = this.ledger.balance(acc);
    if (stake > 0) {
      if (e.isBot) this.ledger.transfer(acc, HOUSE, stake, 'bot_refund', this.tick, 'cashout');
      else this.ledger.transfer(acc, walletAcc(e.ownerId), stake, 'cashout', this.tick);
    }
    e.alive = false;
    this.events.push({ t: 'cashout', id: e.id, name: e.name, amount: stake, x: e.x, y: e.y });
    const h = this.humanByEntity(e.id);
    if (h) h.state = 'cashed';
    // a bot that cashed out leaves; a fresh one takes its seat
    for (const [id, b] of this.bots) if (b.entityId === e.id) this.bots.delete(id);
  }

  // ---- Bots ----------------------------------------------------------------

  /** Keep humans + bots at the target population, never above capacity. */
  private balanceBots(): void {
    const want = Math.max(0, Math.min(this.targetPopulation, this.maxPlayers) - this.humans.size);
    while (this.bots.size < want) this.addBot();
    while (this.bots.size > want) {
      // remove the bot with the least at stake (dead bots first)
      let worst: BotSlot<B> | null = null;
      let worstStake = Infinity;
      for (const b of this.bots.values()) {
        const e = b.entityId !== null ? this.ents.get(b.entityId) : undefined;
        const st = e ? this.stakeOf(e) : -1;
        if (st < worstStake) {
          worst = b;
          worstStake = st;
        }
      }
      if (!worst) break;
      this.removeBot(worst);
    }
  }

  private addBot(): void {
    const n = ++this.botSeq;
    const slot: BotSlot<B> = {
      botId: `bot:${this.roomId}:${n}`,
      name: BOT_NAMES[(n * 7) % BOT_NAMES.length]!,
      color: this.rng.pick(PLAYER_COLORS),
      persona: {
        skill: this.rng.range(0.25, 0.95),
        aggression: this.rng.range(0.2, 1),
        cashoutAt: this.rng.int(3, 8) * SPAWN_STAKE,
      },
      entityId: null,
      brain: null,
      respawnAt: this.tick + this.rng.int(0, 30),
    };
    this.bots.set(slot.botId, slot);
  }

  private removeBot(b: BotSlot<B>): void {
    if (b.entityId !== null) {
      const e = this.ents.get(b.entityId);
      if (e?.alive) {
        const acc = stakeAcc(this.roomId, e.id);
        const st = this.ledger.balance(acc);
        if (st > 0) this.ledger.transfer(acc, HOUSE, st, 'bot_refund', this.tick, 'despawn');
        e.alive = false; // swept next step
      }
    }
    this.bots.delete(b.botId);
  }

  private spawnBot(b: BotSlot<B>): void {
    const e = this.createEntity(b.botId, true, b.name, b.color);
    this.ledger.transfer(HOUSE, stakeAcc(this.roomId, e.id), SPAWN_STAKE, 'bot_fund', this.tick);
    b.entityId = e.id;
    b.brain = this.game.createBrain(this, e, b.persona);
  }

  private createEntity(ownerId: string, isBot: boolean, name: string, color: number): E {
    const base: BaseEntity = {
      id: this.newId(),
      ownerId,
      isBot,
      name,
      color,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 10,
      angle: 0,
      alive: true,
      input: { ...EMPTY_INPUT },
      prevSkill: [false, false],
      cooldowns: [0, 0],
      effects: [0, 0],
      cashoutTicks: 0,
      spawnTick: this.tick,
      protectedUntil: this.tick + SPAWN_PROTECTION_TICKS,
      kills: 0,
      lastHit: null,
    };
    const e = this.game.createEntity(base, this);
    this.ents.set(e.id, e);
    this.events.push({ t: 'spawn', id: e.id, name: e.name, x: e.x, y: e.y });
    return e;
  }

  private humanByEntity(id: number): HumanSlot | undefined {
    for (const h of this.humans.values()) if (h.entityId === id) return h;
    return undefined;
  }

  // ---- Views ---------------------------------------------------------------

  leaderboard(n = 5): LeaderboardRow[] {
    if (this.lbCache.tick !== this.tick) {
      const rows: LeaderboardRow[] = [];
      for (const e of this.ents.values()) {
        if (e.alive) rows.push({ id: e.id, name: e.name, stake: this.stakeOf(e), bot: e.isBot });
      }
      rows.sort((a, b) => b.stake - a.stake || a.id - b.id);
      this.lbCache = { tick: this.tick, rows };
    }
    return this.lbCache.rows.slice(0, n);
  }

  snapshotFor(playerId: string): Snapshot | null {
    const h = this.humans.get(playerId);
    if (!h) return null;
    const me = h.entityId !== null ? this.ents.get(h.entityId) ?? null : null;
    const cx = me ? me.x : h.camX;
    const cy = me ? me.y : h.camY;
    const ents = this.game.snapshot(this, me, cx, cy);
    for (const s of ents) {
      const e = this.ents.get(s.id);
      if (!e) continue;
      s.n = e.name;
      s.s = this.stakeOf(e);
      let f = s.f ?? 0;
      if (e.isBot) f |= EntFlag.Bot;
      if (e === me) f |= EntFlag.You;
      if (this.tick < e.protectedUntil) f |= EntFlag.Protected;
      if (e.cashoutTicks > 0) {
        f |= EntFlag.Cashout;
        s.p = Math.min(1, e.cashoutTicks / CASHOUT_HOLD_TICKS);
      }
      s.f = f;
    }
    const sk = this.config.skills;
    return {
      tick: this.tick,
      game: this.config.id,
      world: { w: this.config.width, h: this.config.height },
      ents,
      lb: this.leaderboard(5),
      events: this.events,
      pop: { humans: this.humans.size, bots: this.bots.size },
      you: {
        entityId: me?.id ?? null,
        state: h.state,
        wallet: this.ledger.balance(walletAcc(playerId)),
        stake: me ? this.stakeOf(me) : 0,
        kills: h.kills,
        cooldowns: me ? [me.cooldowns[0], me.cooldowns[1]] : [0, 0],
        cooldownMax: [sk[0].cooldownTicks, sk[1].cooldownTicks],
        cashout: me ? Math.min(1, me.cashoutTicks / CASHOUT_HOLD_TICKS) : 0,
        respawnAt: Number.isFinite(h.deathTick) ? h.deathTick + RESPAWN_MIN_TICKS : 0,
      },
    };
  }

  /** Events produced by the most recent `step()`. */
  get lastEvents(): readonly GameEvent[] {
    return this.events;
  }
}
