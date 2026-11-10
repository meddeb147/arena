/** User preferences, persisted per device (storage may be unavailable: always fall back). */
export const settings = {
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  muted: false,
  volume: 0.8,
};

try {
  const raw = localStorage.getItem('settings');
  if (raw) {
    const s = JSON.parse(raw) as Partial<typeof settings>;
    if (typeof s.muted === 'boolean') settings.muted = s.muted;
    if (typeof s.volume === 'number') settings.volume = Math.max(0, Math.min(1, s.volume));
    if (typeof s.reducedMotion === 'boolean') settings.reducedMotion = s.reducedMotion;
  }
} catch {
  /* ignore */
}

export function saveSettings(): void {
  try {
    localStorage.setItem('settings', JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
