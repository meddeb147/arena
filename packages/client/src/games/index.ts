import type { GameId } from '@arena/shared';
import type { GameRenderer } from './renderer';
import { BlobRenderer } from './blob/renderer';

/** Client renderer registry. Adding a game = add its renderer here. */
export const RENDERERS: Partial<Record<GameId, () => GameRenderer>> = {
  blob: () => new BlobRenderer(),
};
