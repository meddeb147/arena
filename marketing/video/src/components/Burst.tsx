import React from 'react';
import { AbsoluteFill, interpolate, random } from 'remotion';
import { C } from '../brand';

/** Neon energy explosion: white flash, expanding rings and radiating shards. `f` = frames since the hit. */
export const Burst: React.FC<{ f: number; x?: string; y?: string; scale?: number; colors?: string[]; seed?: string }> = ({
  f,
  x = '50%',
  y = '50%',
  scale = 1,
  colors = [C.pink, C.amber, C.sky, C.violet],
  seed = 'b',
}) => {
  if (f < 0 || f > 90) return null;
  const flash = interpolate(f, [0, 3, 22], [0, 1, 0], { extrapolateRight: 'clamp' });
  const shards = 28;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,${flash}) 0%, ${C.pink}${Math.round(flash * 120).toString(16).padStart(2, '0')} 25%, transparent 60%)` }} />
      <svg style={{ position: 'absolute', left: x, top: y, overflow: 'visible' }} width={1} height={1}>
        {[0, 6, 12].map((d, i) => {
          const k = Math.max(0, f - d);
          const r = interpolate(k, [0, 40], [20, 900 * scale], { extrapolateRight: 'clamp', easing: (v) => 1 - (1 - v) ** 3 });
          const o = interpolate(k, [0, 4, 40], [0, 1, 0], { extrapolateRight: 'clamp' });
          return <circle key={i} r={r} fill="none" stroke={colors[i % colors.length]} strokeWidth={14 * scale * (1 - k / 45)} opacity={o} />;
        })}
        {Array.from({ length: shards }, (_, i) => {
          const a = (i / shards) * Math.PI * 2 + random(`${seed}a${i}`) * 0.3;
          const sp = 0.6 + random(`${seed}s${i}`) * 0.8;
          const d0 = interpolate(f, [0, 50], [40, 1100 * sp * scale], { extrapolateRight: 'clamp', easing: (v) => 1 - (1 - v) ** 2 });
          const len = 120 * sp * scale * (1 - f / 60);
          const o = interpolate(f, [0, 2, 55], [0, 1, 0], { extrapolateRight: 'clamp' });
          return (
            <line
              key={i}
              x1={Math.cos(a) * d0}
              y1={Math.sin(a) * d0}
              x2={Math.cos(a) * (d0 + Math.max(0, len))}
              y2={Math.sin(a) * (d0 + Math.max(0, len))}
              stroke={colors[i % colors.length]}
              strokeWidth={6 * scale}
              strokeLinecap="round"
              opacity={o}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
