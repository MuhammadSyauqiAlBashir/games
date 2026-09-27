# BashGames

Private multiplayer games for the owner, his wife and close friends — live on everyone's phone.
https://games.bashir.my.id · same accounts and approval as lyrsync / finance · installable PWA.

## Games (20)
Board & dice: Ludo (4-colour board for 2–4, 6-colour board for 5–6), Ular Tangga, Monopoli (world cities,
Rupiah, official rules or fast mode), Congklak, Dam (international 10×10), Connect 4, SOS, Tic-tac-toe (any size).
Cards: UNO (official + house-rule switches), Sequence (teams at 4), Poker (Texas Hold'em, Rp1.000.000 per day),
Gaple (domino, nyangkul). Quiz & party: Trivia (AI question bank, difficulty phases, ⚑ report), Matematika,
Tebak Gambar Kata (rebus), Anagrams (English), Tebak Gambar (draw & guess), Gambar & Juri AI. Action: Adu Penalti,
Arena Ular (snake with computer snakes). Rules summaries: `web/js/i18n.js` (RULES).

## How it works
- **Server is the referee** (`backend/bg/games/*.py`): every engine keeps its whole state as JSON, rolls dice /
  shuffles with its own RNG, validates moves and returns a per-player view (hidden cards stay hidden).
- **Rooms** (`backend/bg/rooms.py`): WebSocket `/ws/<CODE>`; seats, ready, host options; Live mode pauses for
  everyone when a player drops (grace 3–5 s), resumes after everyone taps Ready + 3-2-1; Santai mode (turn games)
  never pauses and pushes "your turn". Turn timer per room (general default from Profile), safe auto-move on
  timeout. Rooms are saved to PocketBase (`bg_rooms`) and restored after a restart. Chat, emoji reactions,
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
  gives up after 45 s (equal points).
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
