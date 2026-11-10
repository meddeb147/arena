import React from 'react';
import { C, DISCLAIMER_SHORT, FONT } from '../brand';

/** Always-on small print (CLAUDE.md: the disclaimer appears everywhere). */
export const CornerDisclaimer: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ position: 'absolute', right: size * 1.6, bottom: size * 1.2, fontFamily: FONT.ui, fontWeight: 800, fontSize: size, color: C.text, opacity: 0.75, textShadow: '0 2px 6px rgba(0,0,0,.8)' }}>
    {DISCLAIMER_SHORT}
  </div>
);
