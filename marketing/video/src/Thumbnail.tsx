import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Background } from './components/Background';
import { Logo } from './components/Logo';
import { Token } from './components/Token';
import { C, FONT } from './brand';

/** YouTube thumbnail (1280x720): real gameplay frame, the logo, the hook and a token. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill>
    <Background accent={C.voltMagenta} particles={30} />
    <Img src={staticFile('clips/thumb-frame.png')} style={{ position: 'absolute', right: -40, top: 40, width: 900, borderRadius: 30, border: `5px solid ${C.voltMagenta}`, transform: 'rotate(4deg)', boxShadow: `0 0 80px ${C.voltMagenta}88` }} />
    <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(23,20,51,.96) 30%, rgba(23,20,51,.2) 70%, transparent)' }} />
    <div style={{ position: 'absolute', left: 56, top: 64 }}>
      <Logo size={64} glow={1.2} />
      <div style={{ fontFamily: FONT.display, fontSize: 92, lineHeight: 1.0, color: C.text, marginTop: 34, textShadow: `0 6px 0 #0009, 0 0 50px ${C.pink}88` }}>
        EVERY KILL
        <br />
        <span style={{ color: C.amber }}>CHANGES</span>
        <br />
        EVERYTHING
      </div>
      <div style={{ display: 'inline-block', marginTop: 26, fontFamily: FONT.ui, fontWeight: 900, fontSize: 30, color: '#0f2b23', background: C.mint, padding: '8px 18px', borderRadius: 14 }}>+80% OF EVERY STAKE</div>
    </div>
    <div style={{ position: 'absolute', right: 70, bottom: 50 }}>
      <Token size={190} spin={0.5} label="1" />
    </div>
    <div style={{ position: 'absolute', left: 56, bottom: 22, fontFamily: FONT.ui, fontWeight: 800, fontSize: 20, color: C.text, opacity: 0.8 }}>Play credits only. No real money.</div>
  </AbsoluteFill>
);
