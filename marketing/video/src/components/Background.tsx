import React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../brand';

/** Dark purple stage: drifting neon glows, a perspective grid floor and floating particles. */
export const Background: React.FC<{ accent?: string; grid?: boolean; particles?: number; intensity?: number }> = ({
  accent = C.pink,
  grid = true,
  particles = 60,
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / 60;
  const gx = 50 + Math.sin(t * 0.4) * 18;
  const gy = 30 + Math.cos(t * 0.3) * 12;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 55% at ${gx}% ${gy}%, ${accent}38, transparent 70%), radial-gradient(50% 50% at ${100 - gx}% ${100 - gy * 0.6}%, ${C.violet}30, transparent 70%), radial-gradient(40% 40% at 50% 110%, ${C.sky}22, transparent 70%)`,
          opacity: intensity,
        }}
      />
      {grid && (
        <div
          style={{
            position: 'absolute',
            left: '-50%',
            width: '200%',
            height: '70%',
            bottom: '-12%',
            transform: 'perspective(700px) rotateX(68deg)',
            transformOrigin: '50% 0%',
            backgroundImage: `linear-gradient(${accent}55 2px, transparent 2px), linear-gradient(90deg, ${accent}55 2px, transparent 2px)`,
            backgroundSize: '90px 90px',
            backgroundPosition: `0 ${(frame * 2.2) % 90}px`,
            maskImage: 'linear-gradient(to bottom, transparent, black 35%, black 70%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 35%, black 70%, transparent)',
            opacity: 0.55 * intensity,
          }}
        />
      )}
      {Array.from({ length: particles }, (_, i) => {
        const x = random(`px${i}`) * width;
        const speed = 0.4 + random(`ps${i}`) * 1.4;
        const y = (random(`py${i}`) * height * 1.2 - frame * speed) % (height * 1.2);
        const yy = y < 0 ? y + height * 1.2 : y;
        const size = 2 + random(`pz${i}`) * 4;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + i));
        const col = [C.pink, C.sky, C.violet, C.amber, C.mint][i % 5];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: yy - height * 0.1,
              width: size,
              height: size,
              borderRadius: '50%',
              background: col,
              boxShadow: `0 0 ${size * 3}px ${col}`,
              opacity: tw * 0.8 * intensity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
