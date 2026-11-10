import React from 'react';
import { C, FONT } from '../brand';

/**
 * The official Stake Arena wordmark exactly as the site draws it: Bungee,
 * pink-to-amber gradient, hard drop shadow. `sweep` (0..1) moves a light streak across it.
 */
export const Logo: React.FC<{ size: number; sweep?: number; glow?: number; style?: React.CSSProperties }> = ({ size, sweep = -1, glow = 1, style }) => {
  const text = 'STAKE ARENA';
  const base: React.CSSProperties = {
    fontFamily: FONT.display,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: size * 0.01,
    whiteSpace: 'nowrap',
  };
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div
        style={{
          ...base,
          background: `linear-gradient(90deg, ${C.pink}, ${C.amber})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: `drop-shadow(0 ${size * 0.08}px 0 rgba(0,0,0,.4)) drop-shadow(0 0 ${size * 0.35 * glow}px ${C.pink}88)`,
        }}
      >
        {text}
      </div>
      {sweep >= 0 && sweep <= 1 && (
        <div
          aria-hidden
          style={{
            ...base,
            position: 'absolute',
            inset: 0,
            color: '#fff',
            mixBlendMode: 'screen',
            maskImage: `linear-gradient(105deg, transparent ${sweep * 140 - 30}%, black ${sweep * 140 - 15}%, transparent ${sweep * 140}%)`,
            WebkitMaskImage: `linear-gradient(105deg, transparent ${sweep * 140 - 30}%, black ${sweep * 140 - 15}%, transparent ${sweep * 140}%)`,
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};
