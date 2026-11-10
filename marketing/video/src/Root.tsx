import React from 'react';
import { Composition, Still } from 'remotion';
import './fonts';
import { Promo } from './Promo';
import { Thumbnail } from './Thumbnail';
import { DURATION_S, FPS } from './timeline';

export const Root: React.FC = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={DURATION_S * FPS} fps={FPS} width={1920} height={1080} />
    <Composition id="PromoVertical" component={Promo} durationInFrames={DURATION_S * FPS} fps={FPS} width={1080} height={1920} />
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
  </>
);
