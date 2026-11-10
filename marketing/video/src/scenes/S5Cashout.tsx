import React from 'react';
import { AbsoluteFill, Freeze, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { ClipFrame } from '../components/ClipFrame';
import { Headline } from '../components/Headline';
import { HudPanel, fmt } from '../components/Hud';
import { Token } from '../components/Token';
import { C, FONT } from '../brand';
import { VOLT } from '../clips';
import { useU } from './useU';

/**
 * 32-41 s: the real cash-out from the footage. A countdown ring tracks the
 * 3-second hold, a VULNERABLE warning flashes while an opponent attacks,
 * then the stake goes back to the wallet.
 */
export const S5Cashout: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useU();
  const CLIP_FROM = VOLT.cashStart.t - 0.4;
  const START = Math.round((VOLT.cashStart.t - CLIP_FROM) * 60);
  const DONE = Math.round((VOLT.cashDone.t - CLIP_FROM) * 60);
  const banked = VOLT.cashDone.amount ?? 260;
  const walletAfter = VOLT.cashDone.wallet ?? 900 + banked;
  const hold = interpolate(frame, [START, DONE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const secs = Math.max(1, 3 - Math.floor(hold * 3));
  const ringOn = frame >= START && frame < DONE + 30;
  const danger = frame > START + 40 && frame < DONE;
  const R = 150 * u;
  const after = frame - DONE;
  const toWallet = interpolate(after, [30, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (v) => v * v * (3 - 2 * v) });
  const wallet = after < 90 ? walletAfter - banked : Math.round(interpolate(after, [90, 120], [walletAfter - banked, walletAfter], { extrapolateRight: 'clamp' }));
  const panel = spring({ frame: after - 20, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <Background accent={C.mint} />
      {/* the footage ends before the scene: hold its last frame */}
      <Freeze frame={Math.min(frame, Math.floor((17.4 - CLIP_FROM) * 60))}>
        <ClipFrame clip="volt" from={CLIP_FROM} border={false} radius={0} zoom={interpolate(frame, [START, DONE], [1, 1.12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} style={{ width: '100%', height: '100%' }} />
      </Freeze>
      {after > 60 && <AbsoluteFill style={{ background: `rgba(15,11,36,${Math.min(0.55, (after - 60) / 60)})` }} />}
      {danger && <AbsoluteFill style={{ boxShadow: `inset 0 0 ${180 * u}px ${C.pink}${Math.floor(frame / 8) % 2 ? 'cc' : '55'}` }} />}
      {ringOn && (
        <div style={{ position: 'absolute', left: vertical ? '50%' : '20%', top: vertical ? '26%' : '42%', transform: 'translate(-50%, -50%)' }}>
          <svg width={R * 2 + 40 * u} height={R * 2 + 40 * u} style={{ overflow: 'visible' }}>
            <circle cx={R + 20 * u} cy={R + 20 * u} r={R} fill="rgba(15,11,36,.75)" stroke="#ffffff22" strokeWidth={18 * u} />
            <circle cx={R + 20 * u} cy={R + 20 * u} r={R} fill="none" stroke={C.mint} strokeWidth={18 * u} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * R * hold} ${2 * Math.PI * R}`} transform={`rotate(-90 ${R + 20 * u} ${R + 20 * u})`} style={{ filter: `drop-shadow(0 0 ${12 * u}px ${C.mint})` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: FONT.display, fontSize: (frame < DONE ? 130 : 60) * u, color: frame < DONE ? C.text : C.mint }}>{frame < DONE ? secs : 'SAFE'}</div>
          <div style={{ textAlign: 'center', marginTop: 8 * u, fontFamily: FONT.display, fontSize: 30 * u, color: C.mint }}>HOLD TO CASH OUT</div>
        </div>
      )}
      {danger && (
        <div style={{ position: 'absolute', left: '50%', top: vertical ? '12%' : '9%', transform: 'translateX(-50%)', fontFamily: FONT.display, fontSize: 64 * u, color: C.pink, padding: `${8 * u}px ${28 * u}px`, border: `4px solid ${C.pink}`, borderRadius: 16 * u, background: '#170a1fcc', opacity: Math.floor(frame / 9) % 2 ? 1 : 0.55, textShadow: `0 0 ${30 * u}px ${C.pink}` }}>
          VULNERABLE
        </div>
      )}
      {after > 30 && after < 92 && (
        <div style={{ position: 'absolute', left: `${50 - 34 * toWallet}%`, top: `${50 - 30 * toWallet}%`, transform: `translate(-50%, -50%) scale(${1 - toWallet * 0.5})` }}>
          <Token size={200 * u} spin={after * 0.15} label={fmt(banked)} />
        </div>
      )}
      {after > 20 && (
        <div style={{ position: 'absolute', left: 60 * u, top: 60 * u, transform: `scale(${panel})`, transformOrigin: 'top left' }}>
          <HudPanel scale={1.6 * u} rows={[{ label: 'Wallet', value: fmt(wallet), color: after > 90 ? C.mint : C.text, big: true }]} />
        </div>
      )}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: (vertical ? 200 : 60) * u, background: after > 60 ? 'linear-gradient(to top, rgba(15,11,36,.7), transparent 40%)' : undefined }}>
        <Headline text="3 SECONDS. EVERYTHING AT STAKE." start={DONE + 50} end={540} size={(vertical ? 76 : 80) * u} accentWords={['3', 'SECONDS.']} accent={C.mint} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
