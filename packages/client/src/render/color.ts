export function shade(color: number, f: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((color & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

export const hex = (s: string): number => parseInt(s.replace('#', ''), 16);

export const PALETTE = {
  bg: 0x171433,
  panel: 0x262159,
  pink: 0xff4f7b,
  mint: 0x3de0b0,
  amber: 0xffb84f,
  sky: 0x4fd2ff,
  violet: 0xb07bff,
  muted: 0x9b94c9,
  text: 0xf3efff,
};

export const PELLET_COLORS = [0xff4f7b, 0x3de0b0, 0xffb84f, 0x4fd2ff, 0xb07bff, 0xff8a4f];
