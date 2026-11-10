import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Burst } from '../components/Burst';
import { ClipFrame } from '../components/ClipFrame';
import { Headline } from '../components/Headline';
import { Token } from '../components/Token';
import { C, FONT } from '../brand';
import { VOLT } from '../clips';
import { useU } from './useU';

/**
 * 21-32 s: real KOs from the footage, then the payout explained:
 * the victim's 1.00 splits into 0.80 for the killer and 0.20 for the house pot.
 */
export const S4Eliminate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical, width, height } = useU();
  const CLIP_FROM = VOLT.ko1.t - 1.4; // start 1.4 s before the first KO
  const KO1 = Math.round((VOLT.ko1.t - CLIP_FROM) * 60);
  const KO2 = Math.round((VOLT.ko2.t - CLIP_FROM) * 60);
  const GAME_END = KO2 + 110;
  const punch = (at: number) => interpolate(frame, [at - 4, at, at + 30], [1, 1.22, 1.08], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoom = frame < KO2 - 10 ? punch(KO1) : punch(KO2);

  // transfer explainer after the gameplay
  const T = GAME_END;
  const split = interpolate(frame, [T + 40, T + 95], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (v) => 1 - (1 - v) ** 3 });
  const cx = width / 2;
  const cy = height * (vertical ? 0.5 : 0.48);
  const killerX = vertical ? width * 0.27 : width * 0.25;
  const houseX = vertical ? width * 0.73 : width * 0.75;
  const enterT = spring({ frame: frame - T, fps, config: { damping: 14 } });
  const stake = frame < T + 95 ? 100 : Math.round(interpolate(frame, [T + 95, T + 125], [100, 180], { extrapolateRight: 'clamp' }));
  const house = frame < T + 95 ? 0 : Math.round(interpolate(frame, [T + 95, T + 125], [0, 20], { extrapolateRight: 'clamp' }));
  const growth = interpolate(frame, [T + 170, T + 230], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Background accent={C.voltPink} />
      {frame < GAME_END + 20 && (
        <AbsoluteFill style={{ opacity: interpolate(frame, [GAME_END, GAME_END + 20], [1, 0], { extrapolateLeft: 'clamp' }) }}>
          <ClipFrame clip="volt" from={CLIP_FROM} border={false} radius={0} zoom={zoom} style={{ width: '100%', height: '100%' }} />
          <Burst f={frame - KO1} scale={0.7 * u} seed="ko1" colors={[C.amber, '#fff', C.voltPink]} />
          <Burst f={frame - KO2} scale={0.7 * u} seed="ko2" colors={[C.amber, '#fff', C.sky]} />
          {[KO1, KO2].map((at, i) => (
            <div key={i} style={{ position: 'absolute', left: '50%', top: vertical ? '30%' : '22%', transform: `translateX(-50%) scale(${spring({ frame: frame - at, fps, config: { damping: 10 } })})`, opacity: interpolate(frame, [at, at + 4, at + 55, at + 70], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), fontFamily: FONT.display, fontSize: 120 * u, color: C.amber, textShadow: `0 6px 0 #0009, 0 0 ${60 * u}px ${C.amber}` }}>
              K.O.
            </div>
          ))}
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: (vertical ? 200 : 60) * u, background: 'linear-gradient(to top, rgba(15,11,36,.75), transparent 35%)' }}>
            <Headline text="ELIMINATE. CLAIM. GROW." start={10} end={GAME_END + 10} size={(vertical ? 80 : 84) * u} accentWords={['CLAIM.']} accent={C.amber} />
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {frame >= T && (
        <AbsoluteFill style={{ opacity: enterT }}>
          <AbsoluteFill style={{ alignItems: 'center', paddingTop: (vertical ? 240 : 70) * u }}>
            <div style={{ fontFamily: FONT.display, fontSize: 64 * u, color: C.text, textShadow: `0 0 ${40 * u}px ${C.pink}88` }}>EVERY KNOCKOUT PAYS</div>
            <div style={{ fontFamily: FONT.ui, fontWeight: 900, fontSize: 28 * u, color: C.muted, marginTop: 8 * u }}>The victim&apos;s stake is split by the server</div>
          </AbsoluteFill>
          {/* the victim's stake */}
          {split < 1 && (
            <div style={{ position: 'absolute', left: cx - 110 * u, top: cy - 110 * u, opacity: 1 - split, transform: `scale(${1 - split * 0.3})` }}>
              <Token size={220 * u} spin={frame * 0.08} label="1.00" />
            </div>
          )}
          {/* 80% to the killer, 20% to the house pot */}
          {split > 0 && (
            <>
              <div style={{ position: 'absolute', left: cx + (killerX - cx) * split - 90 * u, top: cy - 90 * u - Math.sin(split * Math.PI) * 140 * u }}>
                <Token size={180 * u} spin={frame * 0.1} label="0.80" />
              </div>
              <div style={{ position: 'absolute', left: cx + (houseX - cx) * split - 55 * u, top: cy - 55 * u - Math.sin(split * Math.PI) * 90 * u }}>
                <Token size={110 * u} spin={frame * 0.12} label="0.20" tint={C.violet} />
              </div>
            </>
          )}
          {[
            { x: killerX, title: 'YOUR STAKE', pct: '80%', color: C.amber, value: stake },
            { x: houseX, title: 'HOUSE POT', pct: '20%', color: C.violet, value: house },
          ].map((b) => (
            <div key={b.title} style={{ position: 'absolute', left: b.x, top: cy + 150 * u, transform: 'translateX(-50%)', textAlign: 'center', fontFamily: FONT.display }}>
              <div style={{ fontSize: 72 * u, color: b.color, textShadow: `0 0 ${40 * u}px ${b.color}88` }}>{b.pct}</div>
              <div style={{ fontSize: 32 * u, color: C.text }}>{b.title}</div>
              <div style={{ fontFamily: FONT.ui, fontWeight: 900, fontSize: 40 * u, color: b.color, marginTop: 6 * u, fontVariantNumeric: 'tabular-nums' }}>{(b.value / 100).toFixed(2)}</div>
            </div>
          ))}
          {/* growth: each KO adds 0.80 */}
          <div style={{ position: 'absolute', left: '50%', bottom: (vertical ? 260 : 60) * u, transform: `translateX(-50%) translateY(${(1 - growth) * 40 * u}px)`, opacity: growth, display: 'flex', alignItems: 'center', gap: 22 * u, fontFamily: FONT.display, fontSize: 44 * u, color: C.text }}>
            {['1.00', '1.80', '2.60', '3.40'].map((v, i) => (
              <React.Fragment key={v}>
                {i > 0 && <span style={{ color: C.mint, fontSize: 30 * u }}>+0.80 ›</span>}
                <span style={{ color: i === 3 ? C.amber : C.text, opacity: interpolate(frame, [T + 175 + i * 10, T + 185 + i * 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{v}</span>
              </React.Fragment>
            ))}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
