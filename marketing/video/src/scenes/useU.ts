import { useVideoConfig } from 'remotion';

/** Layout unit: 1 = one pixel of a 1080p frame, in either orientation. */
export function useU() {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return { u: Math.min(width, height) / 1080, vertical, width, height };
}
