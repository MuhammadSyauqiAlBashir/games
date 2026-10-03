# BashGames — Claude context

Private multiplayer party games for Bashir (owner, `bashirsyauqi`), his wife (`bells`) and close friends, played
live on phones. https://games.bashir.my.id · installable PWA · same accounts/approval as lyrsync and finance.

Read `README.md` (architecture, every game, deploy, dev/test) and `docs/DESIGN.md` (owner's rule choices and house
rules per game, AI design) before deeper work. Server-wide facts are in `~/.claude/CLAUDE.md`.

Original conversations (everything the owner asked and decided, 2026-09-26 → 10-03, all apps; search them when a
detail is missing): `~/work/tx_user.txt` (owner's messages), `~/work/tx_asks.txt` (multiple-choice decisions),
`~/work/tx_assistant.txt` (Claude's longer answers); raw transcript
`~/.claude/projects/-home-bashir/b434ae8c-ff15-4ca3-aa6d-842e57f5a2aa.jsonl`.

## Rules for working on this app (owner's workflow)

- **Git workflow:** work on `develop` → commit → push `develop` → open a PR to `main` → merge it, all through the
  GitHub REST API with the token in `~/.git-credentials` (`gh` isn't installed). Repo `MuhammadSyauqiAlBashir/games`
  (private). Commits: `git -c user.name="Bashir" -c user.email="bashirsyauqi@gmail.com" commit`. Write PR bodies to
  a JSON file (python `json.dumps`) and `curl -d @file` — inline shell quoting broke once.
- Deploy after merging: `SKIP_PB_RESTART=1 ./deploy/deploy.sh`, then `systemctl is-active bashgames pocketbase caddy`
  and check `sudo journalctl -u bashgames --since "-2 min"` for errors.
- Always: run `~/work/cs-venv/bin/python -m pytest -q tests` (≈160 tests), `~/work/cs-venv/bin/ruff check --select
  F,E9 backend/bg`, JS syntax (`cp file /tmp/claude-1001/x.mjs && node --check …`), and a **real browser check**
  (Playwright, screenshots) before deploying. Look at the screenshots — several layout bugs were only visible there.
- UI language: Indonesian first with English (`ctx.L("id", "en")`); **game names are English** (owner's choice).
- Friends-only site: phones are trusted within limits (solo races/reaction times reported by the phone, server caps).
- **AI must never block a game:** prefetch in the lobby, bounded waits, built-in fallbacks, vote fallback.
- Photos/recordings stay in room memory only (never PocketBase/disk) and are only sent to the AI judge.
- Never print secrets. Owner likes step-by-step explanations; budget-conscious (free tiers).
- Update this file (History / Open decisions) when something changes.

## Owner's original brief and standing preferences

- Brief (2026-09-27): one platform named **BashGames** for the owner, his wife and 2 closest friends (login/register
  with the same approval as the other apps), mobile web + iOS Home Screen app, best UI/UX. Games are **always
  multiplayer, never against the computer** — the computer only rolls dice/shuffles. Exception the owner asked for:
  the slither.io-style Snake Arena has computer snakes so 2 players isn't boring. Real-time as much as possible;
  2–6 players depending on the game.
- Look & feel: **calm premium, cozy, playful**; sound on/off decided by each user; text chat + emoji reactions in
  every game; win history (who beat whom), statistics, awards on the winning page, per-game leaderboards, fun
  monthly titles, kind roasts and **loser dares**; cute avatars + colours.
- Connection drops: pause for everyone, wait for all to tap Ready, then a countdown (Live mode); Santai (play-later)
  mode for turn games too. Turn timer adjustable per game, default from the general setting in Profile.
- Poker in Rupiah, chips reset every 24 h, broke = can't play until tomorrow. Trivia: many topics, difficulty
  phases with more points, ⚑ report question and learn from reports; AI content prepared ahead so games never wait.
- No page scrolling/zooming inside the app (owner request 2026-09-28). Mario minigames keep their Mario names
  even though users speak Indonesian; licensing isn't a concern (private, personal use — owner's words).
- Bugs the owner reported and that were fixed: Tebak Gambar Kata (now Picture Riddles) keyboard kept closing
  (inputs are now built once and only shown/hidden — keep it that way), penalty needed a ball-into-net animation,
  Congklak too fast/small (slower sowing animation with dropping seeds, bigger board).
- Testing alone: every game needs ≥2 seats; use a second approved account (e.g. `bashirtest`) in Safari while the
  Home Screen app is logged in as the owner, Santai mode for turn games. A "Coba sendiri" practice mode was offered,
  not built. (Speed/photo/voice games added later allow 1 player.)
- Picture-riddle game idea came from the owner (viral "red E + two GO = ready to go" puzzles) → Picture Riddles
  (`rebus`; bank `data/tebak.json`; `data/rebus.json` + `tools/build_rebus.py` are the old, unused bank). Not the
  same game as Draw & Guess (`drawguess`, old name "Tebak Gambar").

## Server facts

| Item | Value |
|---|---|
| Service | `bashgames.service` (uvicorn + `websockets` — without it WS upgrades return 404), user `bashgames`, 127.0.0.1:8300, sandboxed; StateDirectory `/var/lib/bashgames` (VAPID key) |
| Code | `/opt/bashgames/{bg,venv}`, web `/srv/bashgames` |
| Secrets | `/etc/bashgames/env` (`root:bashgames 640`): `BG_PB_USER` (`svc_bashgames`, role `games`), `BG_PB_PASSWORD`, `GEMINI_API_KEY` (copied from finance), `CF_ACCOUNT_ID`, `CF_API_TOKEN` (copied from the shop's admin.env on 2026-10-01; backup `~/work/bashgames-env.bak-2026-10-01`). `deploy/setup-secrets.sh` recreates it |
| Data | PocketBase `bg_*` (role `games` only; `pb.bashir.my.id` 404s `/api/collections/bg_*`): rooms, matches, profiles, wallets, questions, reports, dares, kv. Snapshot before install `~/work/pb-before-bashgames-2026-09-28.db` |
| Caddy | `deploy/Caddyfile.games`: CSP allows `wss://games.bashir.my.id`; Permissions-Policy `microphone=(self), accelerometer=(self), gyroscope=(self)`, camera off (photo games use `<input type=file capture>`, which needs no camera permission). Backups `~/work/Caddyfile.bak-bashgames-2026-09-28`, `…-mic-2026-09-28` |
| Dev | scratch PB `~/work/pb/bg1` on :8095 (start: `cd ~/work/pb/bg1 && /opt/pocketbase/pocketbase serve --http 127.0.0.1:8095 --dir pb_data --hooksDir pb_hooks --migrationsDir pb_migrations`), `~/work/bg-run.sh` / `bg-restart.sh` (:8301, BG_DEV=1, loads Gemini + Cloudflare keys); test users bashir/bells/rafi/dinda. Stop both when done (kill by port; `pkill -f` once killed the shell) |
| Browser tests | `~/work/bg_flow.py` (login/setup/start/view helpers; pages expose `window.__bg`), `bg_smoke.py`, `bg_vis.py`, `bg_t_*.py` (dice, lobby, new games, karaoke, voice), Playwright in `~/work/fin-venv` |
| Fake audio | `~/work/bg_t_karaoke.py` `FAKE`: overrides `getUserMedia` with a WAV passed as a data URL (the service worker blocks routed URLs); test WAVs in `~/work/fakeaudio/` (accumulate phase for vibrato!) |

## Architecture essentials

- Engines `backend/bg/games/*.py`: server is the referee (state JSON, own RNG, per-player `view`). Kinds: `turn`,
  `timed` (`tick()`), `realtime` (Snake). Rooms `backend/bg/rooms.py`: WS `/ws/<CODE>`, Live/Santai modes, pause on
  disconnect, turn timer + `anim_seconds`, rooms saved/restored.
- **Events with a `"to"` key are PRIVATE to that player id** (filtered in `state_msg`). Never use `to` for squares,
  owners or destinations (bug fixed in PR #5: Ular Tangga rolls / Ludo & Monopoly moves were hidden).
- AI hooks: `prepare()` (lobby prefetch, `refresh()` at start), `s["ai_need"]` → `fulfil(need, options)` or
  `fulfil_room(need, options, room)` (needs room photos/audio) → `provide(need, result, now)`; server-side input
  from HTTP uploads: `room.server_input(uid, data)` → `game.server_input`.
- `/ws/lobby`: live home page (rooms + who's online pushed by `ROOMS.lobby_loop`, poked on changes).
- Uploads: `POST /api/rooms/{code}/photo?r=` (re-encoded JPEG ≤768 px, EXIF stripped), `POST /api/rooms/{code}/audio?r=&slot=me|ref`
  (16 kHz mono WAV ≤15 s made on the phone); kept in `room.photos` (≤12 MB, cleared at start/back-to-lobby).
- Front end: `web/js/games/<key>.js` `mount(stage, ctx)` → `{update, destroy, scores}`; `ctx.now()` = shared game
  clock; `common.js` (3D dice `makeDie`, `throwDice`, `gated`), `mp.js` (Mario kit), `audiokit.js` (mic, YIN pitch,
  WAV, synth, synced playback), `photokit.js` (camera → JPEG upload). Room seat bar calls `scores(v)` — guarded.

## Games (69)

Board & dice, cards, quiz & party (see README), Mario minigames (36) + Pesta mode, plus (2026-10-01):
- **Adu cepat:** Bom Kata (word bomb; Indonesian = PySastrawi roots + stemmer, MIT, `lexicon.py`), Survei 100
  (Family 100; Gemini boards + `data/survei.json`), Cari Kembar (Spot it, projective-plane deck), Refleks Kilat,
  Ketik Ngebut.
- **Dinilai AI:** Foto Hunt, Ekspresi Challenge (selfie acting, never judges looks), Draw & AI Judge.
- **Nyanyi & suara:** Karaoke Klasik (synth clips of public-domain/folk songs `data/songs.json`; phone pitch
  tracking, `pitch.py` note-by-note scoring, any key; tested right song 100 / wrong song ~45 / random ~20),
  Nyanyi Lagu Hits (round DJ brings the real song clip — file slice or 10 s recorded from a speaker — or just a
  title; Gemini compares singers with the original; vote fallback), Tiru Suara (sound imitations).
- **Wok & Roll** (2026-10-03, PR #13): 3D-rendered 2.5D cooking career (owner's reference: a Cooking Madness-style
  screenshot — landscape, big glossy counter, customers behind it with order cards) + **Wok & Roll Duel**. Owner's
  choices: inside BashGames; "Mix" (ch.1 steak bistro like the picture, ch.2 Indonesian warung); landscape only;
  career gear/skills/items carry into duels (server-owned economy in `bg/cook.py`, bg_kv `cook:<uid>`); realistic
  CC0 people (Quaternius) instead of chibi characters. Design + history of the redesigns: `docs/COOKING.md`.
- Copyright: no copyrighted lyrics/melodies are stored; popular songs only via the owner's own clip (Nyanyi Lagu
  Hits). "Naik-Naik ke Puncak Gunung" (Ibu Sud) left out on purpose.

## AI setup and limits

- **Gemini** (free tier, `bg/ai.py`, FAST/SMART fallback lists) — quota shared with finance and the shop, resets
  14:00 WIB. 429 = daily quota used up; 503 = Google overloaded (common, each try can take 8–20 s).
- **Cloudflare Workers AI** (`bg/cfai.py`, free, account shared with the shop's FLUX): backup vision judge
  (Llama 4 Scout, then Gemma 4 with thinking off) on a labelled collage (`bg/vision.py`). Games capped at
  `BG_CF_DAILY_NEURONS` = 2000/day (bg_kv `cf_neurons:<date>`), ~40 neurons per judging. Can't judge audio.
- `vision.race()`: Gemini first with a 5–7 s head start, then Cloudflare alongside; first good answer wins;
  ≤25–30 s, then fallbacks (photo accepted unchecked / equal points / vote).
- Trivia bank `bg_questions` (1,122 ok questions on 2026-10-01; filler tops up any topic/lang with < 24 unused,
  max 30 batches per WIB day, 2 SMART calls each; production only).
- Recent-word/question memories: bg_kv `draw_recent:<lang>` (320), `survei_recent:<lang>` (60).

## History (PRs to main)

- #1–#2 (2026-09-28): 20 games, rooms, awards, push; 10 + 26 Mario minigames, Pesta mode, sensors/mic.
- #3 (10-01): Gaple table, 3D dice, Ludo yard, snake skins, English names, UNO/Poker animations + chip sounds,
  harder Tebak Gambar riddles, Cak Lontong Quiz.
- #4: Snake analog stick + fullscreen; Big-Top Quiz (one picture per Toad, harder questions); categorised
  non-repeating drawing words; AI judge retries ~30 s.
- #5: real 3D dice throw (Ludo, Ular Tangga, Monopoly; pieces move after landing); private-`to` event bug fix.
- #6: live home page (`/ws/lobby`).
- #7: Bom Kata, Survei 100, Cari Kembar, Refleks Kilat, Ketik Ngebut, Foto Hunt, Ekspresi; tied AI scores share points.
- #8: Cloudflare backup judge racing Gemini (Ekspresi was "juri sibuk" too often).
- #9: voice games (Karaoke Klasik, Nyanyi Lagu Hits, Tiru Suara).
- #10–#11 (10-03): docs only — this CLAUDE.md (full app context from the conversation history).
- #13 (10-03): Wok & Roll cooking career + duel (three.js, CC0 models, server-side career economy).
- #12 (10-03): docs only — README brought up to date (68 games, categories, judge timeouts, names); Picture
  Riddles naming clarified. Stale local `master` branch deleted.

## Open decisions / ideas (waiting for the owner)

- **Trivia filler is too greedy** (2026-10-03 analysis): Google's quota resets 14:00 WIB but the filler's day counter
  resets at 00:00 WIB, so it could spend ~2 days of batches in one quota window; most 429s happened 02:00–07:00 WIB
  while nobody played. Proposed: run only after 14:00 WIB, cap ~10 batches per Google day, stop for the day on the
  first 429. **Owner hasn't answered yet.**
- Next AI-judged games (researched 2026-10-01): Kawanan (Herd Mentality), Siapa Bot? (spot the AI answer), Nasib
  di Tangan AI (Death by AI), Kata Rahasia (Contexto race), Tebak Gaya (photo charades), Skala AI (Wavelength),
  Meme Kocak, Sidang Hakim AI, Investor Gila, Kamus Ngarang, Tiru Pose, Roast Barang, Karaoke style ideas.
  Recommended: Kawanan, Siapa Bot?, Nasib di Tangan AI.
- Wok & Roll next: chapter 3 (Kafe Kekinian), more people/outfits, sounds per dish, a real-iPhone check.
- Optional: practice mode with computer players. (Fixed snake joystick: not wanted — owner is happy with the
  floating stick.)
- Cleanup (needs an app PR, owner said "not yet" on 2026-10-03): delete the unused `backend/bg/data/rebus.json` +
  `tools/build_rebus.py`.
- Claude API as a judge: owner has Claude Pro (personal only, no API access); a pay-as-you-go API key would be
  needed (~$0.01/round with Haiku 4.5; can't do audio). Not set up.

## Open owner tasks

- [ ] Install on both iPhones (Safari → Share → Add to Home Screen) → Profil: avatar, 🔔 notifications.
- [ ] Friends register on the site; approve them in Profil → Admin.

## Gotchas learned

- Wok & Roll / three.js: the site CSP has no `wasm-unsafe-eval` → no meshopt/Draco (models are only quantized);
  GLTFLoader fetches embedded textures as `blob:` (blocked by `connect-src`) unless `createImageBitmap` is hidden while
  loading (done in `models.js`); GLTFLoader renames duplicate node names (`Hips_1`, `female-a_1`) → names are
  stripped on load; bloom threshold must be HDR (~2.4) or the sunny room hazes. Test the production CSP with
  `CSP=1 LAND=1 python ~/work/bg_t_cook.py <level>` (also `CKSPEED`, test hooks `window.__ck` / `__ckSpeed`).
  Tools: `~/work/cook-tools` (npm bootstrapped, Node 22 in `node22/`, esbuild, gltf-transform); sources
  `~/work/cook-assets` (Kenney), `~/work/people` (Quaternius via poly.pizza).

- iOS: AudioContext/mic need a tap first (`soundGate`); playback gets quieter while the mic is open, so the mic is
  only opened for your own turn. Spotify/Apple Music songs can't be picked as files (use "record from speaker").
- SVG `transform-origin`/`transform-box` CSS breaks the `rotate(a x y)` attribute (Cari Kembar cards).
- Fake-mic test WAVs: generate vibrato by accumulating phase, not `sin(f·t·vib)`.
- Headless Chrome can't resize a fullscreen window; set the viewport before entering fullscreen.
- Gemini: no temperature on Gemini 3; all schema fields required + `propertyOrdering`; Cloudflare Gemma 4 needs
  `chat_template_kwargs.enable_thinking=false` and still writes weak comments (Llama 4 Scout first).
