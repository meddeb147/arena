import type { GameId } from '@arena/shared';
import type { Dict } from '../i18n/en';
import type { GameRenderer } from './renderer';
import { BlobRenderer } from './blob/renderer';
import { VoltRenderer } from './volt/renderer';
import { CoilRenderer } from './coil/renderer';
import { BomberRenderer } from './bomber/renderer';
import { PotatoRenderer } from './potato/renderer';
import { StompRenderer } from './stomp/renderer';

export interface ClientGame {
  make: () => GameRenderer;
  /** i18n keys for this game's death screen and kill feed */
  texts: { killedBy: keyof Dict; hazard: keyof Dict; feedKill: keyof Dict; feedHazard: keyof Dict };
}

/** Client registry. Adding a game = add its renderer and texts here. */
export const CLIENT_GAMES: Partial<Record<GameId, ClientGame>> = {
  blob: { make: () => new BlobRenderer(), texts: { killedBy: 'eatenBy', hazard: 'poppedByTrap', feedKill: 'killFeed', feedHazard: 'trapFeed' } },
  volt: { make: () => new VoltRenderer(), texts: { killedBy: 'knockedOutBy', hazard: 'friedByArena', feedKill: 'koFeed', feedHazard: 'friedFeed' } },
  coil: { make: () => new CoilRenderer(), texts: { killedBy: 'coiledBy', hazard: 'wallOrTrap', feedKill: 'coilFeed', feedHazard: 'splatFeed' } },
  bomber: { make: () => new BomberRenderer(), texts: { killedBy: 'blownUpBy', hazard: 'blewSelf', feedKill: 'bomberFeed', feedHazard: 'boomFeed' } },
  potato: { make: () => new PotatoRenderer(), texts: { killedBy: 'potatoFrom', hazard: 'potatoBoom', feedKill: 'potatoFeed', feedHazard: 'potatoSelfFeed' } },
  stomp: { make: () => new StompRenderer(), texts: { killedBy: 'stompedBy', hazard: 'stompHazard', feedKill: 'stompFeed', feedHazard: 'stompHazardFeed' } },
};
