# Stake Arena

[![Play now](https://img.shields.io/badge/%E2%96%B6%20PLAY%20NOW-meddeb147.github.io%2Farena-ff4f7b?style=for-the-badge)](https://meddeb147.github.io/arena/)
[![CI](https://github.com/meddeb147/arena/actions/workflows/ci.yml/badge.svg)](https://github.com/meddeb147/arena/actions/workflows/ci.yml)

Real-time multiplayer arena games sharing one **play-credit** economy.

> **Play credits only. No real money.** There are no deposits, withdrawals, crypto or paid entry in this codebase.

## ▶ Play now

### 👉 [**https://meddeb147.github.io/arena/**](https://meddeb147.github.io/arena/)

No download or sign-up: open the link, type a nickname, press **PLAY**.

Works in any modern browser on desktop and phone. The current build is **Blob Stake** against bots; the game runs entirely in your browser (online multiplayer arrives in step 2).

### How to play
- You start with **10 play credits**. Each life puts **1 credit** at stake.
- Eat pellets to grow. Eat cells that are clearly smaller than you and you take **80% of their stake** (20% goes to the house pot).
- **Green spike traps** pop cells bigger than them. Small cells can hide underneath.
- **Hold cash-out for 3 seconds** to bank your stake into your wallet. You move slower and can be eaten while holding.
- For 2.5 s after spawning you are protected (your cell blinks).
- Out of credits? The death screen offers a free refill. They are play credits.

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
| 2 | WebSocket multiplayer, matchmaking, interpolation/prediction | next |
| 3 | PostgreSQL ledger, accounts (email/Google/guest), leaderboards | |
| 4 | Coil, Tank, Sumo, Blade, Bomber, Hot Potato | |
| 5 | Landing page, HUD polish, audio, settings, full i18n | |
| 6 | Cosmetics, missions, prizes page, charity counter | |
| 7 | Anti-cheat, 200-bot load tests, security review | |
| 8 | Docker Compose + Caddy deploy, monitoring | |

## Quick start

Requires Node 20+.

```bash
npm install
```

```bash
npm run dev            # client on http://localhost:5173 (step 1: engine runs in the browser)
```

```bash
npm run dev:server     # authoritative server with a bot-filled room, GET :8080/health
```

```bash
npm run check          # typecheck + tests (incl. credit-conservation fuzz test)
```

```bash
npm run bench -- 10    # 10 rooms x 20 bots, reports CPU per 30 Hz tick
```

```bash
npm run build:single -w @arena/client   # the whole game as one self-contained HTML file
```

`docker compose up` arrives in step 8.

### Controls
Mouse steers (distance from centre = throttle) or WASD/arrows · **Space** Dash · **E/Shift** Shield · hold **Q** to cash out.
On touch: a floating joystick appears wherever your thumb lands; big Dash/Shield/Cash-out buttons sit bottom-right.

## Layout

```
packages/
  shared/   constants, protocol types, economy math, feature flags, game catalog (pure TS)
  engine/   Room, GameModule API, ledger, spatial grid, bots; games/<id>/ (pure TS, server + browser)
  server/   Node: fixed 30 Hz loop, rooms (+ WebSocket gateway in step 2)
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

**Play link (GitHub Pages).** `.github/workflows/pages.yml` builds the client on every push to `main` or the development branch and publishes it to the `gh-pages` branch (and via GitHub Actions deployment). One-time setup: repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `gh-pages`, folder `/ (root)` → Save**. The game appears at [meddeb147.github.io/arena](https://meddeb147.github.io/arena/) about a minute later.

**CI.** `.github/workflows/ci.yml` runs typecheck, all tests (including the credit-conservation fuzz test) and a 200-bot benchmark on every push.

**Full server.** Docker Compose (game server, PostgreSQL, Redis, Caddy for HTTPS) comes in step 8.
