import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { CornerDisclaimer } from './components/Corner';
import { VOLT } from './clips';
import { S1Hook } from './scenes/S1Hook';
import { S2Universe } from './scenes/S2Universe';
import { S3Enter } from './scenes/S3Enter';
import { S4Eliminate } from './scenes/S4Eliminate';
import { S5Cashout } from './scenes/S5Cashout';
import { S6Compete } from './scenes/S6Compete';
import { S7Reveal } from './scenes/S7Reveal';
import { useU } from './scenes/useU';
import { MUSIC, SCENES, SFX, VO_CUES, f } from './timeline';

const SCENE_LIST: [keyof typeof SCENES, React.FC][] = [
  ['hook', S1Hook],
  ['universe', S2Universe],
  ['enter', S3Enter],
  ['eliminate', S4Eliminate],
  ['cashout', S5Cashout],
  ['compete', S6Compete],
  ['reveal', S7Reveal],
];

/** Sound cues that depend on moments measured in the captured footage. */
function footageSfx() {
  const elim = SCENES.eliminate.from;
  const ko1 = elim + 1.4;
  const ko2 = elim + 1.4 + (VOLT.ko2.t - VOLT.ko1.t);
  const cash = SCENES.cashout.from;
  const start = cash + 0.4;
  const done = cash + 0.4 + (VOLT.cashDone.t - VOLT.cashStart.t);
  return [
    { name: 'elimination', at: ko1, volume: 0.9 },
    { name: 'coin', at: ko1 + 0.15, volume: 0.7 },
    { name: 'elimination', at: ko2, volume: 0.9 },
    { name: 'coin', at: ko2 + 0.15, volume: 0.7 },
    ...[0, 1, 2].map((k) => ({ name: 'tick', at: start + k, volume: 0.9 })),
    { name: 'cashout', at: done, volume: 0.9 },
    { name: 'coin', at: done + 1.5, volume: 0.7 },
  ];
}

/** Every scene starts with a short white flash; the outgoing scene is already gone. */
const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 2, 12], [0.85, 0.5, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: '#fff', opacity: o, mixBlendMode: 'screen', pointerEvents: 'none' }} />;
};

export const Promo: React.FC = () => {
  const { u } = useU();
  const voFrames = VO_CUES.map((c) => [f(c.at), f(c.at + c.src[1] - c.src[0])] as const);
  const musicVolume = (frame: number) => {
    let duck = 0;
    const ramp = f(MUSIC.rampS);
    for (const [a, b] of voFrames) {
      duck = Math.max(duck, interpolate(frame, [a - ramp, a, b, b + ramp * 2], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
    }
    const end = interpolate(frame, [f(59), f(60)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return (MUSIC.full - (MUSIC.full - MUSIC.ducked) * duck) * end;
  };
  return (
    <AbsoluteFill style={{ background: '#171433' }}>
      {SCENE_LIST.map(([key, Scene]) => {
        const s = SCENES[key];
        return (
          <Sequence key={key} from={f(s.from)} durationInFrames={f(s.to - s.from)} name={key}>
            <Scene />
            {key !== 'hook' && <Flash />}
            {key !== 'reveal' && <CornerDisclaimer size={20 * u} />}
          </Sequence>
        );
      })}

      <Audio src={staticFile('audio/music.wav')} volume={musicVolume} />
      {VO_CUES.map((c, i) => (
        <Sequence key={`vo${i}`} from={f(c.at)} durationInFrames={f(c.src[1] - c.src[0])} name={`VO ${c.label}`}>
          <Audio src={staticFile('vo/voiceover.mp3')} trimBefore={f(c.src[0])} trimAfter={f(c.src[1])} volume={1} />
        </Sequence>
      ))}
      {[...SFX, ...footageSfx()].map((s, i) => (
        <Sequence key={`sfx${i}`} from={f(s.at)} durationInFrames={f(4)} name={`sfx ${s.name}`}>
          <Audio src={staticFile(`audio/sfx/${s.name}.wav`)} volume={s.volume ?? 0.8} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
