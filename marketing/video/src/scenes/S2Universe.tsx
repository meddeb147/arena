import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { ClipFrame } from '../components/ClipFrame';
import { Headline, Sub } from '../components/Headline';
import { C, FONT, GAMES } from '../brand';
import { BLOB } from '../clips';
import { useU } from './useU';

const Label: React.FC<{ name: string; live: boolean; accent: string; u: number }> = ({ name, live, accent, u }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 * u, fontFamily: FONT.display, fontSize: 54 * u, color: accent, textShadow: `0 0 ${30 * u}px ${accent}88, 0 4px 0 rgba(0,0,0,.5)` }}>
    {name}
    <span style={{ fontFamily: FONT.ui, fontWeight: 900, fontSize: 24 * u, letterSpacing: 2 * u, padding: `${6 * u}px ${14 * u}px`, borderRadius: 999, color: live ? '#0f2b23' : C.text, background: live ? C.mint : '#ffffff22' }}>
      {live ? 'LIVE NOW' : 'COMING SOON'}
    </span>
  </div>
);

/** One rapid shot: whip-pan in, hold, whip out. */
const Shot: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const inX = interpolate(frame, [0, 8], [110, 0], { extrapolateRight: 'clamp', easing: (v) => 1 - (1 - v) ** 3 });
  const outX = interpolate(frame, [dur - 7, dur], [0, -110], { extrapolateLeft: 'clamp' });
  const blur = Math.abs(inX + outX) / 8;
  return <AbsoluteFill style={{ transform: `translateX(${inX + outX}%)`, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>;
};

/** 5-12 s: the games, in rapid cuts (live games as real footage), then the whole line-up. */
export const S2Universe: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useU();
  const media = vertical ? { width: 960 * u, height: 960 * u * 0.62 } : { width: 1240 * u, height: 1240 * u * 0.5625 };
  const soon = GAMES.filter((g) => !g.live);
  const GRID = 330;
  const shots: { from: number; dur: number; el: React.ReactNode }[] = [
    { from: 15, dur: 95, el: <ClipFrame clip="volt" from={1.0} accent={GAMES[0].accent} style={media} /> },
    { from: 110, dur: 90, el: <ClipFrame clip="blob" from={Math.max(0, BLOB.eat.t - 0.9)} accent={GAMES[1].accent} style={media} /> },
    ...soon.map((g, i) => ({
      from: 200 + i * 22,
      dur: 22,
      el: <Img src={staticFile(`cards/${g.id}-art.png`)} style={{ ...media, objectFit: 'cover', borderRadius: 28 * u, border: `3px solid ${g.accent}`, boxShadow: `0 0 60px ${g.accent}66` }} />,
    })),
  ];
  const allGames = [GAMES[0], GAMES[1], ...soon];
  return (
    <AbsoluteFill>
      <Background accent={C.violet} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: (vertical ? 220 : 40) * u }}>
        <Headline text="8 GAMES. ONE ARENA." start={4} end={420} size={(vertical ? 92 : 84) * u} accentWords={['ONE', 'ARENA.']} accent={C.amber} />
        <Sub text="2 LIVE NOW  ·  6 COMING SOON" start={30} end={420} size={28 * u} style={{ marginTop: 10 * u }} />
      </AbsoluteFill>
      {shots.map((s, i) => {
        const g = allGames[i]!;
        return (
          <Sequence key={i} from={s.from} durationInFrames={s.dur}>
            <Shot dur={s.dur}>
              <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: (vertical ? 120 : 150) * u, gap: 26 * u, flexDirection: 'column' }}>
                {s.el}
                <Label name={g.name} live={g.live} accent={g.accent} u={u} />
              </AbsoluteFill>
            </Shot>
          </Sequence>
        );
      })}
      {/* the line-up: all eight cards fly into a grid */}
      {frame >= GRID && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: (vertical ? 260 : 170) * u }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${vertical ? 2 : 4}, ${(vertical ? 430 : 400) * u}px)`, gap: 22 * u }}>
            {allGames.map((g, i) => {
              const s = spring({ frame: frame - GRID - i * 3, fps, config: { damping: 14, stiffness: 160 } });
              return (
                <div key={g.id} style={{ position: 'relative', transform: `translateY(${(1 - s) * 400 * u}px) scale(${0.6 + 0.4 * s}) rotate(${(1 - s) * (i % 2 ? 8 : -8)}deg)`, opacity: s }}>
                  <Img src={staticFile(`cards/${g.id}-art.png`)} style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 18 * u, border: `3px solid ${g.accent}`, boxShadow: `0 0 30px ${g.accent}55`, display: 'block' }} />
                  <div style={{ position: 'absolute', left: 12 * u, bottom: 10 * u, fontFamily: FONT.display, fontSize: 24 * u, color: g.accent, textShadow: '0 2px 6px #000' }}>{g.name}</div>
                  {!g.live && <div style={{ position: 'absolute', right: 10 * u, top: 10 * u, fontFamily: FONT.ui, fontWeight: 900, fontSize: 15 * u, padding: `${3 * u}px ${9 * u}px`, borderRadius: 99, background: '#000a', color: C.text }}>SOON</div>}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
