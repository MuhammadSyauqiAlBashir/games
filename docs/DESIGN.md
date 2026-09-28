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
- **Draw games:** words from Gemini with level + personal theme (fallback lists); AI judge compares all drawings anonymously.
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
