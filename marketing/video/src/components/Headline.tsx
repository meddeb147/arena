import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from '../brand';

/**
 * Kinetic headline: words punch in one after another (scale + blur + rise),
 * hold, then fade out together. Words in `accent` get the accent colour.
 */
export const Headline: React.FC<{
  text: string;
  start: number;
  end: number;
  size: number;
  accentWords?: string[];
  accent?: string;
  stagger?: number;
  align?: 'center' | 'left';
  style?: React.CSSProperties;
}> = ({ text, start, end, size, accentWords = [], accent = C.pink, stagger = 5, align = 'center', style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start || frame > end) return null;
  const words = text.split(' ');
  const out = interpolate(frame, [end - 12, end], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: `0 ${size * 0.32}px`,
        fontFamily: FONT.display,
        fontSize: size,
        lineHeight: 1.05,
        color: C.text,
        textAlign: align,
        opacity: out,
        transform: `scale(${1 + (1 - out) * 0.08})`,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: frame - start - i * stagger, fps, config: { damping: 13, stiffness: 170, mass: 0.7 } });
        const isAccent = accentWords.includes(w);
        const col = isAccent ? accent : C.text;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color: col,
              opacity: Math.min(1, s * 1.4),
              transform: `translateY(${(1 - s) * size * 0.6}px) scale(${1 + (1 - s) * 0.6})`,
              filter: `blur(${(1 - Math.min(1, s)) * 10}px)`,
              textShadow: `0 ${size * 0.06}px 0 rgba(0,0,0,.45), 0 0 ${size * 0.5}px ${isAccent ? accent : C.pink}77`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Small Nunito line under a headline. */
export const Sub: React.FC<{ text: string; start: number; end: number; size: number; color?: string; style?: React.CSSProperties }> = ({ text, start, end, size, color = C.muted, style }) => {
  const frame = useCurrentFrame();
  if (frame < start || frame > end) return null;
  const o = interpolate(frame, [start, start + 14, end - 12, end], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ fontFamily: FONT.ui, fontWeight: 900, fontSize: size, letterSpacing: size * 0.08, color, opacity: o, transform: `translateY(${(1 - o) * 14}px)`, textAlign: 'center', ...style }}>
      {text}
    </div>
  );
};
