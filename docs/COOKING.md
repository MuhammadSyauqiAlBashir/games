# Wok & Roll — 3D cooking career (design, 2026-10-03)

Owner's brief: a funny, polished cooking game for his wife, **heavy 3D**, a **solo career like Cooking Dash with a
story**, plus a **duel**. Owner's choices: inside BashGames · Indonesian food · duel = race with the same orders ·
max-detail 3D. Exception to the "always multiplayer" rule: the career is solo on purpose (owner's request).

## The story (funny, Indonesian first)

You inherit **Nenek Ijah's** rusty nasi goreng cart (*gerobak*) and her secret sambal. Across the street,
**Chef Gilang** ("Gilang Viral Kitchen", 2 million followers, never cooked anything himself) wants the corner for
his next franchise. Grow the cart into a warung, a café and a restaurant and win the **Golden Wok** (*Wajan Emas*).

Regulars (each plays differently):

| Customer | Patience | Tip | Quirk |
|---|---|---|---|
| Mas Ojol (delivery rider) | short | big | always in a hurry, leaves at once if ignored |
| Tante Rempong | medium | big | complains a lot; perfect service = huge tip |
| Pak RT | long | small | eats slowly, blocks a seat while gossiping |
| Mbak Influencer | medium | medium | wants the dish *with* its topping ("aesthetic"), else posts a bad review |
| Anak Kos (student) | long | tiny | orders the cheapest thing, very grateful |
| Kucing Oyen (orange cat) | — | — | sneaks up and steals a dish from the counter — tap it to shoo it away |

Level events: *Mati lampu!* (power cut: only lanterns light the stall), *Hujan* (rain, umbrellas, fewer walk-ins
but impatient), *Buka puasa* rush (everyone arrives at the bedug), food critic visit, Chef Gilang's spy.

## Chapters (owner chose "Mix" + landscape only + 3D styled like his reference picture, 2026-10-03)

1. **Bistro Steak Nenek** (like the owner's reference picture): bright restaurant, red 4-slot steak grill + fridge
   drawer, black-pepper sauce / green beans / cherry tomatoes, orange & grape juice machines. 6 days.
2. **Warung Tenda** (night-market tent in Nenek's village): nasi goreng (+ telur, kerupuk), sate (+ bumbu kacang),
   bakso, es teh, es jeruk. 6 days.
3. **Kafe Kekinian** (planned).

Chapters 1–2 ship first; levels are data (`web/js/cook/levels.js`), so 3–4 are mostly data + a few models.

## Play (2.5D counter, Cooking Fever / Cooking Madness style — owner's reference picture, 2026-10-03)

The owner first picked "max-detail 3D" with a walking chef, then switched (same day) to a 2.5D counter view like his
reference screenshot: a big glossy counter fills the bottom of the screen, customers stand behind it with order
cards, the street/warung is the background. You are the chef's hands — no walking:
- **Front row: ingredients & toppings** (rice basket, egg basket, raw satay, kerupuk tin, peanut sauce).
  Tap a bin → it goes into a free cooker. Tap a topping → it lands on the first plate that needs it.
- **Middle row: cookers** (woks, egg pan, satay grill, bakso pot, drink coolers). Cooking shows a timer ring; ready
  dishes steam, then warn (red, shaking) and **burn** — tap a burnt pan to scrape it.
- **Back row: plates** (3, up to 5 with gear). Tap a ready wok → the dish flies onto a free plate.
- **Serve:** tap a plate (it goes to whoever has waited longest for exactly that), tap a customer (they get any
  matching plate), or **drag** a plate/cup onto a customer (their card lights up green) or into the bin.
- Customers: order card (1–2 dishes, rendered from the real 3D dishes) + vertical patience bar; paying sends coins
  flying to the money box. Combos for quick serving. Day = a fixed list of customers; 1/2/3 stars by money.
- **Landscape only**, like the reference game; an upright phone shows "Putar HP-mu" (the career waits). The camera
  frames today's equipment under the HUD; the counter may run off the screen edges.
- Balance (tools/cook_bot.mjs): fast player 3★ everywhere; casual (1.6 s per tap) 3★ early, 1–2★ late → gear matters.

## Career progress that carries into duels (owner, 2026-10-03)

The server owns the economy (`backend/bg/cook.py`, one bg_kv record per player):
- **Money** from days (replays pay half) buys **equipment** (levels): wok (cook speed), low-flame stove (burn time),
  extra plates, dangdut radio (patience), fairy lights (tips), jumbo cooler (drinks), longer counter (+1 customer),
  third wok.
- **XP → chef level → skill points**: Quick Hands (cook faster), Sweet Smile (hearts on serving), Prep Ahead (start
  with fried rice plated), Combo King, Cat Whisperer, Prankster (duel cards sooner), Unshakeable (shorter pranks).
- **Items** (bought or won, max 3 uses a day): sachet coffee, friendly bell, Grandma's secret sambal, salted fish,
  torch, umbrella. **Cosmetics** by stars: hats, cart colour, character.
- In a duel each phone gets its owner's kit from the server (`prepare` reads it at Start); duel results pay money
  + XP back into the career and used items are taken out. Host can pick "Equal" to switch gear off.

## Duel (room game `cookduel`, 2–4 players, "Race, same orders")

Everyone plays the same day (same seed, same customers) in their own 3D kitchen on their own phone; the phone
reports coins ≤4×/s (solo-race engine, server caps the rate). Fun **sabotage**: a combo of 5 earns a card —
send Kucing Oyen, a power cut, or a rain shower to the leader's kitchen. Highest coins when the bell rings wins.

## Art direction (2.5D, rendered in 3D)

- **Look:** bright, glossy "cooking game" style; bloom only on real light sources (HDR threshold — a low threshold
  hazed the whole sunny room).
- **Models:** people = Quaternius CC0 characters (human proportions, one shared rig + 6 animations, recoloured per
  role; `tools/build_people.mjs`), props = Kenney CC0 kits (`tools/build_cook_assets.mjs`), hero pieces modelled in
  code (steak with raw→grilled→burnt looks, grill, juice machines, woks, rice mound, sate, bakso). Licences in
  `web/cook/m/LICENSE.txt`.
- **Camera:** fixed 2.5D view across the counter, fitted to the screen; story scenes move in on the speaker
  (standing behind the counter) with a visual-novel dialogue box.
- **Quality levels:** Ultra (shadows 2048, bloom, 2× pixels) / High / Battery saver, auto-picked from measured FPS
  and changeable in the pause menu.

## Performance budget (2 vCPU / 2 GB server)

- **All 3D runs on the phone.** The server only serves static files and saves progress.
- No new service, no new PocketBase collection (no restart): progress is one JSON record in `bg_kv`
  (`cook:<uid>`, ≤20 KB), written at the end of a day (not during play).
- Duel = the existing solo-race room engine (a few tiny messages per second per player).
- 3D files: three.js (~810 KB, ~210 KB gzipped) + quantized models (~1.3 MB; no meshopt because its WebAssembly
  decoder would need `wasm-unsafe-eval` in the CSP), downloaded once and kept in a **separate service-worker cache
  that survives deploys**, so phones don't re-download on every release.
