import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Burst } from '../components/Burst';
import { Headline } from '../components/Headline';
import { Logo } from '../components/Logo';
import { C, DISCLAIMER_FULL, FONT, GAMES, URL_TEXT } from '../brand';
import { useU } from './useU';

/** 50-60 s: explosion, logo, the games orbiting it, the call to action and the full disclaimer. */
export const S7Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical, height } = useU();
  const logo = spring({ frame: frame - 6, fps, config: { damping: 11, stiffness: 110 } });
  const orbitIn = spring({ frame: frame - 24, fps, config: { damping: 16 } });
  const cta = spring({ frame: frame - 280, fps, config: { damping: 10 } });
  const disc = interpolate(frame, [300, 330], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rx = (vertical ? 430 : 720) * u * orbitIn;
  const ry = (vertical ? 260 : 150) * u * orbitIn;
  const lift = interpolate(frame, [260, 300], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cy = (vertical ? 0.3 : 0.38) - lift * 0.05;
  return (
    <AbsoluteFill>
      <Background accent={C.pink} intensity={1.2} />
      <Burst f={frame} scale={1.4 * u} seed="final" />
      {/* orbiting games: front ones larger and brighter */}
      {GAMES.map((g, i) => {
        const a = (i / GAMES.length) * Math.PI * 2 + frame * 0.012;
        const depth = (Math.sin(a) + 1) / 2;
        const size = (90 + 60 * depth) * u;
        return (
          <div
            key={g.id}
            style={{
              position: 'absolute',
              left: `calc(50% + ${Math.cos(a) * rx}px - ${size / 2}px)`,
              top: `calc(${cy * 100}% + ${Math.sin(a) * ry}px - ${size / 2}px)`,
              width: size,
              height: size,
              borderRadius: '50%',
              overflow: 'hidden',
              border: `${3 * u}px solid ${g.accent}`,
              boxShadow: `0 0 ${30 * u}px ${g.accent}`,
              opacity: (0.45 + 0.55 * depth) * orbitIn,
              zIndex: depth > 0.5 ? 3 : 1,
            }}
          >
            <Img src={staticFile(`cards/${g.id}-art.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: '50%', top: `${cy * 100}%`, transform: `translate(-50%, -50%) scale(${interpolate(logo, [0, 1], [3, 1])})`, opacity: Math.min(1, logo * 2), zIndex: 2 }}>
        <Logo size={(vertical ? 104 : 132) * u} sweep={interpolate(frame, [40, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} glow={1.3} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * (cy + (vertical ? 0.17 : 0.2)), display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 4 }}>
        <Headline text="PLAY. ELIMINATE. DOMINATE." start={60} end={600} size={(vertical ? 74 : 70) * u} accentWords={['DOMINATE.']} accent={C.amber} stagger={8} />
        {frame >= 280 && (
          <div style={{ marginTop: 34 * u, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 * u, transform: `scale(${cta})` }}>
            <div style={{ fontFamily: FONT.display, fontSize: 46 * u, color: '#fff', padding: `${18 * u}px ${46 * u}px`, borderRadius: 24 * u, background: `linear-gradient(180deg, #ff6b91, ${C.pink})`, boxShadow: `0 ${8 * u}px 0 #b8274f, 0 0 ${60 * u}px ${C.pink}${Math.floor(frame / 10) % 2 ? 'aa' : '66'}` }}>
              ENTER THE ARENA
            </div>
            <div style={{ fontFamily: FONT.ui, fontWeight: 900, fontSize: 40 * u, color: C.sky, letterSpacing: 1 * u, textShadow: `0 0 ${24 * u}px ${C.sky}88` }}>{URL_TEXT}</div>
          </div>
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: (vertical ? 70 : 34) * u,
          transform: 'translateX(-50%)',
          width: (vertical ? 960 : 1500) * u,
          opacity: disc,
          fontFamily: FONT.ui,
          fontWeight: 800,
          fontSize: (vertical ? 24 : 22) * u,
          lineHeight: 1.4,
          color: C.text,
          textAlign: 'center',
          background: 'rgba(15,11,36,.82)',
          border: '1px solid #ffffff22',
          borderRadius: 14 * u,
          padding: `${12 * u}px ${20 * u}px`,
          zIndex: 5,
        }}
      >
        {DISCLAIMER_FULL}
      </div>
    </AbsoluteFill>
  );
};
