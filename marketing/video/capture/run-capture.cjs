// Records the real game UI frame by frame with a virtual clock, so the
// footage is a perfect 60 fps even on a machine without a GPU.
// usage: node capture/run-capture.cjs <scenario> <seconds> <out.mp4>
const { chromium } = require('playwright');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const [scenario = 'volt', seconds = '16', out = `public/clips/${scenario}.mp4`] = process.argv.slice(2);
const FPS = 60;
const base = process.env.CAPTURE_URL ?? 'http://localhost:5199/capture.html';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // 1280x720 CSS pixels at 1.5x = 1920x1080, so the HUD reads at video size
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.clock.install({ time: 0 });
  // freeze time: it only moves when we call runFor, exactly one frame per screenshot
  await page.clock.pauseAt(1000);
  await page.goto(`${base}?scenario=${scenario}&renderer=${process.env.RENDERER ?? 'canvas'}`);
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(1500); // warm up: fonts, textures, first snapshots
  const t0 = await page.evaluate(() => performance.now());
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.on('exit', (code) => code && console.error('ffmpeg exited', code));
  ff.stdin.on('error', (e) => { console.error('ffmpeg pipe:', e.message); process.exit(1); });
  const frames = Math.round(Number(seconds) * FPS);
  let carry = 0;
  for (let i = 0; i < frames; i++) {
    carry += 1000 / FPS;
    const step = Math.floor(carry);
    carry -= step;
    await page.clock.runFor(step);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 120 === 0) process.stdout.write(`\r${scenario}: ${i}/${frames}`);
  }
  ff.stdin.end();
  // key moments, in seconds from the start of the clip
  const log = await page.evaluate(() => window.captureLog || []);
  const moments = log.map((e) => ({ ...e, t: Math.round(e.t - t0) / 1000 }));
  fs.writeFileSync(out.replace(/[.]mp4$/, '.json'), JSON.stringify({ scenario, fps: FPS, seconds: Number(seconds), moments }, null, 2));
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).stdout.toString().trim();
  console.log(`\n${out}: ${probe}s`);
})();
