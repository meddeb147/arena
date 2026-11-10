import type { GameId } from '@arena/shared';
import type { GameModule } from '../types';
import { blobGame } from './blob';
import { voltGame } from './volt';
import { coilGame } from './coil';
import { sumoGame } from './sumo';
import { tankGame } from './tank';
import { bladeGame } from './blade';
import { bomberGame } from './bomber';
import { potatoGame } from './potato';

/**
 * Game registry. Adding a game = implement GameModule in ./<id>/ and add it here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: Partial<Record<GameId, GameModule<any, any, any>>> = {
  blob: blobGame,
  volt: voltGame,
  coil: coilGame,
  sumo: sumoGame,
  tank: tankGame,
  blade: bladeGame,
  bomber: bomberGame,
  potato: potatoGame,
};

export { blobGame, voltGame, coilGame, sumoGame, tankGame, bladeGame, bomberGame, potatoGame };
export * as blob from './blob';
export * as volt from './volt';
export type { BlobCell, BlobState, BlobBrain } from './blob';
export { BlobKind, BLOB_CONFIG } from './blob';
export type { VoltFighter, VoltState, VoltBrain } from './volt';
export { VoltKind, VOLT_CONFIG, VOLT, APOTHEM, ARENA_CX, ARENA_CY } from './volt';
export type { Snake, CoilState, CoilBrain } from './coil';
export { CoilKind, COIL_CONFIG, COIL } from './coil';
export type { Wrestler, SumoState, SumoBrain } from './sumo';
export { SumoKind, SUMO_CONFIG, SUMO, SUMO_CX, SUMO_CY, platformAt } from './sumo';
export type { Tank, TankState } from './tank';
export { TankKind, TANK_CONFIG, TANK, tankDamage } from './tank';
export type { Spinner, BladeState } from './blade';
export { BladeKind, BLADE_CONFIG, BLADE, bladeLength, blades } from './blade';
export type { Bomber, BomberState } from './bomber';
export { BomberKind, BOMBER_CONFIG, BOMBER } from './bomber';
export type { Runner, PotatoState } from './potato';
export { PotatoKind, POTATO_CONFIG, POTATO, holding } from './potato';
