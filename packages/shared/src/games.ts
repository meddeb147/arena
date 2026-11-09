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
  { id: 'coil', name: 'Coil Stake', tagline: 'Grow long. Cut them off.', accent: '#3de0b0', bg: '#10302f', skills: [{ key: 'jump', name: 'Jump' }, { key: 'magnet', name: 'Magnet' }], hazards: ['Spike traps'], available: false },
  { id: 'blob', name: 'Blob Stake', tagline: 'Eat or be eaten.', accent: '#ff4f7b', bg: '#2a1440', skills: [{ key: 'dash', name: 'Dash' }, { key: 'shield', name: 'Shield' }], hazards: ['Spike traps'], available: true },
  { id: 'tank', name: 'Tank Duel', tagline: 'Auto-fire. Out-steer.', accent: '#ffb84f', bg: '#2b2216', skills: [{ key: 'dash', name: 'Dash' }, { key: 'shield', name: 'Shield' }], hazards: ['Mines'], available: false },
  { id: 'sumo', name: 'Sumo Smash', tagline: 'Last one on the mat.', accent: '#4fd2ff', bg: '#132a40', skills: [{ key: 'dash', name: 'Ram' }, { key: 'shield', name: 'Heavy' }], hazards: ['Shrinking edge'], available: false },
  { id: 'blade', name: 'Blade Spin', tagline: 'Longer blades, bigger stakes.', accent: '#b07bff', bg: '#24173f', skills: [{ key: 'dash', name: 'Dash' }, { key: 'shield', name: 'Shield' }], hazards: ['Lava'], available: false },
  { id: 'bomber', name: 'Bomber Blast', tagline: 'Drop it and run.', accent: '#ff8a4f', bg: '#2e1a1a', skills: [{ key: 'bomb', name: 'Bomb' }, { key: 'shield', name: 'Shield' }], hazards: ['Blasts'], available: false },
  { id: 'potato', name: 'Hot Potato', tagline: 'Pass it before it pops.', accent: '#ffd84f', bg: '#2d2614', skills: [{ key: 'dash', name: 'Dash' }, { key: 'shield', name: 'Shield' }], hazards: ['Exploding potatoes'], available: false },
];
