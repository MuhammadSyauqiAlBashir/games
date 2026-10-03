// Plays every Wok & Roll level with a greedy bot to check that days finish and the star goals are fair.
// Run (Node 22): node tools/cook_bot.mjs [seconds between taps, default 0.35]
import { ALL_LEVELS, DISHES, duelLevel } from "../web/js/cook/levels.js"
import { Kitchen, hashSeed, sameTops } from "../web/js/cook/sim.js"

const gap = Number(process.argv[2] || 0.35)

export function decide(k) {
  const waiting = k.customers.filter((c) => ["wait", "read", "walk"].includes(c.state))
  const lines = waiting.flatMap((c) => c.order.filter((l) => !l.done))
  for (const c of k.cats) if (c.state === "sneak") return { type: "cat", id: c.id }
  const burnt = k.pieces.find((p) => p.state === "burnt")
  if (burnt) return { type: "piece", id: burnt.id }
  const ready = k.customers.filter((c) => c.state === "wait")
  // serve what's ready
  for (const pl of k.plates) if (pl.item && ready.some((c) => c.order.some((l) => !l.done && l.dish === pl.item.dish && sameTops(l.tops, pl.item.tops)))) return { type: "plate", i: pl.i }
  for (const d of k.pieces.filter((p) => p.kind === "drink" && p.state === "full")) if (ready.some((c) => c.order.some((l) => !l.done && l.dish === d.makes))) return { type: "piece", id: d.id }
  // toppings a plate still needs
  for (const pl of k.plates) {
    if (!pl.item) continue
    const l = lines.find((x) => x.dish === pl.item.dish && x.tops.length > pl.item.tops.length && pl.item.tops.every((t) => x.tops.includes(t)))
    if (!l) continue
    const top = l.tops.find((t) => !pl.item.tops.includes(t))
    const jar = k.pieces.find((p) => p.kind === "top" && p.adds === top)
    if (jar) return { type: "piece", id: jar.id }
    const pan = k.pieces.find((p) => p.kind === "cook" && p.makes === top)
    if (pan?.state === "ready") return { type: "piece", id: pan.id }
    if (pan?.state === "empty") return { type: "piece", id: k.pieces.find((p) => p.kind === "src" && p.feeds.includes(pan.id)).id }
  }
  // junk on a plate → bin
  for (const pl of k.plates) if (pl.item && !lines.some((x) => x.dish === pl.item.dish && pl.item.tops.every((t) => x.tops.includes(t)))) return { drop: { plate: pl.i }, to: { type: "trash" } }
  // cooked → plate
  if (k.plates.some((p) => !p.item)) {
    const done = k.pieces.find((p) => p.kind === "cook" && !p.topping && p.state === "ready")
    if (done) return { type: "piece", id: done.id }
  }
  // start what's needed
  const have = {}
  for (const pl of k.plates) if (pl.item) have[pl.item.dish] = (have[pl.item.dish] || 0) + 1
  for (const p of k.pieces) if (p.kind === "cook" && !p.topping && p.state !== "empty" && p.state !== "burnt") have[p.makes] = (have[p.makes] || 0) + 1
  for (const p of k.pieces) if (p.kind === "drink" && p.state !== "empty") have[p.makes] = (have[p.makes] || 0) + 1
  for (const l of lines) {
    if ((have[l.dish] || 0) > 0) { have[l.dish]--; continue }
    if (DISHES[l.dish].drink) { const d = k.pieces.find((p) => p.kind === "drink" && p.makes === l.dish && p.state === "empty"); if (d) return { type: "piece", id: d.id }; continue }
    const pot = k.pieces.find((p) => p.kind === "pot" && p.makes === l.dish)
    if (pot) { if (pot.state === "ready" && k.plates.some((x) => !x.item)) return { type: "piece", id: pot.id }; continue }
    const src = k.pieces.find((p) => p.kind === "src" && p.feeds.some((id) => k.piece(id).makes === l.dish && k.piece(id).state === "empty"))
    if (src) return { type: "piece", id: src.id }
  }
  return null
}

function play(level, kit, seed) {
  const k = new Kitchen(level, kit, seed)
  let wait = 0, guard = 0
  while (!k.over && guard++ < 20000) {
    wait -= 0.1
    if (wait <= 0) {
      const d = decide(k)
      if (d) { if (d.drop) k.drop(d.drop, d.to); else k.tap(d); wait = gap }
    }
    k.step(0.1)
  }
  return k
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0
  for (const lv of [...ALL_LEVELS, duelLevel(1, 120), duelLevel(2, 120)]) {
    const k = play(lv, null, hashSeed(lv.key))
    console.log(`${lv.key.padEnd(7)} t=${k.t.toFixed(0).padStart(4)}s coins=${String(k.coins).padStart(4)} goals=${k.goals.join("/")} stars=${k.stars()} served=${k.served}/${k.served + k.lost} combo=${k.bestCombo}`)
    if (!k.over || k.t >= 590) bad++
  }
  process.exit(bad ? 1 : 0)
}
