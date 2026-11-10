/** Simulation */
export const TICK_RATE = 30;
export const TICK_MS = 1000 / TICK_RATE;
export const DT = 1 / TICK_RATE;

/** Rooms */
export const MAX_PLAYERS_PER_ROOM = 20;
/** Bots fill a room up to this many total occupants so there is always action. */
export const DEFAULT_TARGET_POPULATION = 16;

/**
 * Economy. All amounts are integer "units"; 1 PLAY CREDIT = 100 units.
 * Never use floats for credits.
 */
export const CREDIT = 100;
export const SPAWN_STAKE = 1 * CREDIT;
/** Killer receives this percentage of the victim's stake, the rest goes to the house pot. */
export const KILLER_SHARE_PCT = 80;

/** Cash-out: hold for 3 seconds. The player is vulnerable while holding. */
export const CASHOUT_HOLD_TICKS = 3 * TICK_RATE;
/** A disconnected player's entity starts an automatic cash-out and is vulnerable meanwhile. */
export const DISCONNECT_AUTO_CASHOUT = true;
/** Minimum time between death and respawn (product rule: respawn in under 3 s). */
/** New spawns cannot be eliminated (and cannot eliminate) for this long; ends early on skill use or cash-out. */
export const SPAWN_PROTECTION_TICKS = Math.round(2.5 * TICK_RATE);
export const RESPAWN_MIN_TICKS = Math.round(1.0 * TICK_RATE);

/** The richest player in a room (at least this stake) is crowned King. */
export const KING_MIN_STAKE = 3 * CREDIT;
/** Knocking out the King pays this % of the King's stake on top, from the house pot. */
export const KING_BOUNTY_PCT = 50;

export const PLAY_CREDITS_DISCLAIMER = 'Play credits only. No real money.';
