import '@fontsource/bungee/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import { continueRender, delayRender } from 'remotion';

/** Block rendering until the brand fonts are ready (no fallback-font frames). */
const handle = delayRender('brand fonts');
Promise.all(['400 40px Bungee', '800 40px Nunito', '900 40px Nunito', '700 40px Nunito'].map((f) => document.fonts.load(f)))
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
