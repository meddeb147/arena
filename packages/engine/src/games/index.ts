import type { GameId } from '@arena/shared';
import type { GameModule } from '../types';
import { blobGame } from './blob';

/**
 * Game registry. Adding a game = implement GameModule in ./<id>/ and add it here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: Partial<Record<GameId, GameModule<any, any, any>>> = {
  blob: blobGame,
};

export { blobGame };
export * as blob from './blob';
export type { BlobCell, BlobState, BlobBrain } from './blob';
export { BlobKind, BLOB_CONFIG } from './blob';
