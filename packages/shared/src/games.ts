import type { GameId } from './types';

export interface SkillMeta {
  key: string;
  name: string;
}

export interface GameCatalogEntry {
  id: GameId;
  name: string;
  tagline: string;
  accent: string;
  /** background theme base colour */
  bg: string;
  skills: [SkillMeta, SkillMeta];
  hazards: string[];
  /** true once the game module is implemented */
  available: boolean;
}

/** Metadata for the landing page and menus. Simulation config lives in each engine module. */
export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  { id: 'coil', name: 'Coil Stake', tagline: 'Grow long. Cut them off.', accent: '#3de0b0', bg: '#10302f', skills: [{ key: 'jump', name: 'Jump' }, { key: 'magnet', name: 'Magnet' }], hazards: ['Walls', 'Spike traps'], available: true },
  { id: 'blob', name: 'Blob Stake', tagline: 'Eat or be eaten.', accent: '#ff4f7b', bg: '#2a1440', skills: [{ key: 'dash', name: 'Dash' }, { key: 'shield', name: 'Shield' }], hazards: ['Spike traps'], available: true },
  { id: 'volt', name: 'Volt Brawl', tagline: 'Brawl in the neon cage.', accent: '#e14fff', bg: '#1a1240', skills: [{ key: 'dash', name: 'Volt Dash' }, { key: 'shield', name: 'Shield' }], hazards: ['Lightning strikes', 'Electric pylons'], available: true },
  { id: 'stomp', name: 'Stomp Stake', tagline: 'Jump on heads. Dodge the lava.', accent: '#7bff8a', bg: '#132b1c', skills: [{ key: 'jump', name: 'Jump' }, { key: 'pound', name: 'Ground Pound' }], hazards: ['Lava floor', 'Spikes'], available: true },
  { id: 'bomber', name: 'Bomber Blast', tagline: 'Drop it and run.', accent: '#ff8a4f', bg: '#2e1a1a', skills: [{ key: 'bomb', name: 'Bomb' }, { key: 'shield', name: 'Shield' }], hazards: ['Blasts', 'Sky bombs'], available: true },
  { id: 'potato', name: 'Hot Potato', tagline: 'Pass it before it pops.', accent: '#ffd84f', bg: '#2d2614', skills: [{ key: 'dash', name: 'Dash' }, { key: 'shield', name: 'Shield' }], hazards: ['Exploding potatoes'], available: true },
];
