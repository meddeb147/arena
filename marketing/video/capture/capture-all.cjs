// Captures every gameplay clip the promo uses (needs `npm run capture:serve` running).
// Each clip is the real game UI recorded frame by frame at 60 fps.
const { spawnSync } = require('node:child_process');

const CLIPS = [
  ['volt', 17.5],
  ['blob', 7],
];

for (const [name, seconds] of CLIPS) {
  const r = spawnSync('node', ['capture/run-capture.cjs', name, String(seconds), `public/clips/${name}.mp4`], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
