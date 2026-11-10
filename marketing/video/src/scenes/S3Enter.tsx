import React from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Burst } from '../components/Burst';
import { ClipFrame } from '../components/ClipFrame';
import { Headline } from '../components/Headline';
import { HudPanel, fmt } from '../components/Hud';
import { Token } from '../components/Token';
import { C, FONT } from '../brand';
import { useU } from './useU';

/** 12-21 s: the wallet pays one credit, the token flies into the arena, the match starts. */
export const S3Enter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical, width, height } = useU();
  const POP = 70;
  const LAND = 135;
  const wallet = frame < POP + 6 ? 1000 : Math.round(interpolate(frame, [POP + 6, POP + 30], [1000, 900], { extrapolateRight: 'clamp' }));
  const panelIn = spring({ frame: frame - 8, fps, config: { damping: 15 } });
  const arenaIn = spring({ frame: frame - 24, fps, config: { damping: 16 } });

  // layout
  const wx = vertical ? width * 0.5 : width * 0.17;
  const wy = vertical ? height * 0.22 : height * 0.42;
  const ax = vertical ? width * 0.5 : width * 0.62;
  const ay = vertical ? height * 0.56 : height * 0.45;
  const aw = vertical ? width * 0.92 : width * 0.62;
  const ah = aw * 0.5625;

  // token flight: pop out of the wallet, arc up, dive into the arena
  const k = interpolate(frame, [POP, LAND], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (v) => v * v * (3 - 2 * v) });
  const tx = wx + (ax - wx) * k;
  const ty = wy + (ay - wy) * k - Math.sin(k * Math.PI) * 300 * u;
  const pop = spring({ frame: frame - POP, fps, config: { damping: 9, stiffness: 180 } });
  const tokenSize = 170 * u * (frame < LAND - 12 ? pop : interpolate(frame, [LAND - 12, LAND], [1, 0.3], { extrapolateRight: 'clamp' }));
  return (
    <AbsoluteFill>
      <Background accent={C.voltMagenta} />
      {/* the arena */}
      <div style={{ position: 'absolute', left: ax - aw / 2, top: ay - ah / 2, width: aw, height: ah, transform: `scale(${0.85 + 0.15 * arenaIn})`, opacity: arenaIn }}>
        {frame < LAND ? (
          <div style={{ width: '100%', height: '100%', borderRadius: 28 * u, border: `3px solid ${C.voltMagenta}`, background: 'radial-gradient(circle, #2a2270, #0f0b24)', display: 'grid', placeItems: 'center', boxShadow: `0 0 60px ${C.voltMagenta}55` }}>
            <div style={{ fontFamily: FONT.display, fontSize: 46 * u, color: C.voltMagenta, opacity: 0.5 + 0.5 * Math.sin(frame / 6) }}>VOLT BRAWL</div>
          </div>
        ) : (
          <Sequence from={LAND} layout="none">
            <ClipFrame clip="volt" from={0} rate={0.85} accent={C.voltMagenta} style={{ width: "100%", height: "100%" }} />
          </Sequence>
        )}
        {frame >= LAND && <Burst f={frame - LAND} scale={0.5 * u} seed="land" colors={[C.amber, C.voltMagenta, '#fff']} />}
      </div>
      {/* wallet */}
      <div style={{ position: 'absolute', left: wx, top: wy, transform: `translate(-50%, -50%) scale(${panelIn})` }}>
        <HudPanel scale={1.5 * u} rows={[{ label: 'Wallet', value: fmt(wallet) }, { label: 'Stake', value: fmt(frame >= LAND ? 100 : 0), color: C.amber, big: true }]} />
        <div style={{ textAlign: 'center', marginTop: 14 * u, fontFamily: '"Nunito"', fontWeight: 900, fontSize: 22 * u, color: C.muted, letterSpacing: 2 * u }}>1 PLAY CREDIT PER LIFE</div>
      </div>
      {frame >= POP && frame < LAND && (
        <div style={{ position: 'absolute', left: tx - tokenSize / 2, top: ty - tokenSize / 2 }}>
          <Token size={tokenSize} spin={(frame - POP) * 0.22} label="1" />
        </div>
      )}
      {frame >= POP && frame < POP + 40 && (
        <div style={{ position: 'absolute', left: wx, top: wy - 120 * u, transform: 'translateX(-50%)', fontFamily: FONT.display, fontSize: 48 * u, color: C.amber, opacity: interpolate(frame, [POP, POP + 8, POP + 40], [0, 1, 0]), textShadow: '0 3px 0 #0008' }}>
          -1.00
        </div>
      )}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: (vertical ? 170 : 70) * u }}>
        <Headline text="PUT YOUR STAKE ON THE LINE." start={150} end={540} size={(vertical ? 76 : 72) * u} accentWords={['STAKE']} accent={C.amber} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
