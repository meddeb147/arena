import React from 'react';
import { C, FONT } from '../brand';

/**
 * A 3D-looking play-credit token: amber coin with an inner ring, spinning
 * around its vertical axis (`spin` in radians), with a visible edge.
 */
export const Token: React.FC<{ size: number; spin?: number; label?: string; glow?: number; style?: React.CSSProperties; tint?: string }> = ({
  size,
  spin = 0,
  label = '1',
  glow = 1,
  style,
  tint = C.amber,
}) => {
  const cos = Math.cos(spin);
  const sx = Math.max(0.06, Math.abs(cos));
  const edge = Math.sin(spin) * size * 0.09;
  const face = cos >= 0;
  const layers = 7;
  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      <div style={{ position: 'absolute', inset: -size * 0.35, borderRadius: '50%', background: `radial-gradient(circle, ${tint}66, transparent 65%)`, opacity: glow }} />
      {Array.from({ length: layers }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            transform: `translateX(${(edge * (layers - i)) / layers}px) scaleX(${sx})`,
            background: '#b8741f',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          transform: `scaleX(${sx})`,
          background: `radial-gradient(circle at 35% 30%, #fff3c4 0%, ${tint} 38%, #e08d1c 75%, #a8620f 100%)`,
          boxShadow: `inset 0 0 0 ${size * 0.045}px #ffe2a1, inset 0 0 0 ${size * 0.09}px #d98a22`,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          style={{
            width: '62%',
            height: '62%',
            borderRadius: '50%',
            border: `${size * 0.035}px solid #fff0c288`,
            display: 'grid',
            placeItems: 'center',
            fontFamily: FONT.display,
            fontSize: size * (label.length > 2 ? 0.22 : 0.36),
            color: '#7a3f05',
            textShadow: '0 2px 0 #ffe7b0',
            opacity: face ? 1 : 0.8,
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          transform: `scaleX(${sx})`,
          background: `linear-gradient(${110 + spin * 30}deg, transparent 35%, rgba(255,255,255,.55) 48%, transparent 60%)`,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
};
