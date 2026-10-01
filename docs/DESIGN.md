# BashGames — design (owner interview, 2026-09-27/28)

| Topic | Decision |
|---|---|
| Players | Owner, wife, two close friends. Private: register + same approval as the other apps. |
| Platform | One site `games.bashir.my.id`, mobile web + iOS Home Screen app, name **BashGames**. |
| Look | Calm premium but cozy and playful (cream, wood, felt; Nunito + Fraunces). Light/dark. |
| Language | Bahasa Indonesia + English, switchable (app language per player; content language per game). |
| Multiplayer | Always multiplayer, 2–6 per game; the computer only rolls dice / shuffles (exception: Snake has computer snakes, requested). Real-time shared table: every move shows on everyone's screen. |
| Live vs later | Live (default): pause for everyone on disconnect, wait for all to reconnect, all tap Ready, 3-2-1 countdown. Santai mode for turn-based games: no pause, push on your turn. |
| Turn timer | Adjustable per game room; the default comes from the player's general setting (Profile, 60 s). On timeout the server makes a safe automatic move. |
| Social | Text chat + emoji reactions in every game; sound on/off + volume per player; fun sounds; loser roast; loser dares. |
| Stats | Win history, head-to-head, per-game leaderboard, awards on the winning screen, monthly fun titles. |
| Trivia safety | ⚑ report button (voids the question for that game, removes it from the bank, becomes a lesson for the AI); second-AI verification; data-backed flags/capitals; no time-sensitive facts; admin review page. |

## Game rules chosen
- **Ludo:** 6 to leave; 6 = roll again (three 6s OK); capture and reaching home = extra roll; start + star squares safe; no blockades; exact roll home; 2 players sit opposite on the 4-board; 5–6 players use the 6-board.
- **Ular Tangga:** exact roll to 100 — overshoot = stay and lose the turn. Boards: classic / random / easy / hard.
- **Congklak:** keep sowing from non-empty holes; capture opposite from your own empty hole; no burned holes.
- **Checkers:** international 10×10 (flying kings, compulsory maximum capture).
- **SOS / Tic-tac-toe:** adjustable board, up to 4 players.
- **UNO:** official rules confirmed by the owner; house rules as switches (stacking, draw until playable, jump-in, 7-0, +4 any time); single round or to 500.
- **Poker:** Texas Hold'em NL in Rupiah; Rp1.000.000 per player per day (reset 00:00 WIB); broke = out until tomorrow; blinds Rp10rb/20rb rising every 10 min.
- **Gaple:** 7 tiles each; 4 players no boneyard (pass), 2–3 players nyangkul from the boneyard; double six / highest double starts; blocked → lowest pips; single round or to 100/150.
- **Monopoly:** official rules with Chance & Community Chest (world cities, Rupiah ×10.000), auctions, trading, houses/hotels, mortgages, jail, bankruptcy; Fast mode (time limit, richest wins); optional Free Parking jackpot.
- **Trivia:** 22 topics incl. flags, capitals, trick questions, K-pop, Islam, Bahasa Indonesia; difficulty phases ×1/×2/×3/×5; speed scoring.
- **Matematika:** SD/SMP/SMA, arithmetic, sequences, story problems, logic — generated locally (always correct).
- **Rebus:** built-in bank (EN + Indonesian emoji "tebak gambar") + AI puzzles rendered from text/emoji layouts.
- **Speed challenges (2026-10-01):** Bom Kata (`speed.py`; Indonesian words = Sastrawi root list + stemmer, MIT, in
  `lexicon.py`; English = ENABLE; secret fuse per turn, bonus letters = extra life), Survei 100 (`survei.py`; Gemini
  boards with aliases + `data/survei.json` bank, recent questions in `bg_kv survei_recent:<lang>`), Cari Kembar
  (Dobble deck from a projective plane of order 7), Refleks Kilat (reaction measured on the phone from the frame the
  signal is drawn; < 90 ms = false start), Ketik Ngebut (`data/ketik.json`; only letters/digits/spaces count).
- **Photo games:** Foto Hunt + Ekspresi Challenge (`photo.py`). Photos go up via `POST /api/rooms/{code}/photo`,
  are re-encoded (EXIF stripped, ≤768 px), kept only in the room's memory (≤12 MB, gone at back-to-lobby/close),
  checked / ranked by Gemini with a **Cloudflare Workers AI backup** (`vision.race`: Gemini gets a 5–7 s head
  start, then Llama 4 Scout (then Gemma 4) on one labelled collage runs alongside; first answer wins; ≤25/30 s, then
  accepted unchecked / equal points). Same for Draw & AI Judge. Cloudflare use is capped at BG_CF_DAILY_NEURONS
  (2000/day, ~40 per judging) in `bg_kv cf_neurons:<date>` so the shop's free FLUX allowance is left alone. Judging is about the acting only, never looks. Free-tier Gemini: Google may use the photos to improve
  its products — the screen says the photos go to Gemini.
- **Draw games:** words from a categorised bank (`data/draw_bank.json`, 14 categories × levels, ~440 words per language) plus fresh
  Gemini words for the same categories; the category option ("Mix" or one category) is shown to everyone while drawing.
  Words played recently are remembered in `bg_kv` `draw_recent:<lang>` (last 320) and skipped until the bank runs low.
  AI judge compares all drawings anonymously; if Gemini is busy it retries for up to ~30 s, then everyone gets equal points.
- **Snake Arena:** floating analog stick (touch anywhere), fullscreen button (landscape on phones that allow it).
- **Big-Top Quiz:** each Toad keeps one picture all round; questions about where it went, waves, jumps, swaps, neighbours.
- **Penalty:** left/middle/right for shooter and keeper; 5 kicks then sudden death.
- **Snake:** last human alive; shrinking arena; computer snakes (count + skill adjustable); boost.

## Mario minigames + Pesta mode (2026-09-28)
Owner's picks from the Super Mario Party Jamboree list (first batch of 10) + a party mode. Decisions:
- Names stay the original Mario names in both languages (UI text is still Indonesian/English). Personal use.
- Look: bright Jamboree style — bold italic outlined titles, START!/FINISH! banners, chunky 3D buttons, SVG
  characters drawn in-house.
- Adapted for 2–4 phones: Fast Fishing is everyone at once (first to N catches); Lost and Pound rotates the hider
  (dodge +3, hit +1 per striker); Tricky Turntable gives each player a side of the cog (2 buttons each with 2
  players); Knock-Knock Match is competitive pairs; Talking Flower Says uses 3 hearts; Sled to the Edge is
  best-of-rounds with ice types.
- Pesta: 4/6/8/10 minigames (host picks which), coins 10/6/3/0 (3 players 10/5/0, 2 players 10/0), bonus stars
  (Minigame Star = most wins, So-Close Star = most 2nd places, Steady Star = best average place), +15 each.
- The dev server no longer runs the trivia filler (it shares the free Gemini quota with production).

## Second batch (the 🟡 list, 2026-09-28)
26 more minigames, all Mario names. Adaptations: solo-race games run on each phone from a shared seed (the phone
reports its score); arenas are server-simulated at 20 fps; 1-vs-3 games rotate the solo role so it's fair in
free-for-all; team games use 1v1 / 1v2 (solo counts double) / 2v2; the Kaboom-style co-op rhythm games are
competitive (best score wins). Sensor and microphone games always have a touch fallback, and are off by default
in Pesta. Night Lights and Unfriendly Flying Object were left out (duplicates of Pickax Dash / Sunset Standoff).

## Polish round (2026-10-01)
- Gaple: big felt table; the line snakes like a real table (grows from the first tile, turns at the edge, doubles
  crosswise, rows turn sooner on portrait phones). Engine records `left_n` so the first tile is known.
- 3D dice everywhere (Ludo, Snakes & Ladders, Monopoly): CSS cube, time-based tumble that survives re-renders.
- Ludo: yard pieces centred in their spots. Snake Arena: shaded bodies, 6 skins, tongue, glow food, fills the screen.
- UNO and Poker: cards/chips fly (Web Animations); poker deals, flips the board, chips to pot with clinks, pot to winner.
- All game names in English. Picture Riddles rebuilt as Tebak Gambar; new Cak Lontong Quiz.
