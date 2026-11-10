# Stake Arena: 60-day growth plan

What the code now does for growth, and what to do outside the code. The research behind this: short-video clips (TikTok, YouTube Shorts) are the main discovery channel for browser games; zero-install play converts those viewers; friend invites and creators grew Agar.io and Slither.io; portals (CrazyGames, Poki) bring steady traffic. Sources are mostly industry blogs, so treat them as consensus, not proof.

## Built into the product
| Lever | Where |
|---|---|
| Instant play, no sign-up, works on phones | landing → PLAY |
| Shareable moment after every life (image card + challenge link) | death / cash-out screen |
| Challenge loop: friend opens link → banner → "YOU BEAT X!" → shares back | `?c=` links |
| Play with friends (private rooms) | 👥 on each game card, `?room=CODE` |
| Drama in every room: the King with a crown, an arrow and a bounty | all games |
| Clip-friendly juice: streak banners, KO stamps, meme sounds, big whole-number payouts | all games |
| Link previews (WhatsApp, Discord, X), installable app, privacy page | `index.html`, `public/` |
| Safe for portals and streams: nickname filter, play credits only | `shared/protocol.ts` |

## Week 0: unblock (owner)
1. **Deploy the game server** (Render, one click, see README). Without it, friends can't share a room and private rooms don't work. Then set the `GAME_SERVER_URL` repo variable so the GitHub Pages site plays online.
2. Pick a short domain (`stakearena.io` style) and point it at the server.
3. Re-render the promo video for the current 6 games (`marketing/video`).

## Weeks 1–2: content engine
- Record 20–30 vertical clips (phone, 15–25 s each). What works: a comeback KO on the King, a "VULNERABLE" cash-out that barely survives, a Hot Potato pass at 0.1 s, a Bomber chain reaction, a Stomp Ground Pound. Hook in the first second, payout number on screen, no long intros.
- Post 1–2 clips a day on TikTok, YouTube Shorts and Instagram Reels; link in bio straight to a game (`/#coil`), not the homepage.
- Reply to comments with challenge links.

## Weeks 2–4: distribution
- **CrazyGames**: apply as a developer. Needs their SDK (instant multiplayer flag, usernames shown, chat moderation if you add chat), metadata, cover and trailer. Multiplayer games that need a big audience may go straight to Full Launch.
- **Poki**: apply through Poki for Developers (curated, human-reviewed). Externally hosted multiplayer servers need an up-to-date privacy statement (we have one).
- Post on r/WebGames, r/IOGames, r/incremental-adjacent communities, itch.io (HTML5 page that links to the live site), and .io game listing sites.
- Send keys-free invites to small YouTube/Twitch creators who play .io games: a private room code and a "beat the streamer" challenge link.

## Weeks 4–8: retention and events
- Weekly "King of the Week" shout-out on socials (screenshot of the top stake).
- One themed weekend event per game (e.g. double bounty weekend) — a config change.
- Watch which game gets the most plays per visitor and promote it to the hero slot; retire games nobody plays.

## Measure (add before launch)
Plays per visitor, sessions per player per day, share-button taps, challenge-link opens, D1/D7 return rate. Privacy-friendly analytics only, and update the privacy page first.

## Rules that do not change
Play credits only, no real money, no paid entry. Prizes (later) are funded by the owner, skill-ranked, 18+, with published rules. No dark patterns: the break reminder stays.
