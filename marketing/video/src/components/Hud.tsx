import React from 'react';
import { C, FONT } from '../brand';

/** The in-game HUD panel look (rgba panel, Nunito 800), scaled up for video. */
export const HudPanel: React.FC<{ rows: { label: string; value: string; color?: string; big?: boolean }[]; scale?: number; style?: React.CSSProperties; title?: string; titleColor?: string }> = ({
  rows,
  scale = 1,
  style,
  title,
  titleColor = C.pink,
}) => (
  <div
    style={{
      background: 'rgba(23, 20, 51, 0.82)',
      border: '1px solid #ffffff1c',
      borderRadius: 18 * scale,
      padding: `${14 * scale}px ${20 * scale}px`,
      boxShadow: '0 10px 30px rgba(5,3,20,.55)',
      fontFamily: FONT.ui,
      fontWeight: 800,
      minWidth: 260 * scale,
      ...style,
    }}
  >
    {title && <div style={{ fontFamily: FONT.display, fontSize: 20 * scale, color: titleColor, marginBottom: 8 * scale }}>{title}</div>}
    {rows.map((r) => (
      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 30 * scale, alignItems: 'baseline', color: C.muted, fontSize: 22 * scale, lineHeight: 1.45 }}>
        <span>{r.label}</span>
        <b style={{ color: r.color ?? C.text, fontSize: (r.big ? 34 : 24) * scale, fontVariantNumeric: 'tabular-nums' }}>{r.value}</b>
      </div>
    ))}
  </div>
);

export const fmt = (units: number) => (units / 100).toFixed(2);
