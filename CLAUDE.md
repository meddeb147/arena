# Stake Arena – rules for contributors (humans and AI)

## Hard rules (legal & safety) — never break these
- Credits are **PLAY CREDITS ONLY**. No real-money deposits, withdrawals, crypto, or paid entry. Do not write code for them.
- `FeatureFlags.realMoney` is typed as the literal `false` and a test asserts it. Changing that requires legal advice first.
- "Play credits only. No real money." must appear on the landing page and in every game menu/HUD (`PLAY_CREDITS_DISCLAIMER`, i18n key `disclaimer`).
- Revenue only from: ads (behind flags), sponsor banners, cosmetics that never affect gameplay, optional battle pass.
- Weekly prizes are paid by the owner from revenue, never from player funds; ranked by skill. Age gate (18+) before any prize-eligible feature.
- Audio: synthesized or royalty-free only. No copyrighted meme clips.
- No dark patterns: session reminders and "take a break" are features, not afterthoughts.

## Economy invariants (tested in `packages/engine/test`)
- Amounts are integer **units**; `CREDIT = 100` units. Never use floats for credits.
- Every credit movement is one immutable `Transfer` row (double entry). Balances are derived from rows; the cache must equal `MemoryLedger.replay(rows)`.
- Only `house` and `mint` may go negative. `mint` is the sole source of new play credits (grants/rewards).
- Spawn: wallet → stake (SPAWN_STAKE). Kill: victim stake → 80% killer stake + 20% house (`splitKill`). Death without killer: stake → house. Cash-out: stake → wallet. Bots: house funds their stake, stake returns to house when they leave.
- An entity is never removed while its stake account is non-zero (the Room throws).
- All balances always sum to zero. If you touch economy code, the fuzz test must still pass.

## Architecture
- `packages/shared` – pure TS: constants, protocol types, economy math, feature flags, game catalog. No Node/DOM APIs.
- `packages/engine` – pure TS simulation, runs on server **and** in the browser (offline/previews). Server is authoritative; clients only send `PlayerInput`.
  - `Room` owns players, bots, ledger, skills/cooldowns, cash-out, respawn, spawn protection, snapshots.
  - `GameModule` (src/types.ts) owns physics, collisions, hazards, kills, bot steering and snapshot content.
- `packages/server` – Node: fixed 30 Hz loop (`FixedLoop`), `RoomManager` (fullest room with space), `Gateway` (WebSocket `/ws`, validation, rate limits, delta snapshots), static file server for the built client. Protocol types live in `shared/src/protocol.ts`.
- `packages/client` – Vite + PixiJS (WebGL, Canvas fallback). `GameSession` abstracts local (`LocalSession`) vs network (`NetSession`) play; `net/server.ts` decides which server to use.
- Deploy: `render.yaml` (free one-click), `Dockerfile`, GitHub Pages workflow (static client, `GAME_SERVER_URL` repo variable points it at the server).

## Coding rules
- Simulation code uses `sim.rng` (seeded `Rng`), never `Math.random` / `Date.now` — rooms must be deterministic per seed.
- Never trust client input: everything goes through `sanitizeInput`; the server decides positions, collisions, kills and credits.
- Game feel tunables live in each game's `config.ts`, not inline.
- Client DOM: build with `h()` and text nodes; never `innerHTML` with user-provided strings (nicknames!).
- All UI strings go through `t()` with keys in `i18n/en.ts`, `fr.ts`, `ar.ts`. Use logical CSS properties (`inset-inline-start`) so RTL works.
- Respect `settings.reducedMotion` for shake/particles.
- TypeScript strict; run `npm run check` (typecheck + tests) before committing.

## Adding a game (see README for detail)
1. `packages/engine/src/games/<id>/` implementing `GameModule`; register in `games/index.ts`.
2. `packages/client/src/games/<id>/renderer.ts` implementing `GameRenderer`; register in `client/src/games/index.ts`.
3. Set `available: true` in `GAME_CATALOG`; add i18n strings; add tests (at least a conservation fuzz run).

## Workflow
- Small steps; run and test after each. Build order lives in README "Roadmap".
- Commands: `npm run dev` (server + client), `npm start` (production server), `npm test`, `npm run typecheck`, `npm run bench -- <rooms>`.
- Never close a room or drop a player without settling stakes through the ledger (`Room.close()`, `removePlayer` auto-cash-out).
