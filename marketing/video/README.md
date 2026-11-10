# Stake Arena: promo video

A 60-second, 1920×1080, 60 fps YouTube ad built with [Remotion](https://www.remotion.dev) (React + TypeScript), plus a 1080×1920 vertical cut and a 1280×720 thumbnail. This folder is separate from the game's npm workspaces; nothing here is part of the game build.

Everything in the video is real or original:
- **Gameplay** is the actual game UI (renderer, HUD, kill feed, cash-out screen) recorded frame by frame from the real client code. A script only chooses the hero's inputs and sets up moments (who stands where); every KO, payout and cash-out is the real engine.
- **Game cards** are screenshots of the real landing page.
- **Music and sound effects** are synthesized from scratch by `audio/synth.mjs` (no samples, royalty-free).
- **Voice-over**: `public/vo/voiceover.mp3` (ElevenLabs, supplied by the owner).

## Compliance (CLAUDE.md)
- "Play credits only. No real money." is on screen in every scene; the end card shows the full disclaimer.
- No claim that credits are money or can be cashed out for money. "Cash out" always means back to the play-credit wallet.
- Only 2 of the 8 games are live; the video says so ("2 LIVE NOW · 6 COMING SOON").
- Weekly prizes are not live: they are shown as **COMING SOON**, funded separately, ranked by skill, 18+.
- The edit does not say "Terms apply" because the Terms / Prize Rules pages do not exist yet. Add them before advertising prizes as live.

## Storyboard (seconds)

| Scene | Time | What you see | Headline |
|---|---|---|---|
| 1 Hook | 0–5 | sparks converge, neon explosion, logo slams in with light sweep | EVERY KILL CHANGES EVERYTHING. |
| 2 Universe | 5–12 | rapid whip-pan cuts: Volt Brawl and Blob Stake footage, then the 6 coming-soon cards; all 8 fly into a grid | 8 GAMES. ONE ARENA. · 2 LIVE NOW · 6 COMING SOON |
| 3 Enter | 12–21 | wallet panel pays 1.00, a 3D credit token arcs into the arena, the match starts (real footage) | PUT YOUR STAKE ON THE LINE. |
| 4 Eliminate | 21–32 | two real KOs with punch-in zoom and K.O. stamps; then the payout explained: 1.00 splits into 0.80 (your stake) and 0.20 (house pot); 1.00 → 1.80 → 2.60 → 3.40 | ELIMINATE. CLAIM. GROW. |
| 5 Cash out | 32–41 | real cash-out: 3-2-1 ring tracks the hold, VULNERABLE warning while an opponent attacks, survives, token flies to the wallet | 3 SECONDS. EVERYTHING AT STAKE. |
| 6 Compete | 41–50 | the in-game Top Stakes board, the player climbs to #1; weekly prizes card stamped COMING SOON | CLIMB THE LEADERBOARD. |
| 7 Reveal | 50–60 | explosion, logo, the 8 games orbit it, CTA button and URL, full disclaimer | PLAY. ELIMINATE. DOMINATE. · ENTER THE ARENA |

All timings live in `src/timeline.ts`.

## Voice-over

`public/vo/voiceover.mp3` is 39.4 s. It was split at its natural pauses (ffmpeg `silencedetect`) into 6 phrases, each placed at a scene start (`VO_CUES` in `src/timeline.ts`). The words could not be transcribed in the build environment, so **listen in Remotion Studio and move any cue (`at`) that lands on the wrong scene.** The music ducks automatically under every cue.

### Narration written for this edit
If you regenerate the voice-over, this script is timed to the picture (about 130 words per minute, energetic male read). Start times are where each line should begin; keep the pauses.

| Start | Line |
|---|---|
| 0.5 | Every kill… changes everything. |
| 5.3 | This is Stake Arena. Eight fast multiplayer games, two live right now, one arena. |
| 12.6 | Every life puts one play credit on the line. Your stake goes in with you. |
| 21.4 | Knock someone out and their stake splits: eighty percent to you, twenty to the house pot. Every knockout grows your stake. |
| 32.4 | Want to keep it? Hold cash out for three seconds. While you hold, you're exposed. Survive, and it's yours. |
| 41.3 | Climb the leaderboard. Weekly skill-based prizes are coming soon. |
| 50.4 | Stake Arena. Play. Eliminate. Dominate. Enter the arena now. Play credits only. |

Export it as one file, replace `public/vo/voiceover.mp3`, and update `VO_CUES` (one cue per line: `src` = where the line is in the file, `at` = the start time above).

## Commands

```bash
cd marketing/video && npm install
```

```bash
npm run studio          # live preview and editing in the browser
```

```bash
npm run render          # out/stake-arena-promo.mp4 (1920x1080, 60 fps)
```

```bash
npm run render:vertical # out/stake-arena-promo-vertical.mp4 (1080x1920)
```

```bash
npm run thumbnail       # out/stake-arena-thumbnail.png (1280x720)
```

```bash
npm run audio           # re-synthesize public/audio/music.wav and sfx/*.wav
```

Re-capturing gameplay (after game changes):

```bash
npm run capture:serve   # in one terminal: serves capture/capture.html with the real client code
```

```bash
NODE_PATH=$(npm root -g) npm run capture   # records public/clips/{volt,blob}.mp4 + .json moment logs
```

Capture uses Playwright's virtual clock: time only advances one frame per screenshot, so footage is a perfect 60 fps even without a GPU. It uses Pixi's Canvas renderer (`?renderer=canvas`) because software WebGL read-back is too slow. The `.json` next to each clip lists the measured KO and cash-out times; the scenes sync to them automatically. The scripted moments are in `capture/scenarios.ts`.

Rendering uses the Chromium already installed at `/opt/pw-browsers` (override with `REMOTION_CHROME=/path/to/chrome-headless-shell`).

## Files
- `src/Promo.tsx`: assembles scenes, transitions, music (with ducking), voice-over and sound effects.
- `src/scenes/S1Hook.tsx` … `S7Reveal.tsx`: one file per scene; layouts adapt to the vertical format.
- `src/components/`: Background (neon glow, perspective grid, particles), Logo (the official wordmark), Burst, Headline, Token (3D credit coin), ClipFrame, Hud, Corner disclaimer.
- `src/Thumbnail.tsx`: YouTube thumbnail.
- `capture/`: scripted gameplay capture. `audio/`: music and SFX synthesizer.

## License note
Remotion is free for individuals and companies of up to 3 people; larger companies need a [company license](https://www.remotion.dev/license).
