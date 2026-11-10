import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Headline, Sub } from '../components/Headline';
import { C, FONT } from '../brand';
import { useU } from './useU';

/** The in-game "Top stakes" board, with the player climbing as their stake grows. */
const ROWS = [
  { name: 'ByteBrawler', stake: 4.2 },
  { name: 'NomNomNinja', stake: 3.6 },
  { name: 'VoltVixen', stake: 3.1 },
  { name: 'Kiwi', stake: 2.4 },
];

/**
 * 41-50 s: climb the board, then the weekly prize programme, shown honestly
 * as "coming soon" (it is not live yet; prizes are funded separately, 18+).
 */
export const S6Compete: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useU();
  const me = interpolate(frame, [40, 230], [1.0, 5.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const meRounded = Math.round(me * 5) / 5;
  const rows = [...ROWS, { name: 'NeonAce', stake: meRounded, me: true }].sort((a, b) => b.stake - a.stake);
  const boardIn = spring({ frame: frame - 6, fps, config: { damping: 15 } });
  const prizeIn = spring({ frame: frame - 260, fps, config: { damping: 13 } });
  const rowH = 74 * u;
  const W = (vertical ? 860 : 700) * u;
  const top = rows.findIndex((r) => 'me' in r) === 0;
  return (
    <AbsoluteFill>
      <Background accent={C.amber} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: (vertical ? 200 : 50) * u }}>
        <Headline text="CLIMB THE LEADERBOARD." start={4} end={540} size={(vertical ? 82 : 80) * u} accentWords={['LEADERBOARD.']} accent={C.amber} />
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: vertical ? '50%' : '27%',
          top: vertical ? '30%' : '25%',
          width: W,
          transform: `translateX(-50%) scale(${boardIn})`,
          background: 'rgba(23,20,51,.86)',
          border: '1px solid #ffffff1c',
          borderRadius: 26 * u,
          padding: `${22 * u}px ${28 * u}px`,
          boxShadow: `0 20px 60px rgba(5,3,20,.6), 0 0 ${top ? 80 : 0}px ${C.amber}55`,
        }}
      >
        <div style={{ fontFamily: FONT.display, fontSize: 34 * u, color: C.pink, marginBottom: 14 * u }}>TOP STAKES</div>
        <div style={{ position: 'relative', height: rowH * rows.length }}>
          {rows.map((r, i) => {
            const isMe = 'me' in r;
            return (
              <div
                key={r.name}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: i * rowH,
                  height: rowH - 10 * u,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18 * u,
                  padding: `0 ${16 * u}px`,
                  borderRadius: 14 * u,
                  background: isMe ? `${C.mint}22` : 'transparent',
                  border: isMe ? `2px solid ${C.mint}` : '2px solid transparent',
                  fontFamily: FONT.ui,
                  fontWeight: 900,
                  fontSize: 34 * u,
                  color: isMe ? C.mint : C.text,
                  transition: 'none',
                }}
              >
                <span style={{ width: 50 * u, color: i === 0 ? C.amber : C.muted }}>{i + 1}.</span>
                <span style={{ flex: 1 }}>{r.name}</span>
                <span style={{ color: C.amber, fontVariantNumeric: 'tabular-nums' }}>{r.stake.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* weekly prizes: coming soon */}
      <div
        style={{
          position: 'absolute',
          left: vertical ? '50%' : '74%',
          top: vertical ? '64%' : '28%',
          width: (vertical ? 860 : 560) * u,
          transform: `translateX(-50%) translateY(${(1 - prizeIn) * 80 * u}px)`,
          opacity: prizeIn,
          borderRadius: 26 * u,
          padding: `${30 * u}px ${32 * u}px`,
          background: `linear-gradient(160deg, ${C.panel2}, ${C.panel})`,
          border: `2px solid ${C.violet}`,
          boxShadow: `0 0 70px ${C.violet}55`,
          textAlign: 'center',
        }}
      >
        <svg width={120 * u} height={120 * u} viewBox="0 0 64 64" style={{ filter: `drop-shadow(0 0 ${16 * u}px ${C.amber})` }}>
          <path d="M18 8h28v10c0 9-6 16-14 16S18 27 18 18z" fill={C.amber} />
          <path d="M18 12H8c0 9 5 13 11 13M46 12h10c0 9-5 13-11 13" fill="none" stroke={C.amber} strokeWidth="4" />
          <rect x="28" y="34" width="8" height="10" fill="#e08d1c" />
          <rect x="18" y="44" width="28" height="8" rx="2" fill={C.amber} />
        </svg>
        <div style={{ fontFamily: FONT.display, fontSize: 40 * u, color: C.text, marginTop: 10 * u }}>WEEKLY SKILL PRIZES</div>
        <div style={{ display: 'inline-block', marginTop: 14 * u, fontFamily: FONT.display, fontSize: 30 * u, color: '#1b1240', background: C.violet, borderRadius: 999, padding: `${6 * u}px ${22 * u}px`, transform: `rotate(-3deg) scale(${spring({ frame: frame - 300, fps, config: { damping: 8 } })})` }}>COMING SOON</div>
        <div style={{ fontFamily: FONT.ui, fontWeight: 800, fontSize: 22 * u, color: C.muted, marginTop: 16 * u, lineHeight: 1.4 }}>
          Funded separately by Stake Arena, never from player credits. Ranked by skill. 18+.
        </div>
      </div>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: (vertical ? 120 : 60) * u }}>
        <Sub text="COMPETE FOR WEEKLY SKILL-BASED PRIZES · COMING SOON" start={300} end={540} size={30 * u} color={C.text} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
