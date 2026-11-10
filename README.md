# Stake Arena

[![Play now](https://img.shields.io/badge/%E2%96%B6%20PLAY%20NOW-meddeb147.github.io%2Farena-ff4f7b?style=for-the-badge)](https://meddeb147.github.io/arena/)
[![CI](https://github.com/meddeb147/arena/actions/workflows/ci.yml/badge.svg)](https://github.com/meddeb147/arena/actions/workflows/ci.yml)

Real-time multiplayer arena games sharing one **play-credit** economy.

> **Play credits only. No real money.** There are no deposits, withdrawals, crypto or paid entry in this codebase.

## ▶ Play now

### 👉 [**https://meddeb147.github.io/arena/**](https://meddeb147.github.io/arena/)

No download or sign-up: open the link, type a nickname, pick an arena. **6 games** are playable: Coil Stake, Blob Stake, Volt Brawl, Stomp Stake, Bomber Blast and Hot Potato. Direct links open a game straight away: `…/arena/#volt`, `#blob`, `#coil`, `#stomp`, `#bomber`, `#potato`.

Works in any modern browser on desktop and phone. Everyone who opens the link plays in the **same arena** (the server fills each room with up to 20 players and tops it up with bots). If the game server is unreachable the page offers offline play against bots.

> The game server runs on a free host that sleeps when nobody plays. The first visit after a quiet period shows "Waking up the server…" for up to a minute.

### How to play

**Every game**
- You start with **10 play credits**. Each life puts **1 credit** at stake.
- Eat pellets to grow. Eat cells that are clearly smaller than you and you take **80% of their stake** (20% goes to the house pot).
- **Green spike traps** pop cells bigger than them. Small cells can hide underneath.
- **Hold cash-out for 3 seconds** to bank your stake into your wallet. You move slower and can be eaten while holding.
- For 2.5 s after spawning you are protected (your cell blinks).
- Out of credits? The death screen offers a free refill. They are play credits.

**Volt Brawl** (neon cage brawler)
- You jab automatically at anyone in reach. Steer to pick your fights.
- **Volt Dash** charges forward: whoever you hit takes heavy damage and gets flung away. **Shield** blocks all damage for 1.5 s.
- Lightning strikes are announced by a pink ring before they hit. Electric pylons zap on touch. Being slammed into the cage hurts.
- Whoever hit you last in the past 4 seconds gets the kill and 80% of your stake, even if lightning or a pylon finished you. Otherwise the stake goes to the house pot.
- Health orbs heal 30 HP; a KO heals 25 HP; health regenerates after 3 s without damage.

**Blob Stake** (eat or be eaten)
- Eat pellets and cells clearly smaller than you. Spike traps pop cells bigger than them.

**Coil Stake** (neon snakes)
- Your head steers, your body is a wall. A snake whose head hits your body is eliminated and you take 80% of its stake.
- **Jump** flies over bodies for a moment (you can't eat while airborne). **Magnet** pulls food to you for 3 s.
- Dead snakes burst into a trail of glowing food. Golden pellets are worth 6. Walls and spike traps kill.

**Stomp Stake** (side-view platformer)
- Run and jump across neon platforms above a lava sea. Land on someone's head to eliminate them and take 80% of their stake (you bounce off). Jumping *up* into someone's feet is a head-bonk: nobody dies.
- **Jump** (Space, W, ↑, or flick the joystick up) with a double jump in the air; release early for a short hop. **Ground Pound** (E) slams straight down and crushes whoever is below.
- Springs launch you, moving platforms carry you, spikes and lava kill. Bump someone into the lava and you get the kill if you touched them in the last 3 s.

**Bomber Blast** (timed bombs)
- **Bomb** drops a 2-second bomb (up to 3 at once). Walk into a bomb to kick it; bombs set off nearby bombs in chains.
- Blasts hit everyone in range, including you. Bombs also fall from the sky: get out of the red circles.

**Hot Potato** (pass it on)
- 1 to 3 potatoes depending on how many play. Touch someone to pass yours; it explodes after 9 seconds.
- If it explodes, the last player who passed it to the holder takes the holder's stake. You can't cash out while holding a potato. **Shield** blocks catching one.

**Sound and feel**
- Synthesized meme sound effects in every game (airhorn on your KO, sad trombone when you die, "bruh" + boom on a hazard death, coin on cash-out, boing, zap, thunder…). No audio files, nothing copyrighted.
- Mute with the 🔊 button or the **M** key; the choice is remembered.
- Kill streak banners (DOUBLE! TRIPLE! RAMPAGE!…), per-life stats and personal bests on the death and cash-out screens.
- After every 30 minutes of play a reminder offers a break.

| | Desktop | Phone |
|---|---|---|
| Steer | Mouse (distance from centre = speed) or WASD / arrows | Put your thumb anywhere: floating joystick |
| Dash (costs a little mass) | **Space** | Dash button |
| Shield (2 s, can't be eaten) | **E** or **Shift** | Shield button |
| Cash out | Hold **Q** | Hold the Cash-out button |

Languages: English, Français, العربية (RTL), chosen on the menu.

## Status

| Step | Scope | State |
|---|---|---|
| 1 | Monorepo, shared types, engine, one room, **Blob Stake** with bots, in-browser play | ✅ done |
| 2 | WebSocket multiplayer, matchmaking, delta snapshots, interpolation | ✅ done (client-side prediction: later) |
| 3 | PostgreSQL ledger, accounts (email/Google/guest), leaderboards | |
| 4 | More games on the shared engine | ✅ 6 games playable (Stomp Stake added; Tank Duel, Sumo Smash and Blade Spin were removed) |
| 5 | Landing page, HUD polish, audio, settings, full i18n | landing page done (live game previews, how it works, fair play) |
| 6 | Cosmetics, missions, prizes page, charity counter | |
| 7 | Anti-cheat, 200-bot load tests, security review | |
| 8 | Docker Compose + Caddy deploy, monitoring | |

## Quick start

Requires Node 20+.

```bash
npm install
```

```bash
npm run dev            # game server (:8080) + client (http://localhost:5173), open it in two tabs to play together
```

```bash
npm run build && npm start   # production: one server on :8080 serves the page, the websocket and /health
```

```bash
npm run check          # typecheck + tests (incl. credit-conservation fuzz test)
```

```bash
npm run bench -- 10    # 10 rooms x 20 bots, reports CPU per 30 Hz tick
```

```bash
npm run build:single -w @arena/client   # the whole game as one self-contained offline HTML file
```

Add `?server=offline` to the page URL to force offline play, or `?server=https://your-server` to point the page at another game server. `docker compose up` (with PostgreSQL and Redis) arrives in step 8; a single-container `Dockerfile` is already included.

### Controls
Mouse steers (distance from centre = throttle) or WASD/arrows · **Space** Dash · **E/Shift** Shield · hold **Q** to cash out.
On touch: a floating joystick appears wherever your thumb lands; big Dash/Shield/Cash-out buttons sit bottom-right.

## Layout

```
packages/
  shared/   constants, protocol types, economy math, feature flags, game catalog (pure TS)
  engine/   Room, GameModule API, ledger, spatial grid, bots; games/<id>/ (pure TS, server + browser)
  server/   Node: fixed 30 Hz loop, room manager (matchmaking), WebSocket gateway, static file server
  client/   Vite + PixiJS renderer, HUD, input, i18n (en/fr/ar)
```

## Economy

All amounts are integer units (`1 credit = 100 units`). The ledger is double-entry and append-only: every spawn, kill reward, house cut, hazard loss, cash-out and bot funding is one immutable row, and every balance is derived from rows. Tests check, over a 12,000-tick chaotic session, that balances always sum to zero, that the cache matches a replay of the rows, that no stake is orphaned, and that total credits equal what the mint granted.

## Adding a new game

1. **Simulation** – create `packages/engine/src/games/<id>/` and implement `GameModule` (`src/types.ts`):
   - `config` – world size, view radius, two skills (`cooldownTicks`, `durationTicks`).
   - `createState`, `createEntity` (spawn position/size), `step` (movement, collisions, hazards; call `sim.kill(victim, killer|null, cause)`), `useSkill`, optional `onDeath`/`onRemove`/`onCashoutStart`.
   - `createBrain` / `botInput` – bot steering.
   - `snapshot` – entities near the viewer with per-game kind codes.
   The Room already handles stakes, cooldowns, cash-out, spawn protection, respawn, bots filling seats and leaderboards.
2. Register it in `packages/engine/src/games/index.ts`.
3. **Renderer** – `packages/client/src/games/<id>/renderer.ts` implementing `GameRenderer`; register in `packages/client/src/games/index.ts`.
4. Set `available: true` in `GAME_CATALOG` (`packages/shared/src/games.ts`), add i18n strings.
5. Add tests – copy the conservation fuzz test with your module.

## Deployment

### Multiplayer server (free, one click)

Everyone must connect to one game server to share a room. The repo includes `render.yaml`, so:

1. Open **https://render.com/deploy?repo=https://github.com/meddeb147/arena** and sign in (GitHub login is fine, the free plan needs no card).
2. Click **Apply / Deploy**. After the build (~3 min) Render gives a URL like `https://stake-arena.onrender.com`. **That URL is the game**: share it, everyone lands in the same room.
3. Optional, so the GitHub Pages link plays online too: repo **Settings → Secrets and variables → Actions → Variables → New repository variable** `GAME_SERVER_URL` = your Render URL, then re-run the "Deploy game to GitHub Pages" workflow.

Every push redeploys the server automatically. Free Render services sleep after 15 minutes without visitors and wake on the next visit (up to a minute). The `Dockerfile` runs the same server on any container host (Fly.io, Railway, Koyeb, a VPS).

Protocol: JSON over WebSocket at `/ws`. Clients send only inputs (`hello`, `in`, `spawn`, `refill`); the server simulates at 30 Hz and sends each player a 15 Hz **delta snapshot** (only entities that changed in their view, plus removed ids). Messages are size-capped and rate-limited; a second tab with the same guest id replaces the first; a disconnected player's live entity auto-cashes-out.

### Static play link

**Play link (GitHub Pages).** `.github/workflows/pages.yml` builds the client on every push to `main` or the development branch and publishes it to the `gh-pages` branch (and via GitHub Actions deployment). One-time setup: repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `gh-pages`, folder `/ (root)` → Save**. The game appears at [meddeb147.github.io/arena](https://meddeb147.github.io/arena/) about a minute later.

**CI.** `.github/workflows/ci.yml` runs typecheck, all tests (including the credit-conservation fuzz test) and a 200-bot benchmark on every push.

**Full server.** Docker Compose (game server, PostgreSQL, Redis, Caddy for HTTPS) comes in step 8.
