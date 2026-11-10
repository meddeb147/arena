/** Stake Arena brand tokens (same values as packages/client/src/styles/tokens.css). */
export const C = {
  bg: '#171433',
  panel: '#262159',
  panel2: '#312a6e',
  pink: '#ff4f7b',
  mint: '#3de0b0',
  amber: '#ffb84f',
  sky: '#4fd2ff',
  violet: '#b07bff',
  muted: '#9b94c9',
  text: '#f3efff',
  voltPink: '#ff3d8b',
  voltMagenta: '#e14fff',
} as const;

export const FONT = {
  display: "'Bungee', Impact, sans-serif",
  ui: "'Nunito', system-ui, sans-serif",
} as const;

export const URL_TEXT = 'meddeb147.github.io/arena';

export const DISCLAIMER_SHORT = 'Play credits only. No real money.';
export const DISCLAIMER_FULL =
  'PLAY CREDITS ONLY. NO REAL MONEY. No real-money payouts per kill; credits cannot be exchanged for cash. Weekly skill prizes (coming soon) are funded separately by Stake Arena, never from player credits, and awarded on skill rankings. 18+ for prize-eligible features.';

export const GAMES = [
  { id: 'volt', name: 'Volt Brawl', accent: '#e14fff', live: true },
  { id: 'blob', name: 'Blob Stake', accent: '#ff4f7b', live: true },
  { id: 'coil', name: 'Coil Stake', accent: '#3de0b0', live: false },
  { id: 'tank', name: 'Tank Duel', accent: '#ffb84f', live: false },
  { id: 'sumo', name: 'Sumo Smash', accent: '#4fd2ff', live: false },
  { id: 'blade', name: 'Blade Spin', accent: '#b07bff', live: false },
  { id: 'bomber', name: 'Bomber Blast', accent: '#ff8a4f', live: false },
  { id: 'potato', name: 'Hot Potato', accent: '#ffd84f', live: false },
] as const;
