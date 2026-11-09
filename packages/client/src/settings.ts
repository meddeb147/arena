/** User preferences (persisted per device). Full settings screen arrives in step 5. */
export const settings = {
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  muted: false,
};
