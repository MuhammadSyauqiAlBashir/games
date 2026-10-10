# BashGames

Private multiplayer games for the owner, his wife and close friends — live on everyone's phone.
https://games.bashir.my.id · same accounts and approval as lyrsync / finance · installable PWA.

## Games (69)
Lobby categories (`CATEGORIES` in `backend/bg/games/__init__.py`):
- **Cooking:** Wok & Roll Duel (plus the solo **Wok & Roll** career — the big card on the home page). See below.
- **Board & dice:** Ludo (4-colour board for 2–4, 6-colour board for 5–6), Snakes & Ladders, Monopoly (world
  cities, Rupiah, official rules or fast mode), Congklak, Checkers (international 10×10), Connect 4, SOS,
  Tic-tac-toe (any size).
- **Cards:** UNO (official + house-rule switches), Sequence (teams at 4), Poker (Texas Hold'em, Rp1.000.000 per
  day), Dominoes (Gaple, nyangkul).
- **Speed challenges** (`speed`): Bom Kata (word bomb), Survei 100 (Family 100), Cari Kembar (Spot it), Refleks
  Kilat, Ketik Ngebut.
- **Judged by AI** (`ai`): Foto Hunt, Ekspresi Challenge, Draw & AI Judge.
- **Sing & sounds** (`voice`): Karaoke Klasik, Nyanyi Lagu Hits, Tiru Suara.
- **Quiz & party:** Trivia (AI question bank, difficulty phases, ⚑ report), Cak Lontong Quiz, Math Race, Picture
  Riddles (`rebus`), Anagrams (English), Draw & Guess (`drawguess`).
- **Action:** Penalty Shootout, Snake Arena (with computer snakes).
- **Mario minigames** (10) + **More Mario minigames** (26), incl. Minigame Party (`mp_pesta`) — see below.

Rules summaries: `web/js/i18n.js` (RULES). Game names are English (UI text stays Indonesian/English); the games
added on 2026-10-01 (speed, AI-judged, voice) keep their Indonesian names on purpose.

**Cak Lontong Quiz** (`lontong`, Indonesian): twisted-logic questions with TTS letter boxes; typing a stored "normal"
answer (trap) gets a MIKIR!; bank in `backend/bg/data/lontong.json` built by `tools/build_lontong.py`.
**Picture Riddles** (`rebus`, in the style of the Indonesian "Tebak Gambar" app; older docs call it "Tebak Gambar
Kata"): emoji pictures → tricky idioms/compound words, answered with letter tiles, 💡 open-a-letter costs 30 % per
letter; bank `data/tebak.json` built by `tools/build_tebak.py` (picture formulas), read by `content.builtin_rebus()`;
AI puzzles in `bg_questions` (`kind='rebus'`, `topic='tebak'`). `data/rebus.json` + `tools/build_rebus.py` are the
old bank (PR #3 replaced it) and are no longer read. Not to be confused with **Draw & Guess** (`drawguess`, old
name "Tebak Gambar"): one player draws, the others type guesses.

**Speed, AI-judged and voice games (PRs #7–#9):** see `docs/DESIGN.md` (speed challenges, photo games, voice games).
AI judging (`vision.race`, Gemini first, Cloudflare Workers AI backup): Draw & AI Judge and Ekspresi wait ≤30 s
(then equal points), the Foto Hunt photo check ≤25 s (then accepted unchecked); the voice games use Gemini only,
≤30 s (then the players vote).

**Mario minigames** (Super Mario Party Jamboree style, Mario names in both languages, 2–4 players):
Thwomp the Difference, Big-Top Quiz, Wario's Buzzer Beater, Sleight of Shell, Tricky Turntable, Lost and Pound,
Sled to the Edge, Fast Fishing, Talking Flower Says, Knock-Knock Match — each playable alone, or in
**Pesta Minigame** (`mp_pesta`): minigame roulette → how-to card with everyone tapping SIAP → the minigame →
coins by placing (10/6/3/0) → … → bonus stars (+15) → most coins wins.
- Engines: `backend/bg/games/mario.py` (shared `Mini` base: phases with deadlines, START!/FINISH!, 5/3/2/1 points),
  `mp_watch.py`, `mp_luck.py`, `mp_reflex.py`, `pesta.py` (runs the minigame inside its own state, merges stats).
  All are `timed` with `loop_dt = 0.05` (the room ticks every 50 ms while playing). Animations are scripted by the
  server (peek times, shuffles, keyframes) and replayed by every phone from the shared game clock, so everyone
  sees the same thing. Reaction games trust the phone's own reaction time (Fast Fishing) or release time (Sled).
- Front end: `web/js/games/mp.js` (HUD, banners, SVG characters: Thwomp, Bob-omb, Toad, Talking Flower, Cooligan,
  Cheep Cheep, Wario, chests, hammer), one module per minigame (`mp_*.js`), `mp_pesta.js` mounts the minigame
  module inside the party screens. Tests: `tests/test_mario.py` (every minigame with 2/3/4 players + full Pesta runs).

**More Mario minigames (26, "Minigame Mario lainnya"):** puzzles — Boss Sumo Bro Blitzers (circuit), Hot Cross Blocks,
Shadow Play, Coin Conveyor; finger — Toad-ally Electric Escape, Bowser Filter, Camera-Ready; timing — Gold 'n Brown,
Noggin Knock, Lane Change, Slappy-Go-Round, Stone-Eye Bowling, Hammer It Home; live arenas — The Floor Is Falling,
Hot-Hot Hop, Stamp Out!, Snag the Flags, Sunset Standoff; teams — Robo Arm Wrestle, Rocky Rope Race; rhythm — Rhythm
Kitchen, DK's Konga Line; sensors — Tilt-a-Golf (tilt), Pickax Dash (shake), Bowser Chicken & Speak Up, Junior! (mic).
- `mp_solo.py`: **solo races** — everyone plays their own copy (same seed) on the phone, which reports its score
  ≤4×/s; the server caps the gain rate and ranks the round. Friends-only, so the phone is trusted within limits.
- `mp_arena.py`: server-refereed puzzles, **live arenas** (`Live` = timed game that steps 20×/s and emits a frame
  event so the room pushes fresh views), team tapping (teams: 1v1, 1 vs 2 with the solo player ×2, 2v2) and
  Slappy-Go-Round. Jumps are back-dated to the phone's tap time (≤150 ms) to hide latency.
- Sensors/mic: iOS asks for motion permission after a tap; the microphone needs `microphone=(self)` in the site's
  Permissions-Policy (`deploy/Caddyfile.games`). Every sensor game has an on-screen fallback (joystick, tap, hold).
  Sensor/mic games are off by default in Pesta (tick them in the options).

**Wok & Roll** (`#cook`, design in `docs/COOKING.md`): a 2.5D cooking career in the style of Cooking Fever /
Cooking Madness, rendered with three.js (self-hosted `web/vendor/three-r186.js`, no external scripts), landscape only.
Chapter 1 steak bistro, chapter 2 Indonesian tent warung, story with Nenek Ijah / Chef Gilang / Oyen the cat.
- Front end `web/js/cook/`: `sim.js` (deterministic kitchen simulation, no 3D), `levels.js` (dishes, customers, layouts,
  chapters, story), `gfx.js` (renderer, quality levels, particles, picking, HTML pins), `models.js` / `world.js`
  (3D), `play.js` (one day: input, HUD, flights, hints), `story.js`, `career.js` (hub, shop, skills, items, chef).
- Server `backend/bg/cook.py`: the economy and each player's career in `bg_kv cook:<uid>` (money, XP/level, skills,
  equipment, items, cosmetics) → a `kit` the simulation uses; API `/api/cook`, `/api/cook/day|buy|chef`.
- Duel `games/cookduel.py` (solo-race engine): same seed for everyone, each phone uses its own career kit (read in
  `prepare` at Start), prank cards, items; `after_finish` pays rewards back into careers.
- 3D files `web/cook/m/*.glb` (built by `tools/build_cook_assets.mjs`, `tools/build_people.mjs`) are cached by the
  service worker in a cache that survives deploys. Balance: `node tools/cook_bot.mjs [seconds per tap]` (Node 22).

## How it works
- **Server is the referee** (`backend/bg/games/*.py`): every engine keeps its whole state as JSON, rolls dice /
  shuffles with its own RNG, validates moves and returns a per-player view (hidden cards stay hidden).
- **Rooms** (`backend/bg/rooms.py`): WebSocket `/ws/<CODE>`; seats, ready, host options; Live mode pauses for
  everyone when a player drops (grace 3–5 s), resumes after everyone taps Ready + 3-2-1; Santai mode (turn games)
  never pauses and pushes "your turn". Turn timer per room (general default from Profile), safe auto-move on
  timeout (an engine can add time while clients replay a slow animation: `anim_seconds`, used by Congklak). Rooms are saved to PocketBase (`bg_rooms`) and restored after a restart. Chat, emoji reactions (each with its own silly synthesized sound on every phone, `web/js/emojisfx.js`; 8 teasing
  ones; max 1 per player per 0.7 s),
  private events (`to`), realtime frames for Snake, stroke relay for drawing.
- **End of game** (`awards.py`): podium, awards from game stats, a kind roast for last place, optional loser dare
  (`bg_dares`, tab in `bg_dare_log`), match history (`bg_matches`) → leaderboards, head-to-head, monthly titles.
- **AI** (free Gemini, `content.py`): trivia bank (`bg_questions`) — flags/capitals from real data; AI questions
  double-checked by a second call (smart model), time-sensitive facts banned, reports quarantine questions and
  feed "lessons" into later prompts, background filler (max 30 batches/day); rebus puzzles (built-in + AI with
  solve-check); drawing words (levels + personal theme); AI judge ranks drawings (PNG rendered with Pillow).
- **AI never blocks a game:** content is prepared while players are still in the lobby (restarted when the host
  changes options); pressing Start waits at most ~6–8 s for the AI (plus the 3-2-1). Slots the AI hasn't filled
  yet get stand-in questions (data questions / nearest level); generation continues in the background and the
  room swaps stand-ins for real questions before they are shown (`ai_need` → `fulfil` → `provide`). Rebus uses the
  built-in bank while new AI puzzles generate; drawing words fall back to built-in lists after 10 s; the AI judge
  gives up after 30 s (equal points).
- **Web** (`web/`): plain ES modules, one module per game in `web/js/games/`, synthesized sounds (`sound.js`),
  ID/EN (`i18n.js`), light/dark, service worker + push.

## Deploy
    ./deploy/deploy.sh              # SKIP_PB_RESTART=1 to skip the PocketBase restart
    systemctl is-active pocketbase bashgames
First install only: `./deploy/setup-secrets.sh` (machine login `svc_bashgames`, role `games`; `/etc/bashgames/env`).
Caddy block: `deploy/Caddyfile.games`.

## Develop / test
- Engines: `python -m pytest -q tests` (random-play simulations of every engine, poker chip invariant, reports).
- Dev server: scratch PocketBase `~/work/pb/bg1` (:8095) + `~/work/bg-run.sh` / `bg-restart.sh` (:8301, BG_DEV=1).
- Browser tests: `~/work/bg_flow.py` helpers; `bg_smoke.py <games> <players> <seconds>` (auto-play with a 1 s turn
  timer, screenshots, page errors), `bg_t_pause.py`, `bg_t_santai.py`, `bg_t_draw.py`, `bg_pages.py`, `bg_desk.py`.
  Pages expose `window.__bg` (send / raw / view / room) for these scripts.

## Operations
- New friends: register on the site → owner approves in Profil → Admin (or in lyrsync).
- Reported questions: Profil → Admin → Laporan soal (restore or delete).
- Poker wallets reset to Rp1.000.000 each day at 00:00 WIB (`bg_wallets`).
