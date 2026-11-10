import React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Burst } from '../components/Burst';
import { Headline } from '../components/Headline';
import { Logo } from '../components/Logo';
import { C } from '../brand';
import { useU } from './useU';

/** 0-5 s: darkness, sparks converge, neon explosion, the logo slams in. */
export const S1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useU();
  const HIT = 20;
  const s = spring({ frame: frame - HIT, fps, config: { damping: 11, stiffness: 120, mass: 0.9 } });
  const shake = frame > HIT ? Math.max(0, 1 - (frame - HIT) / 40) * 18 * u : 0;
  const sx = (random(`sx${frame}`) - 0.5) * shake;
  const sy = (random(`sy${frame}`) - 0.5) * shake;
  const zoom = interpolate(frame, [HIT, 300], [1, 1.1]);
  const exit = interpolate(frame, [282, 300], [1, 6], { extrapolateLeft: 'clamp' });
  const bgOn = interpolate(frame, [HIT, HIT + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#05030f' }}>
      <AbsoluteFill style={{ opacity: bgOn }}>
        <Background accent={C.pink} intensity={1} />
      </AbsoluteFill>
      {/* sparks converging before the hit */}
      {frame < HIT + 2 &&
        Array.from({ length: 40 }, (_, i) => {
          const a = random(`ca${i}`) * Math.PI * 2;
          const d = interpolate(frame, [0, HIT], [700 * u * (0.5 + random(`cd${i}`)), 0]);
          const col = [C.pink, C.sky, C.amber, C.violet][i % 4];
          return <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 8 * u, height: 8 * u, borderRadius: '50%', background: col, boxShadow: `0 0 ${20 * u}px ${col}`, transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)` }} />;
        })}
      <Burst f={frame - HIT} scale={1.2 * u} seed="hook" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translate(${sx}px, ${sy}px) scale(${zoom * exit})`, opacity: interpolate(frame, [292, 300], [1, 0], { extrapolateLeft: 'clamp' }) }}>
        <div style={{ transform: `scale(${interpolate(s, [0, 1], [2.8, 1])})`, opacity: Math.min(1, s * 2), marginTop: vertical ? -260 * u : -80 * u }}>
          <Logo size={(vertical ? 118 : 150) * u} sweep={interpolate(frame, [70, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} glow={1.2} />
        </div>
        <div style={{ position: 'absolute', top: vertical ? '52%' : '62%', width: '90%' }}>
          <Headline text="EVERY KILL CHANGES EVERYTHING." start={95} end={300} size={(vertical ? 84 : 76) * u} accentWords={['EVERYTHING.']} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
