import React from 'react';
import { OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C } from '../brand';

/**
 * Real gameplay footage in a neon frame. `from` = seconds into the clip to start at.
 * Slow push-in (Ken Burns) for life; `zoom` adds a punch-in on top.
 */
export const ClipFrame: React.FC<{
  clip: string;
  from: number;
  rate?: number;
  accent?: string;
  radius?: number;
  zoom?: number;
  focus?: [number, number];
  border?: boolean;
  style?: React.CSSProperties;
  dim?: number;
}> = ({ clip, from, rate = 1, accent = C.pink, radius = 28, zoom = 1, focus = [50, 50], border = true, style, dim = 0 }) => {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [0, 600], [1.0, 1.06], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        border: border ? `3px solid ${accent}` : undefined,
        boxShadow: border ? `0 0 60px ${accent}66, 0 30px 80px rgba(0,0,0,.55)` : undefined,
        background: '#0f0b24',
        ...style,
      }}
    >
      <OffthreadVideo
        src={staticFile(`clips/${clip}.mp4`)}
        trimBefore={Math.round(from * 60)}
        playbackRate={rate}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${push * zoom})`, transformOrigin: `${focus[0]}% ${focus[1]}%` }}
      />
      {dim > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(15,11,36,${dim})` }} />}
    </div>
  );
};
