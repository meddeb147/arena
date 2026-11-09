# Stake Arena

Real-time multiplayer arena games sharing one **play-credit** economy.

> **Play credits only. No real money.** There are no deposits, withdrawals, crypto or paid entry in this codebase.

Players spawn with 1 play credit at stake, take 80% of the stake of every player they eliminate (20% goes to the house pot), and can cash out at any time by holding a button for 3 seconds (they are vulnerable while holding).

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
Docker Compose (app, PostgreSQL, Redis, Caddy for HTTPS) comes in step 8.
